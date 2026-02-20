import { Router, Response } from 'express';
import prisma from '../../config/database';
import { createIncidentSchema, updateIncidentStatusSchema, CreateIncidentInput, UpdateIncidentStatusInput } from '../../utils/validation';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { successResponse, notFoundError, errorResponse } from '../../utils/response';
import { Role } from '../../types/enums';
import { triggerIncidentWebhook } from '../integrations/n8n/n8n.service';
import logger from '../../config/logger';

const router = Router();

/**
 * @swagger
 * /api/v1/incidents:
 *   post:
 *     summary: Create an incident
 *     description: Report a new incident (Worker/Supervisor)
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateIncidentRequest'
 *     responses:
 *       201:
 *         description: Incident created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       enum: [OPEN]
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Field not found
 */
router.post('/', authenticate, authorize(Role.WORKER, Role.SUPERVISOR), validate(createIncidentSchema), async (req, res: Response) => {
  try {
    const data = req.body as CreateIncidentInput;
    const userId = req.user!.id;

    const field = await prisma.field.findUnique({ where: { id: data.fieldId } });
    if (!field) {
      return notFoundError(res, 'Field not found');
    }

    const incident = await prisma.incident.create({
      data: {
        fieldId: data.fieldId,
        reportedById: userId,
        type: data.type,
        severity: data.severity,
        description: data.description,
      },
      include: {
        field: true,
        reportedBy: {
          select: { fullName: true, email: true },
        },
      },
    });

    logger.info({ incidentId: incident.id, type: incident.type, severity: incident.severity }, 'Incident created');

    triggerIncidentWebhook(incident).catch((err) => {
      logger.error({ error: err, incidentId: incident.id }, 'Failed to trigger incident webhook');
    });

    return successResponse(res, {
      id: incident.id,
      status: incident.status,
      createdAt: incident.createdAt,
    }, 'Incident created successfully', 201);
  } catch (error) {
    logger.error({ error }, 'Error creating incident');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/incidents:
 *   get:
 *     summary: List incidents
 *     description: Get all incidents (role-filtered)
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of incidents
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
 *                     $ref: '#/components/schemas/Incident'
 */
router.get('/', authenticate, async (req, res: Response) => {
  try {
    const user = req.user!;
    let where = {};

    if (user.role === Role.WORKER) {
      const fields = await prisma.field.findMany({
        select: { id: true },
      });
      where = { fieldId: { in: fields.map((f) => f.id) } };
    }

    const incidents = await prisma.incident.findMany({
      where,
      include: {
        field: { select: { id: true, name: true, cropType: true } },
        reportedBy: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(res, incidents);
  } catch (error) {
    logger.error({ error }, 'Error fetching incidents');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/incidents/{id}/status:
 *   patch:
 *     summary: Update incident status
 *     description: Update incident status (Supervisor/Admin)
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateIncidentStatusRequest'
 *     responses:
 *       200:
 *         description: Incident status updated
 *       404:
 *         description: Incident not found
 */
router.patch('/:id/status', authenticate, authorize(Role.SUPERVISOR, Role.ADMIN), validate(updateIncidentStatusSchema), async (req, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as UpdateIncidentStatusInput;

    const incident = await prisma.incident.update({
      where: { id },
      data: { status },
      include: {
        field: { select: { id: true, name: true } },
      },
    });

    logger.info({ incidentId: id, status }, 'Incident status updated');

    return successResponse(res, incident);
  } catch (error) {
    logger.error({ error, incidentId: req.params.id }, 'Error updating incident status');
    return notFoundError(res, 'Incident not found');
  }
});

export default router;
