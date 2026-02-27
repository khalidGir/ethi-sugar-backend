import { Router, Response } from 'express';
import prisma from '../../config/database';
import { updateUserSchema, UpdateUserInput } from '../../utils/validation';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { successResponse, notFoundError, errorResponse } from '../../utils/response';
import { Role } from '../../types/enums';
import logger from '../../config/logger';

const router = Router();

/**
 * @swagger
 * /api/v1/users/summary:
 *   get:
 *     summary: Dashboard summary
 *     description: Get dashboard summary statistics
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary
 */
router.get('/summary', authenticate, async (req, res: Response) => {
  try {
    const [totalFields, totalIncidents, openIncidents, pendingTasks, completedTasks] = await Promise.all([
      prisma.field.count(),
      prisma.incident.count(),
      prisma.incident.count({ where: { status: 'OPEN' } }),
      prisma.task.count({ where: { status: 'OPEN' } }),
      prisma.task.count({ where: { status: 'COMPLETED' } }),
    ]);

    return successResponse(res, {
      totalFields,
      totalIncidents,
      openIncidents,
      pendingTasks,
      completedTasks,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching dashboard summary');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: List all users
 *     description: Get all registered users (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
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
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, authorize(Role.ADMIN), async (req, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(res, users);
  } catch (error) {
    logger.error({ error }, 'Error fetching users');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/users/{id}:
 *   patch:
 *     summary: Update user
 *     description: Update user details (Admin only)
 *     tags: [Users]
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
 *             properties:
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ADMIN, SUPERVISOR, WORKER]
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated
 *       404:
 *         description: User not found
 */
router.patch('/:id', authenticate, authorize(Role.ADMIN), validate(updateUserSchema), async (req, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body as UpdateUserInput;

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    logger.info({ userId: id }, 'User updated');

    return successResponse(res, user);
  } catch (error) {
    logger.error({ error, userId: req.params.id }, 'Error updating user');
    return notFoundError(res, 'User not found');
  }
});

/**
 * @swagger
 * /api/v1/users/{id}:
 *   delete:
 *     summary: Deactivate user
 *     description: Deactivate a user account (Admin only)
 *     tags: [Users]
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
 *         description: User deactivated
 *       404:
 *         description: User not found
 */
router.delete('/:id', authenticate, authorize(Role.ADMIN), async (req, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info({ userId: id }, 'User deactivated');

    return successResponse(res, undefined, 'User deactivated successfully');
  } catch (error) {
    logger.error({ error, userId: req.params.id }, 'Error deactivating user');
    return notFoundError(res, 'User not found');
  }
});

/**
 * @swagger
 * /api/v1/users/notifications:
 *   get:
 *     summary: List notification logs
 *     description: Get all notification logs (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *         description: Filter by event type
 *     responses:
 *       200:
 *         description: List of notification logs
 *       401:
 *         description: Unauthorized
 */
router.get('/notifications', authenticate, authorize(Role.ADMIN), async (req, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const eventType = req.query.eventType as string | undefined;

    const skip = (page - 1) * limit;
    const where = eventType ? { eventType } : {};

    const [notifications, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notificationLog.count({ where }),
    ]);

    return successResponse(res, {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching notification logs');
    return errorResponse(res);
  }
});

export default router;
