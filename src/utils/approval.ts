import prisma from '../config/database';
import { ApprovalType, Role, ApprovalStatus } from '../types/enums';
import logger from '../config/logger';
import { sendApprovalNotification } from './notification';

export interface ApprovalDecision {
  type: ApprovalType;
  referenceId: string;
  requestedById: string;
  requiredRole: Role;
  confidenceScore?: number;
  reason?: string;
}

export const createApprovalRequest = async (decision: ApprovalDecision) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: decision.requestedById },
      select: { fullName: true }
    });

    const approval = await prisma.approval.create({
      data: {
        type: decision.type,
        referenceId: decision.referenceId,
        requestedById: decision.requestedById,
        requiredRole: decision.requiredRole,
        confidenceScore: decision.confidenceScore,
        reason: decision.reason,
        status: ApprovalStatus.PENDING,
      },
    });

    logger.info({ approvalId: approval.id, type: decision.type }, 'Approval request created');

    // Send Telegram notification
    sendApprovalNotification(
      decision.type,
      decision.referenceId,
      user?.fullName || 'Unknown'
    ).catch((err) => logger.error({ err }, 'Failed to send notification'));

    return approval;
  } catch (error) {
    logger.error({ error, ...decision }, 'Failed to create approval request');
    throw error;
  }
};

export const shouldRequireManagerApproval = async (
  type: ApprovalType,
  cost?: number
): Promise<{ required: boolean; role: Role; reason?: string }> => {
  switch (type) {
    case ApprovalType.CROP_PLAN:
      return { required: true, role: Role.MANAGER, reason: 'New crop plan requires approval' };
    case ApprovalType.FERTILIZER:
      if (cost && cost > 50000) {
        return { required: true, role: Role.MANAGER, reason: `High cost fertilizer application (${cost} ETB)` };
      }
      return { required: false, role: Role.AGRONOMIST };
    case ApprovalType.BUDGET:
      return { required: true, role: Role.MANAGER, reason: 'Budget allocation requires approval' };
    case ApprovalType.DISEASE_ALERT:
      return { required: true, role: Role.AGRONOMIST, reason: 'Disease alert requires agronomist validation' };
    case ApprovalType.AI_RECOMMENDATION:
      return { required: true, role: Role.MANAGER, reason: 'AI recommendation requires review' };
    default:
      return { required: false, role: Role.AGRONOMIST };
  }
};

export const approveItem = async (
  approvalId: string,
  status: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED,
  approvedById: string,
  reason?: string
) => {
  return prisma.$transaction(async (tx) => {
    const approval = await tx.approval.update({
      where: { id: approvalId },
      data: {
        status,
        reason,
        approvedById,
        approvedAt: new Date(),
      },
    });

    if (status === ApprovalStatus.APPROVED) {
      switch (approval.type) {
        case ApprovalType.CROP_PLAN:
          await tx.cropPlan.update({
            where: { id: approval.referenceId },
            data: { status: 'IN_PROGRESS' },
          });
          break;
        case ApprovalType.DISEASE_ALERT:
          await tx.incident.update({
            where: { id: approval.referenceId },
            data: { status: 'IN_PROGRESS' },
          });
          break;
      }
    }

    logger.info({ approvalId, status, approvedById }, 'Approval decision recorded');
    return approval;
  });
};
