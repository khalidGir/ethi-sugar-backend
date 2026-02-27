import { Router, Response } from 'express';
import { AuthRequest } from '../../types/express';
import prisma from '../../config/database';
import { authenticate, authorize } from '../../middlewares/auth';
import { successResponse, notFoundError, errorResponse, badRequestError } from '../../utils/response';
import { Role } from '../../types/enums';
import logger from '../../config/logger';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createDailyLogSchema = z.object({
  workerId: z.string().uuid('Invalid worker ID').optional(),
  taskId: z.string().uuid('Invalid task ID').optional(),
  fieldId: z.string().uuid('Invalid field ID'),
  activity: z.string().min(1, 'Activity description is required'),
  activityType: z.string().min(1, 'Activity type is required'),
  hoursSpent: z.number().min(0).max(24),
  resourcesUsed: z.string().optional(),
  observations: z.string().optional(),
  photos: z.array(z.string().url()).optional(),
  loggedAt: z.string().datetime().optional(),
});

const verifyDailyLogSchema = z.object({
  verificationStatus: z.enum(['VERIFIED', 'REJECTED']),
  notes: z.string().optional(),
});

/**
 * @swagger
 * /api/v1/daily-logs:
 *   post:
 *     summary: Submit daily work log
 *     description: Submit daily work log (WORKER, SUPERVISOR)
 *     tags: [Daily Logs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fieldId
 *               - activity
 *               - activityType
 *               - hoursSpent
 *             properties:
 *               workerId:
 *                 type: string
 *                 format: uuid
 *               taskId:
 *                 type: string
 *                 format: uuid
 *               fieldId:
 *                 type: string
 *                 format: uuid
 *               activity:
 *                 type: string
 *                 description: Activity description (e.g., "Weeding", "Irrigation")
 *               activityType:
 *                 type: string
 *                 description: Activity type (e.g., "MAINTENANCE", "HARVEST", "PLANTING")
 *               hoursSpent:
 *                 type: number
 *                 description: Hours spent on activity
 *               resourcesUsed:
 *                 type: string
 *                 description: Resources used (JSON or text)
 *               observations:
 *                 type: string
 *                 description: Worker notes
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *               loggedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Daily log created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', authenticate, authorize(Role.WORKER, Role.AGRONOMIST), async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = createDailyLogSchema.safeParse(req.body);
    if (!validationResult.success) {
      return badRequestError(res, validationResult.error.errors.map(e => e.message).join(', '));
    }

    const data = validationResult.data;
    const user = req.user!;

    // Use authenticated user's ID if workerId not provided (for workers)
    const workerId = data.workerId || user.id;

    // Validate worker exists
    const worker = await prisma.user.findUnique({ where: { id: workerId } });
    if (!worker) {
      return notFoundError(res, 'Worker not found');
    }

    // Validate field exists
    const field = await prisma.field.findUnique({ where: { id: data.fieldId } });
    if (!field) {
      return notFoundError(res, 'Field not found');
    }

    // Validate task if provided
    if (data.taskId) {
      const task = await prisma.task.findUnique({ where: { id: data.taskId } });
      if (!task) {
        return notFoundError(res, 'Task not found');
      }
    }

    const dailyLog = await prisma.workerDailyLog.create({
      data: {
        workerId,
        taskId: data.taskId,
        fieldId: data.fieldId,
        activity: data.activity,
        activityType: data.activityType,
        hoursSpent: data.hoursSpent,
        resourcesUsed: data.resourcesUsed,
        observations: data.observations,
        photos: data.photos || [],
        loggedAt: data.loggedAt ? new Date(data.loggedAt) : new Date(),
        verificationStatus: 'PENDING',
      },
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        field: {
          select: {
            id: true,
            name: true,
            cropType: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    logger.info({ dailyLogId: dailyLog.id, workerId, fieldId: data.fieldId }, 'Daily log created');

    return successResponse(res, dailyLog, 'Daily log created successfully', 201);
  } catch (error) {
    logger.error({ error }, 'Error creating daily log');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/daily-logs/worker/{workerId}:
 *   get:
 *     summary: Get worker's log history
 *     description: Get daily logs for a specific worker
 *     tags: [Daily Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Worker's log history retrieved successfully
 */
router.get('/worker/:workerId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workerId } = req.params;
    const { limit, startDate, endDate } = req.query;

    const where: Record<string, unknown> = { workerId };

    if (startDate || endDate) {
      where.loggedAt = {};
      if (startDate) (where.loggedAt as Record<string, unknown>).gte = new Date(startDate as string);
      if (endDate) (where.loggedAt as Record<string, unknown>).lte = new Date(endDate as string);
    }

    const dailyLogs = await prisma.workerDailyLog.findMany({
      where,
      orderBy: { loggedAt: 'desc' },
      take: parseInt(limit as string) || 20,
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        field: {
          select: {
            id: true,
            name: true,
            cropType: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Calculate summary
    const totalHours = dailyLogs.reduce((sum, log) => sum + log.hoursSpent, 0);
    const verifiedCount = dailyLogs.filter(log => log.verificationStatus === 'VERIFIED').length;

    return successResponse(res, {
      logs: dailyLogs,
      count: dailyLogs.length,
      summary: {
        totalHours: Math.round(totalHours * 100) / 100,
        verifiedCount,
        pendingCount: dailyLogs.filter(log => log.verificationStatus === 'PENDING').length,
      },
    });
  } catch (error) {
    logger.error({ error, workerId: req.params.workerId }, 'Error fetching worker logs');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/daily-logs/field/{fieldId}:
 *   get:
 *     summary: Get field activity logs
 *     description: Get all daily logs for a specific field
 *     tags: [Daily Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fieldId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Field activity logs retrieved successfully
 */
router.get('/field/:fieldId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fieldId } = req.params;
    const { limit, startDate, endDate } = req.query;

    // Validate field exists
    const field = await prisma.field.findUnique({ where: { id: fieldId } });
    if (!field) {
      return notFoundError(res, 'Field not found');
    }

    const where: Record<string, unknown> = { fieldId };

    if (startDate || endDate) {
      where.loggedAt = {};
      if (startDate) (where.loggedAt as Record<string, unknown>).gte = new Date(startDate as string);
      if (endDate) (where.loggedAt as Record<string, unknown>).lte = new Date(endDate as string);
    }

    const dailyLogs = await prisma.workerDailyLog.findMany({
      where,
      orderBy: { loggedAt: 'desc' },
      take: parseInt(limit as string) || 20,
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        field: {
          select: {
            id: true,
            name: true,
            cropType: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Group by activity type
    const activitySummary: Record<string, number> = {};
    dailyLogs.forEach(log => {
      activitySummary[log.activityType] = (activitySummary[log.activityType] || 0) + log.hoursSpent;
    });

    return successResponse(res, {
      logs: dailyLogs,
      count: dailyLogs.length,
      activitySummary,
    });
  } catch (error) {
    logger.error({ error, fieldId: req.params.fieldId }, 'Error fetching field logs');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/daily-logs/{id}/verify:
 *   patch:
 *     summary: Verify daily log
 *     description: Verify or reject a daily log (SUPERVISOR, AGRONOMIST only)
 *     tags: [Daily Logs]
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
 *             type: object
 *             required:
 *               - verificationStatus
 *             properties:
 *               verificationStatus:
 *                 type: string
 *                 enum: [VERIFIED, REJECTED]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Daily log verified successfully
 *       404:
 *         description: Daily log not found
 *       403:
 *     description: Forbidden - MANAGER, AGRONOMIST or ADMIN only
 */
router.patch('/:id/verify', authenticate, authorize(Role.MANAGER, Role.AGRONOMIST, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const validationResult = verifyDailyLogSchema.safeParse(req.body);
    if (!validationResult.success) {
      return badRequestError(res, validationResult.error.errors.map(e => e.message).join(', '));
    }

    const { verificationStatus, notes } = validationResult.data;

    const existingLog = await prisma.workerDailyLog.findUnique({ where: { id } });
    if (!existingLog) {
      return notFoundError(res, 'Daily log not found');
    }

    const dailyLog = await prisma.workerDailyLog.update({
      where: { id },
      data: {
        verificationStatus,
        verifiedBy: user.id,
        verifiedAt: new Date(),
        observations: notes ? `${existingLog.observations || ''}\n[Verification note: ${notes}]` : existingLog.observations,
      },
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        field: {
          select: {
            id: true,
            name: true,
            cropType: true,
          },
        },
      },
    });

    logger.info({ dailyLogId: id, verificationStatus, verifiedBy: user.id }, 'Daily log verified');

    return successResponse(res, dailyLog, `Daily log ${verificationStatus.toLowerCase()} successfully`);
  } catch (error) {
    logger.error({ error, dailyLogId: req.params.id }, 'Error verifying daily log');
    return notFoundError(res, 'Daily log not found');
  }
});

/**
 * @swagger
 * /api/v1/daily-logs/{id}:
 *   get:
 *     summary: Get daily log by ID
 *     description: Get specific daily log
 *     tags: [Daily Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Daily log retrieved successfully
 *       404:
 *         description: Daily log not found
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const dailyLog = await prisma.workerDailyLog.findUnique({
      where: { id },
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        field: {
          select: {
            id: true,
            name: true,
            cropType: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!dailyLog) {
      return notFoundError(res, 'Daily log not found');
    }

    return successResponse(res, dailyLog);
  } catch (error) {
    logger.error({ error, dailyLogId: req.params.id }, 'Error fetching daily log');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/daily-logs/{id}:
 *   delete:
 *     summary: Delete daily log
 *     description: Delete daily log (ADMIN only)
 *     tags: [Daily Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Daily log deleted successfully
 *       404:
 *         description: Daily log not found
 *       403:
 *         description: Forbidden - ADMIN only
 */
router.delete('/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingLog = await prisma.workerDailyLog.findUnique({ where: { id } });
    if (!existingLog) {
      return notFoundError(res, 'Daily log not found');
    }

    await prisma.workerDailyLog.delete({ where: { id } });

    logger.info({ dailyLogId: id }, 'Daily log deleted');

    return successResponse(res, null, 'Daily log deleted successfully');
  } catch (error) {
    logger.error({ error, dailyLogId: req.params.id }, 'Error deleting daily log');
    return notFoundError(res, 'Daily log not found');
  }
});

export default router;
