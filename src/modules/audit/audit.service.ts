import prisma from '../../config/database';
import logger from '../../config/logger';

export interface AuditLogData {
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        changes: data.changes ? (data.changes as any) : {},
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
    logger.debug({ action: data.action, entity: data.entity, entityId: data.entityId }, 'Audit log created');
  } catch (error) {
    logger.error({ error, data }, 'Failed to create audit log');
  }
}

/**
 * Middleware factory for automatic audit logging on Prisma operations
 */
export function createAuditMiddleware(options: {
  entity: string;
  actions?: ('CREATE' | 'UPDATE' | 'DELETE')[];
  getIdFromResult?: (result: any) => string;
}) {
  const { entity, actions = ['CREATE', 'UPDATE', 'DELETE'] } = options;

  return {
    /**
     * Log CREATE operations
     */
    async onCreate(userId: string, result: any, ipAddress?: string, userAgent?: string): Promise<void> {
      if (!actions.includes('CREATE')) return;

      const entityId = options.getIdFromResult ? options.getIdFromResult(result) : result?.id;

      if (entityId) {
        await createAuditLog({
          userId,
          action: 'CREATE',
          entity,
          entityId,
          changes: { after: result },
          ipAddress,
          userAgent,
        });
      }
    },

    /**
     * Log UPDATE operations
     */
    async onUpdate(
      userId: string,
      entityId: string,
      before: Record<string, unknown>,
      after: Record<string, unknown>,
      ipAddress?: string,
      userAgent?: string
    ): Promise<void> {
      if (!actions.includes('UPDATE')) return;

      // Calculate changes
      const changes: Record<string, unknown> = {};
      const changedFields: Record<string, { before: unknown; after: unknown }> = {};

      Object.keys(after).forEach(key => {
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
          changedFields[key] = {
            before: before[key],
            after: after[key],
          };
        }
      });

      if (Object.keys(changedFields).length > 0) {
        await createAuditLog({
          userId,
          action: 'UPDATE',
          entity,
          entityId,
          changes: { before, after },
          ipAddress,
          userAgent,
        });
      }
    },

    /**
     * Log DELETE operations
     */
    async onDelete(userId: string, entityId: string, before: Record<string, unknown>, ipAddress?: string, userAgent?: string): Promise<void> {
      if (!actions.includes('DELETE')) return;

      await createAuditLog({
        userId,
        action: 'DELETE',
        entity,
        entityId,
        changes: { before },
        ipAddress,
        userAgent,
      });
    },
  };
}

/**
 * Pre-defined audit middleware for common entities
 */
export const auditMiddleware = {
  task: createAuditMiddleware({ entity: 'Task' }),
  field: createAuditMiddleware({ entity: 'Field' }),
  incident: createAuditMiddleware({ entity: 'Incident' }),
  soilData: createAuditMiddleware({ entity: 'SoilData' }),
  fertilizerLog: createAuditMiddleware({ entity: 'FertilizerLog' }),
  cropPlan: createAuditMiddleware({ entity: 'CropPlan' }),
  workerDailyLog: createAuditMiddleware({ entity: 'WorkerDailyLog' }),
  user: createAuditMiddleware({ entity: 'User' }),
};

export default { createAuditLog, createAuditMiddleware, auditMiddleware };
