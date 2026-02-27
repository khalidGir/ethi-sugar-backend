import prisma from '../config/database';
import { ApprovalType, Role } from '../types/enums';

export interface CreateApprovalInput {
  type: ApprovalType;
  referenceId: string;
  requestedById: string;
  requiredRole: Role;
  confidenceScore?: number;
  reason?: string;
}

export const createApproval = async (input: CreateApprovalInput) => {
  return prisma.approval.create({
    data: input,
  });
};

export const getPendingApprovals = async (role: Role, type?: ApprovalType) => {
  const where: Record<string, unknown> = {
    status: 'PENDING',
    requiredRole: role,
  };

  if (type) {
    where.type = type;
  }

  return prisma.approval.findMany({
    where,
    include: {
      requestedBy: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const processApproval = async (
  approvalId: string,
  status: 'APPROVED' | 'REJECTED',
  approverId: string,
  reason?: string
) => {
  return prisma.$transaction(async (tx) => {
    const approval = await tx.approval.update({
      where: { id: approvalId },
      data: {
        status,
        reason,
        approvedById: approverId,
        approvedAt: new Date(),
      },
    });

    if (status === 'APPROVED') {
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

    return approval;
  });
};

export const shouldRequireApproval = async (
  type: ApprovalType,
  referenceId: string,
  confidenceScore?: number
): Promise<{ required: boolean; role: Role; reason?: string }> => {
  switch (type) {
    case ApprovalType.CROP_PLAN:
      return { required: true, role: Role.MANAGER };
    case ApprovalType.FERTILIZER:
      const fertilizer = await prisma.fertilizerLog.findUnique({
        where: { id: referenceId },
      });
      if (fertilizer && fertilizer.cost && fertilizer.cost > 50000) {
        return { required: true, role: Role.MANAGER, reason: 'High cost fertilizer application' };
      }
      return { required: false, role: Role.AGRONOMIST };
    case ApprovalType.DISEASE_ALERT:
      return { required: true, role: Role.AGRONOMIST };
    case ApprovalType.AI_RECOMMENDATION:
      if (confidenceScore && confidenceScore >= 90) {
        return { required: false, role: Role.AGRONOMIST };
      }
      return { required: true, role: Role.MANAGER, reason: 'AI confidence below threshold' };
    case ApprovalType.BUDGET:
      return { required: true, role: Role.MANAGER };
    default:
      return { required: false, role: Role.AGRONOMIST };
  }
};
