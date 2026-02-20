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

export default router;
