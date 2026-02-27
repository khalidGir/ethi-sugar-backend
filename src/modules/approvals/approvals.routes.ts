import { Router, Response } from 'express';
import { AuthRequest } from '../../types/express';
import prisma from '../../config/database';
import { authenticate, authorize } from '../../middlewares/auth';
import { successResponse, notFoundError, errorResponse, badRequestError } from '../../utils/response';
import { Role, ApprovalType, ApprovalStatus } from '../../types/enums';
import logger from '../../config/logger';
import { z } from 'zod';
import { sendDecisionNotification } from '../../utils/notification';

const router = Router();

const approveSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().optional(),
});

/**
 * @swagger
 * /api/v1/approvals/pending:
 *   get:
 *     summary: Get pending approvals
 *     description: Get all items requiring approval for the current user role (MANAGER or AGRONOMIST)
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CROP_PLAN, FERTILIZER, IRRIGATION, BUDGET, DISEASE_ALERT, SOIL_DATA, AI_RECOMMENDATION]
 *     responses:
 *       200:
 *         description: List of pending approvals
 */
router.get('/pending', authenticate, authorize(Role.MANAGER, Role.AGRONOMIST, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { type } = req.query;

    const where: Record<string, unknown> = {
      status: ApprovalStatus.PENDING,
    };

    if (user.role === Role.MANAGER) {
      where.requiredRole = Role.MANAGER;
    } else if (user.role === Role.AGRONOMIST) {
      where.requiredRole = { in: [Role.AGRONOMIST, Role.MANAGER] };
    }

    if (type) {
      where.type = type;
    }

    const approvals = await prisma.approval.findMany({
      where,
      include: {
        requestedBy: {
          select: { id: true, fullName: true, email: true },
        },
        approvedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enrichedApprovals = await Promise.all(
      approvals.map(async (approval) => {
        let reference = null;
        
        switch (approval.type) {
          case ApprovalType.CROP_PLAN:
            reference = await prisma.cropPlan.findUnique({
              where: { id: approval.referenceId },
              include: { field: { select: { id: true, name: true } } },
            });
            break;
          case ApprovalType.FERTILIZER:
            reference = await prisma.fertilizerLog.findUnique({
              where: { id: approval.referenceId },
              include: { field: { select: { id: true, name: true } } },
            });
            break;
          case ApprovalType.SOIL_DATA:
            reference = await prisma.soilData.findUnique({
              where: { id: approval.referenceId },
              include: { field: { select: { id: true, name: true } } },
            });
            break;
          case ApprovalType.DISEASE_ALERT:
            reference = await prisma.incident.findUnique({
              where: { id: approval.referenceId },
              include: { field: { select: { id: true, name: true } } },
            });
            break;
        }

        return {
          ...approval,
          reference,
        };
      })
    );

    return successResponse(res, {
      approvals: enrichedApprovals,
      count: enrichedApprovals.length,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching pending approvals');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/approvals/{id}/decide:
 *   post:
 *     summary: Approve or reject an item
 *     description: Approve or reject an item requiring approval
 *     tags: [Approvals]
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
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Approval decision recorded
 */
router.post('/:id/decide', authenticate, authorize(Role.MANAGER, Role.AGRONOMIST, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const validationResult = approveSchema.safeParse(req.body);
    if (!validationResult.success) {
      return badRequestError(res, validationResult.error.errors.map(e => e.message).join(', '));
    }

    const { status, reason } = validationResult.data;

    const approval = await prisma.approval.findUnique({ where: { id } });
    if (!approval) {
      return notFoundError(res, 'Approval not found');
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      return badRequestError(res, 'This approval has already been processed');
    }

    if (user.role === Role.MANAGER && approval.requiredRole === Role.AGRONOMIST) {
      return errorResponse(res, 'You are not authorized to approve this item', 'FORBIDDEN', 403);
    }

    const updatedApproval = await prisma.approval.update({
      where: { id },
      data: {
        status,
        reason,
        approvedById: user.id,
        approvedAt: new Date(),
      },
      include: {
        requestedBy: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (status === ApprovalStatus.APPROVED) {
      switch (approval.type) {
        case ApprovalType.CROP_PLAN:
          await prisma.cropPlan.update({
            where: { id: approval.referenceId },
            data: { status: 'IN_PROGRESS' },
          });
          break;
        case ApprovalType.DISEASE_ALERT:
          await prisma.incident.update({
            where: { id: approval.referenceId },
            data: { status: 'IN_PROGRESS' },
          });
          break;
      }
    }

    logger.info({ approvalId: id, status, decidedBy: user.id }, 'Approval decision recorded');

    // Send Telegram notification to requester
    sendDecisionNotification(
      approval.type,
      approval.referenceId,
      status,
      user.fullName,
      reason
    ).catch((err) => logger.error({ err }, 'Failed to send notification'));

    return successResponse(res, updatedApproval, `Approval ${status.toLowerCase()} successfully`);
  } catch (error) {
    logger.error({ error, approvalId: req.params.id }, 'Error processing approval decision');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/approvals/history:
 *   get:
 *     summary: Get approval history
 *     description: Get approval history for the current user
 *     tags: [Approvals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Approval history
 */
router.get('/history', authenticate, authorize(Role.MANAGER, Role.AGRONOMIST, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const where = {
      OR: [
        { requestedById: user.id },
        { approvedById: user.id },
      ],
    };

    const [approvals, total] = await Promise.all([
      prisma.approval.findMany({
        where,
        include: {
          requestedBy: { select: { id: true, fullName: true, email: true } },
          approvedBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.approval.count({ where }),
    ]);

    return successResponse(res, {
      approvals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching approval history');
    return errorResponse(res);
  }
});

export default router;
