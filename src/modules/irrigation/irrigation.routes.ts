import { Router, Response } from 'express';
import prisma from '../../config/database';
import { createIrrigationLogSchema, CreateIrrigationLogInput } from '../../utils/validation';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { successResponse, notFoundError, errorResponse } from '../../utils/response';
import { Role, TaskPriority, IrrigationStatus } from '../../types/enums';
import { triggerIrrigationWebhook } from '../integrations/n8n/n8n.service';
import logger from '../../config/logger';

const router = Router();

const calculateIrrigationStatus = (
  moistureDeficit: number,
  warningThreshold: number,
  criticalThreshold: number
): IrrigationStatus => {
  if (moistureDeficit >= criticalThreshold) {
    return IrrigationStatus.CRITICAL;
  }
  if (moistureDeficit >= warningThreshold) {
    return IrrigationStatus.WARNING;
  }
  return IrrigationStatus.NORMAL;
};

const checkEscalation = async (fieldId: string): Promise<boolean> => {
  const recentLogs = await prisma.irrigationLog.findMany({
    where: {
      fieldId,
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  if (recentLogs.length < 3) return false;

  const allWarning = recentLogs.every(
    (log) => log.moistureDeficit >= 10 && log.moistureDeficit < 15
  );

  return allWarning;
};

/**
 * @swagger
 * /api/v1/irrigation-logs:
 *   post:
 *     summary: Create irrigation log
 *     description: Record irrigation moisture data (Worker/Supervisor). Automatically calculates status and triggers webhooks for critical conditions.
 *     tags: [Irrigation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateIrrigationLogRequest'
 *     responses:
 *       201:
 *         description: Irrigation log created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IrrigationLogResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Field not found
 */
router.post('/', authenticate, authorize(Role.WORKER, Role.SUPERVISOR), validate(createIrrigationLogSchema), async (req, res: Response) => {
  try {
    const { fieldId, moistureDeficit } = req.body as CreateIrrigationLogInput;
    const userId = req.user!.id;

    const field = await prisma.field.findUnique({ where: { id: fieldId } });
    if (!field) {
      return notFoundError(res, 'Field not found');
    }

    const status = calculateIrrigationStatus(
      moistureDeficit,
      field.warningThreshold,
      field.criticalThreshold
    );

    const irrigationLog = await prisma.irrigationLog.create({
      data: {
        fieldId,
        moistureDeficit,
        recordedById: userId,
      },
    });

    logger.info(
      { irrigationLogId: irrigationLog.id, fieldId, moistureDeficit, status },
      'Irrigation log created'
    );

    if (status === IrrigationStatus.CRITICAL) {
      const escalated = await checkEscalation(fieldId);
      const finalStatus = escalated ? IrrigationStatus.CRITICAL : status;

      await prisma.task.create({
        data: {
          fieldId,
          title: `Critical irrigation required - Field ${field.name}`,
          description: `Moisture deficit: ${moistureDeficit}. Immediate irrigation needed.`,
          priority: escalated ? TaskPriority.CRITICAL : TaskPriority.CRITICAL,
        },
      });

      triggerIrrigationWebhook(irrigationLog, finalStatus).catch((err) => {
        logger.error({ error: err, irrigationLogId: irrigationLog.id }, 'Failed to trigger irrigation webhook');
      });

      logger.info({ fieldId, escalated }, 'Critical irrigation - task created');
    }

    return successResponse(res, { status }, 'Irrigation log recorded');
  } catch (error) {
    logger.error({ error }, 'Error creating irrigation log');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/irrigation-logs:
 *   get:
 *     summary: List irrigation logs
 *     description: Get all irrigation logs, optionally filtered by field
 *     tags: [Irrigation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fieldId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by field ID
 *     responses:
 *       200:
 *         description: List of irrigation logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/IrrigationLog'
 */
router.get('/', authenticate, async (req, res: Response) => {
  try {
    const { fieldId } = req.query;
    const where = fieldId ? { fieldId: fieldId as string } : {};

    const logs = await prisma.irrigationLog.findMany({
      where,
      include: {
        field: { select: { id: true, name: true, cropType: true } },
        recordedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return successResponse(res, logs);
  } catch (error) {
    logger.error({ error }, 'Error fetching irrigation logs');
    return errorResponse(res);
  }
});

export default router;
