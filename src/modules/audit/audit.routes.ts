import { Router, Response, NextFunction } from 'express';
import { AuthRequest } from '../../types/express';
import prisma from '../../config/database';
import { authenticate, authorize } from '../../middlewares/auth';
import { successResponse, errorResponse, badRequestError } from '../../utils/response';
import { Role } from '../../types/enums';
import logger from '../../config/logger';
import { z } from 'zod';

const router = Router();

// Validation schemas
const auditLogQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  entity: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  limit: z.string().optional(),
});

/**
 * @swagger
 * /api/v1/audit/logs:
 *   get:
 *     summary: Get audit logs
 *     description: Get audit logs with optional filters (ADMIN only)
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: entity
 *         schema:
 *           type: string
 *       - in: query
 *         name: entityId
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *       403:
 *         description: Forbidden - ADMIN only
 */
router.get('/logs', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = auditLogQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      return badRequestError(res, validationResult.error.errors.map(e => e.message).join(', '));
    }

    const { userId, entity, entityId, action, startDate, endDate, limit } = validationResult.data;

    const where: Record<string, unknown> = {};

    if (userId) where.userId = userId;
    if (entity) where.entity = entity;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
    }

    const auditLogs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit || '50'),
    });

    return successResponse(res, {
      logs: auditLogs,
      count: auditLogs.length,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching audit logs');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/audit/user/{userId}:
 *   get:
 *     summary: Get user activity audit logs
 *     description: Get all audit logs for a specific user (ADMIN only)
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: User audit logs retrieved successfully
 *       403:
 *         description: Forbidden - ADMIN only
 */
router.get('/user/:userId', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const auditLogs = await prisma.auditLog.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Calculate summary
    const actionBreakdown: Record<string, number> = {};
    const entityBreakdown: Record<string, number> = {};

    auditLogs.forEach(log => {
      actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;
      entityBreakdown[log.entity] = (entityBreakdown[log.entity] || 0) + 1;
    });

    return successResponse(res, {
      logs: auditLogs,
      count: auditLogs.length,
      summary: {
        actionBreakdown,
        entityBreakdown,
      },
    });
  } catch (error) {
    logger.error({ error, userId: req.params.userId }, 'Error fetching user audit logs');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/audit/export:
 *   get:
 *     summary: Export audit logs
 *     description: Export audit logs as JSON (ADMIN only)
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Audit logs exported successfully
 *       403:
 *         description: Forbidden - ADMIN only
 */
router.get('/export', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const where: Record<string, unknown> = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate as string);
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate as string);
    }

    const auditLogs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`);

    return res.json({
      exportedAt: new Date(),
      totalRecords: auditLogs.length,
      logs: auditLogs,
    });
  } catch (error) {
    logger.error({ error }, 'Error exporting audit logs');
    return errorResponse(res);
  }
});

export default router;
