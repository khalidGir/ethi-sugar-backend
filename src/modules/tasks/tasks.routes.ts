import { Router, Response } from 'express';
import { AuthRequest } from '../../types/express';
import prisma from '../../config/database';
import { createTaskSchema, updateTaskStatusSchema, CreateTaskInput, UpdateTaskStatusInput } from '../../utils/validation';
import { validate } from '../../middlewares/validate';
import { authenticate, authorize } from '../../middlewares/auth';
import { successResponse, notFoundError, errorResponse, badRequestError } from '../../utils/response';
import { Role } from '../../types/enums';
import logger from '../../config/logger';

const router = Router();

/**
 * @swagger
 * /api/v1/tasks:
 *   post:
 *     summary: Create a new task
 *     description: Create a new task assigned to a worker (Supervisor/Admin)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTaskRequest'
 *     responses:
 *       201:
 *         description: Task created successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Field or user not found
 */
router.post('/', authenticate, authorize(Role.SUPERVISOR, Role.ADMIN), validate(createTaskSchema), async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body as CreateTaskInput;
    const userId = req.user!.id;

    const field = await prisma.field.findUnique({ where: { id: data.fieldId } });
    if (!field) {
      return notFoundError(res, 'Field not found');
    }

    if (data.assignedToId) {
      const assignedUser = await prisma.user.findUnique({ where: { id: data.assignedToId } });
      if (!assignedUser) {
        return notFoundError(res, 'Assigned user not found');
      }
      if (assignedUser.role !== Role.WORKER) {
        return badRequestError(res, 'Tasks can only be assigned to workers');
      }
    }

    const task = await prisma.task.create({
      data: {
        fieldId: data.fieldId,
        incidentId: data.incidentId,
        assignedToId: data.assignedToId,
        title: data.title,
        description: data.description,
        priority: data.priority || 'NORMAL',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
      include: {
        field: { select: { id: true, name: true, cropType: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
      },
    });

    logger.info({ taskId: task.id, assignedTo: task.assignedToId }, 'Task created');

    return successResponse(res, task, 'Task created successfully', 201);
  } catch (error) {
    logger.error({ error }, 'Error creating task');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/tasks/my:
 *   get:
 *     summary: Get my assigned tasks
 *     description: Get tasks assigned to the current worker
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of assigned tasks
 */
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (userRole === Role.WORKER) {
      const tasks = await prisma.task.findMany({
        where: { assignedToId: userId },
        include: {
          field: { select: { id: true, name: true, cropType: true } },
          incident: { select: { id: true, type: true, severity: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });
      return successResponse(res, tasks);
    }

    return badRequestError(res, 'This endpoint is for workers only');
  } catch (error) {
    logger.error({ error }, 'Error fetching my tasks');
    return errorResponse(res);
  }
});

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
 * /api/v1/tasks/overdue:
 *   get:
 *     summary: Get overdue tasks
 *     description: Get all tasks that are past their due date and still open
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of overdue tasks
 */
router.get('/overdue', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();

    const overdueTasks = await prisma.task.findMany({
      where: {
        status: 'OPEN',
        dueDate: {
          lt: now,
        },
      },
      include: {
        field: { select: { id: true, name: true, cropType: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
    });

    const overdueCount = overdueTasks.length;

    return successResponse(res, { tasks: overdueTasks, count: overdueCount });
  } catch (error) {
    logger.error({ error }, 'Error fetching overdue tasks');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/tasks/{id}/status:
 *   patch:
 *     summary: Update task status
 *     description: Mark task as completed (Supervisor/Admin or assigned Worker)
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
router.patch('/:id/status', authenticate, validate(updateTaskStatusSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as UpdateTaskStatusInput;
    const user = req.user!;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return notFoundError(res, 'Task not found');
    }

    const isAdmin = user.role === Role.ADMIN;
    const isSupervisor = user.role === Role.SUPERVISOR;
    const isAssignedWorker = user.role === Role.WORKER && task.assignedToId === user.id;

    if (!isAdmin && !isSupervisor && !isAssignedWorker) {
      return errorResponse(res, 'You are not authorized to update this task', 'FORBIDDEN', 403);
    }

    const previousStatus = task.status;
    const updateData: Record<string, unknown> = { status };

    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        field: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
    });

    await prisma.taskHistory.create({
      data: {
        taskId: id,
        previousStatus: previousStatus,
        newStatus: status,
        changedBy: user.id,
        note: status === 'COMPLETED' ? 'Task completed' : `Status changed from ${previousStatus} to ${status}`,
      },
    });

    logger.info({ taskId: id, status, updatedBy: user.id }, 'Task status updated');

    return successResponse(res, updatedTask);
  } catch (error) {
    logger.error({ error, taskId: req.params.id }, 'Error updating task status');
    return notFoundError(res, 'Task not found');
  }
});

export default router;
