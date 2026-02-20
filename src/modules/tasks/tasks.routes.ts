import { Router, Response } from 'express';
import prisma from '../../config/database';
import { updateTaskStatusSchema, UpdateTaskStatusInput } from '../../utils/validation';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { successResponse, notFoundError, errorResponse } from '../../utils/response';
import { Role } from '../../types/enums';
import logger from '../../config/logger';

const router = Router();

/**
 * @swagger
 * /api/v1/tasks:
 *   get:
 *     summary: List tasks
 *     description: Get all tasks, optionally filtered by status or field
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, COMPLETED]
 *       - in: query
 *         name: fieldId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of tasks
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
 *                     $ref: '#/components/schemas/Task'
 */
router.get('/', authenticate, async (req, res: Response) => {
  try {
    const { status, fieldId } = req.query;
    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (fieldId) where.fieldId = fieldId;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        field: { select: { id: true, name: true, cropType: true } },
        incident: { select: { id: true, type: true, severity: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return successResponse(res, tasks);
  } catch (error) {
    logger.error({ error }, 'Error fetching tasks');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/tasks/{id}/status:
 *   patch:
 *     summary: Update task status
 *     description: Mark task as completed (Supervisor/Admin)
 *     tags: [Tasks]
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
 *             $ref: '#/components/schemas/UpdateTaskStatusRequest'
 *     responses:
 *       200:
 *         description: Task status updated
 *       404:
 *         description: Task not found
 */
router.patch('/:id/status', authenticate, authorize(Role.SUPERVISOR, Role.ADMIN), validate(updateTaskStatusSchema), async (req, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as UpdateTaskStatusInput;

    const task = await prisma.task.update({
      where: { id },
      data: { status },
      include: {
        field: { select: { id: true, name: true } },
      },
    });

    logger.info({ taskId: id, status }, 'Task status updated');

    return successResponse(res, task);
  } catch (error) {
    logger.error({ error, taskId: req.params.id }, 'Error updating task status');
    return notFoundError(res, 'Task not found');
  }
});

export default router;
