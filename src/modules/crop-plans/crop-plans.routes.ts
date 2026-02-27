import { Router, Response } from 'express';
import { AuthRequest } from '../../types/express';
import prisma from '../../config/database';
import { authenticate, authorize } from '../../middlewares/auth';
import { successResponse, notFoundError, errorResponse, badRequestError } from '../../utils/response';
import { Role, CropPlanStatus, ApprovalType } from '../../types/enums';
import logger from '../../config/logger';
import { z } from 'zod';
import { createApprovalRequest, shouldRequireManagerApproval } from '../../utils/approval';

const router = Router();

// Validation schemas
const createCropPlanSchema = z.object({
  fieldId: z.string().uuid('Invalid field ID'),
  season: z.string().min(1, 'Season is required'),
  cropType: z.string().min(1, 'Crop type is required'),
  cropVariety: z.string().optional(),
  plannedArea: z.number().min(0, 'Planned area must be positive'),
  plantedArea: z.number().min(0).optional(),
  plantingDate: z.string().datetime('Invalid planting date'),
  expectedHarvestDate: z.string().datetime('Invalid expected harvest date'),
  targetYield: z.number().min(0).optional(),
  budget: z.number().min(0).optional(),
  createdBy: z.string().uuid('Invalid user ID').optional(),
});

const updateCropPlanSchema = z.object({
  plantedArea: z.number().min(0).optional(),
  targetYield: z.number().min(0).optional(),
  actualYield: z.number().min(0).optional(),
  budget: z.number().min(0).optional(),
  actualCost: z.number().min(0).optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED']).optional(),
  cropVariety: z.string().optional(),
  expectedHarvestDate: z.string().datetime().optional(),
});

/*
/**
 * @swagger
 * /api/v1/crop-plans:
 *   post:
 *     summary: Create seasonal crop plan
 *     description: Create a new seasonal crop plan (MANAGER, AGRONOMIST only)
 *     tags: [Crop Plans]
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
 *               - season
 *               - cropType
 *               - plannedArea
 *               - plantingDate
 *               - expectedHarvestDate
 *             properties:
 *               fieldId:
 *                 type: string
 *                 format: uuid
 *               season:
 *                 type: string
 *                 description: e.g., "2026 BelG", "2026 Meher"
 *               cropType:
 *                 type: string
 *               cropVariety:
 *                 type: string
 *                 description: e.g., "Maize - BH660"
 *               plannedArea:
 *                 type: number
 *                 description: hectares
 *               plantedArea:
 *                 type: number
 *                 description: hectares
 *               plantingDate:
 *                 type: string
 *                 format: date-time
 *               expectedHarvestDate:
 *                 type: string
 *                 format: date-time
 *               targetYield:
 *                 type: number
 *                 description: tons/hectare
 *               budget:
 *                 type: number
 *                 description: planned budget in ETB
 *               createdBy:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Crop plan created successfully
 *       400:
 *         description: Validation error
 *       403:
 *     description: Forbidden - MANAGER or AGRONOMIST only
 */

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { season, status } = req.query;
    
    const where: Record<string, unknown> = {};
    if (season) where.season = season as string;
    if (status) where.status = status as string;

    const cropPlans = await prisma.cropPlan.findMany({
      where,
      include: {
        field: { select: { id: true, name: true, cropType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(res, cropPlans);
  } catch (error) {
    logger.error({ error }, 'Error fetching crop plans');
    return errorResponse(res);
  }
});

router.get('/progress', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const cropPlans = await prisma.cropPlan.findMany({
      include: {
        field: { select: { id: true, name: true } },
      },
      orderBy: { plantingDate: 'asc' },
    });

    const progress = cropPlans.map(plan => {
      const plantingDate = new Date(plan.plantingDate);
      const expectedHarvest = new Date(plan.expectedHarvestDate);
      const today = new Date();
      const totalDays = Math.ceil((expectedHarvest.getTime() - plantingDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysElapsed = Math.ceil((today.getTime() - plantingDate.getTime()) / (1000 * 60 * 60 * 24));
      const progressPercentage = Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100));

      return {
        planId: plan.id,
        fieldName: plan.field.name,
        cropType: plan.cropType,
        status: plan.status,
        daysElapsed,
        daysRemaining: Math.max(0, totalDays - daysElapsed),
        progressPercentage: Math.round(progressPercentage),
        yieldVariance: plan.targetYield && plan.actualYield 
          ? ((plan.actualYield - plan.targetYield) / plan.targetYield) * 100 
          : 0,
        budgetVariance: plan.budget && plan.actualCost 
          ? ((plan.actualCost - plan.budget) / plan.budget) * 100 
          : 0,
      };
    });

    return successResponse(res, progress);
  } catch (error) {
    logger.error({ error }, 'Error fetching crop plan progress');
    return errorResponse(res);
  }
});

router.post('/', authenticate, authorize(Role.MANAGER, Role.AGRONOMIST, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = createCropPlanSchema.safeParse(req.body);
    if (!validationResult.success) {
      return badRequestError(res, validationResult.error.errors.map(e => e.message).join(', '));
    }

    const data = validationResult.data;
    const user = req.user!;

    // Validate field exists
    const field = await prisma.field.findUnique({ where: { id: data.fieldId } });
    if (!field) {
      return notFoundError(res, 'Field not found');
    }

    const cropPlan = await prisma.cropPlan.create({
      data: {
        fieldId: data.fieldId,
        season: data.season,
        cropType: data.cropType,
        cropVariety: data.cropVariety,
        plannedArea: data.plannedArea,
        plantedArea: data.plantedArea,
        plantingDate: new Date(data.plantingDate),
        expectedHarvestDate: new Date(data.expectedHarvestDate),
        targetYield: data.targetYield,
        budget: data.budget,
        createdBy: user.id,
        status: 'PLANNED',
      },
      include: {
        field: {
          select: {
            id: true,
            name: true,
            cropType: true,
          },
        },
      },
    });

    // Create approval request for the crop plan
    const approvalCheck = await shouldRequireManagerApproval(ApprovalType.CROP_PLAN, data.budget);
    if (approvalCheck.required) {
      await createApprovalRequest({
        type: ApprovalType.CROP_PLAN,
        referenceId: cropPlan.id,
        requestedById: user.id,
        requiredRole: approvalCheck.role,
        reason: approvalCheck.reason,
      });
      logger.info({ cropPlanId: cropPlan.id }, 'Approval request created for crop plan');
    }

    logger.info({ cropPlanId: cropPlan.id, fieldId: data.fieldId, season: data.season }, 'Crop plan created');

    return successResponse(res, cropPlan, 'Crop plan created successfully', 201);
  } catch (error) {
    logger.error({ error }, 'Error creating crop plan');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/crop-plans/season/{season}:
 *   get:
 *     summary: Get crop plans for a season
 *     description: Get all crop plans for a specific season
 *     tags: [Crop Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: season
 *         required: true
 *         schema:
 *           type: string
 *           description: e.g., "2026 BelG"
 *       - in: query
 *         name: fieldId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PLANNED, IN_PROGRESS, COMPLETED, ABANDONED]
 *     responses:
 *       200:
 *         description: Crop plans retrieved successfully
 */
router.get('/season/:season', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { season } = req.params;
    const { fieldId, status } = req.query;

    const where: Record<string, unknown> = { season };

    if (fieldId) {
      where.fieldId = fieldId as string;
    }

    if (status) {
      where.status = status as CropPlanStatus;
    }

    const cropPlans = await prisma.cropPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        field: {
          select: {
            id: true,
            name: true,
            cropType: true,
          },
        },
      },
    });

    // Calculate season summary
    const totalPlannedArea = cropPlans.reduce((sum, plan) => sum + plan.plannedArea, 0);
    const totalPlantedArea = cropPlans.reduce((sum, plan) => sum + (plan.plantedArea || 0), 0);
    const totalBudget = cropPlans.reduce((sum, plan) => sum + (plan.budget || 0), 0);
    const totalActualCost = cropPlans.reduce((sum, plan) => sum + (plan.actualCost || 0), 0);

    const statusBreakdown: Record<string, number> = {};
    cropPlans.forEach(plan => {
      statusBreakdown[plan.status] = (statusBreakdown[plan.status] || 0) + 1;
    });

    return successResponse(res, {
      plans: cropPlans,
      count: cropPlans.length,
      season,
      summary: {
        totalPlannedArea: Math.round(totalPlannedArea * 100) / 100,
        totalPlantedArea: Math.round(totalPlantedArea * 100) / 100,
        totalBudget: Math.round(totalBudget * 100) / 100,
        totalActualCost: Math.round(totalActualCost * 100) / 100,
        statusBreakdown,
      },
    });
  } catch (error) {
    logger.error({ error, season: req.params.season }, 'Error fetching crop plans');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/crop-plans/analytics:
 *   get:
 *     summary: Get seasonal performance analytics
 *     description: Get crop plan analytics and performance metrics
 *     tags: [Crop Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: season
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Crop plan analytics retrieved successfully
 */
router.get('/analytics', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { season } = req.query;

    const where: Record<string, unknown> = {};
    if (season) {
      where.season = season as string;
    }

    const cropPlans = await prisma.cropPlan.findMany({
      where,
      include: {
        field: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (cropPlans.length === 0) {
      return successResponse(res, {
        totalPlans: 0,
        message: 'No crop plans found',
      });
    }

    // Calculate metrics
    const completedPlans = cropPlans.filter(p => p.status === 'COMPLETED');
    const inProgressPlans = cropPlans.filter(p => p.status === 'IN_PROGRESS');
    const abandonedPlans = cropPlans.filter(p => p.status === 'ABANDONED');

    // Yield analysis (only for completed plans with actual yield)
    const yieldAnalysis = completedPlans
      .filter(p => p.actualYield && p.targetYield)
      .map(p => ({
        fieldId: p.fieldId,
        fieldName: p.field.name,
        targetYield: p.targetYield!,
        actualYield: p.actualYield!,
        achievementRate: Math.round((p.actualYield! / p.targetYield!) * 100),
      }));

    const avgYieldAchievement = yieldAnalysis.length > 0
      ? Math.round(yieldAnalysis.reduce((sum, y) => sum + y.achievementRate, 0) / yieldAnalysis.length)
      : null;

    // Budget analysis
    const budgetAnalysis = cropPlans
      .filter(p => p.budget && p.actualCost)
      .map(p => ({
        fieldId: p.fieldId,
        fieldName: p.field.name,
        budget: p.budget!,
        actualCost: p.actualCost!,
        variance: Math.round((p.actualCost! - p.budget!) * 100) / 100,
        variancePercent: Math.round(((p.actualCost! - p.budget!) / p.budget!) * 100),
      }));

    const totalBudget = cropPlans.reduce((sum, p) => sum + (p.budget || 0), 0);
    const totalActualCost = cropPlans.reduce((sum, p) => sum + (p.actualCost || 0), 0);
    const overallBudgetVariance = Math.round(((totalActualCost - totalBudget) / (totalBudget || 1)) * 100);

    // Insights
    const insights: string[] = [];
    if (avgYieldAchievement && avgYieldAchievement >= 100) {
      insights.push(`Excellent yield performance: ${avgYieldAchievement}% of target achieved`);
    } else if (avgYieldAchievement && avgYieldAchievement < 80) {
      insights.push(`Yield below target: ${avgYieldAchievement}% of target. Review farming practices.`);
    }
    if (overallBudgetVariance > 10) {
      insights.push(`Budget overrun: ${overallBudgetVariance}% over planned budget`);
    } else if (overallBudgetVariance < -10) {
      insights.push(`Under budget: ${Math.abs(overallBudgetVariance)}% under planned budget`);
    }
    if (abandonedPlans.length > 0) {
      insights.push(`${abandonedPlans.length} plan(s) abandoned - review causes`);
    }

    return successResponse(res, {
      period: season || 'All seasons',
      totalPlans: cropPlans.length,
      statusBreakdown: {
        planned: cropPlans.filter(p => p.status === 'PLANNED').length,
        inProgress: inProgressPlans.length,
        completed: completedPlans.length,
        abandoned: abandonedPlans.length,
      },
      yieldAnalysis: {
        plansAnalyzed: yieldAnalysis.length,
        averageAchievementRate: avgYieldAchievement,
        details: yieldAnalysis,
      },
      budgetAnalysis: {
        totalBudget: Math.round(totalBudget * 100) / 100,
        totalActualCost: Math.round(totalActualCost * 100) / 100,
        overallVariancePercent: overallBudgetVariance,
        details: budgetAnalysis,
      },
      insights,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching crop plan analytics');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/crop-plans/{id}:
 *   get:
 *     summary: Get crop plan by ID
 *     description: Get specific crop plan
 *     tags: [Crop Plans]
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
 *         description: Crop plan retrieved successfully
 *       404:
 *         description: Crop plan not found
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const cropPlan = await prisma.cropPlan.findUnique({
      where: { id },
      include: {
        field: {
          select: {
            id: true,
            name: true,
            cropType: true,
          },
        },
      },
    });

    if (!cropPlan) {
      return notFoundError(res, 'Crop plan not found');
    }

    return successResponse(res, cropPlan);
  } catch (error) {
    logger.error({ error, cropPlanId: req.params.id }, 'Error fetching crop plan');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/crop-plans/{id}:
 *   patch:
 *     summary: Update crop plan
 *     description: Update crop plan (add actual yield, cost, status) (MANAGER, AGRONOMIST only)
 *     tags: [Crop Plans]
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
 *               plantedArea:
 *                 type: number
 *               targetYield:
 *                 type: number
 *               actualYield:
 *                 type: number
 *               budget:
 *                 type: number
 *               actualCost:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [PLANNED, IN_PROGRESS, COMPLETED, ABANDONED]
 *               cropVariety:
 *                 type: string
 *               expectedHarvestDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Crop plan updated successfully
 *       404:
 *         description: Crop plan not found
 *       403:
 *         description: Forbidden - MANAGER or AGRONOMIST only
 */
router.patch('/:id', authenticate, authorize(Role.MANAGER, Role.AGRONOMIST, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const validationResult = updateCropPlanSchema.safeParse(req.body);
    if (!validationResult.success) {
      return badRequestError(res, validationResult.error.errors.map(e => e.message).join(', '));
    }

    const data = validationResult.data;

    const existingPlan = await prisma.cropPlan.findUnique({ where: { id } });
    if (!existingPlan) {
      return notFoundError(res, 'Crop plan not found');
    }

    const cropPlan = await prisma.cropPlan.update({
      where: { id },
      data: {
        ...data,
        expectedHarvestDate: data.expectedHarvestDate ? new Date(data.expectedHarvestDate) : undefined,
      },
      include: {
        field: {
          select: {
            id: true,
            name: true,
            cropType: true,
          },
        },
      },
    });

    logger.info({ cropPlanId: id, status: data.status }, 'Crop plan updated');

    return successResponse(res, cropPlan, 'Crop plan updated successfully');
  } catch (error) {
    logger.error({ error, cropPlanId: req.params.id }, 'Error updating crop plan');
    return notFoundError(res, 'Crop plan not found');
  }
});

/**
 * @swagger
 * /api/v1/crop-plans/{id}:
 *   delete:
 *     summary: Delete crop plan
 *     description: Delete crop plan (ADMIN only)
 *     tags: [Crop Plans]
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
 *         description: Crop plan deleted successfully
 *       404:
 *         description: Crop plan not found
 *       403:
 *         description: Forbidden - ADMIN only
 */
router.delete('/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingPlan = await prisma.cropPlan.findUnique({ where: { id } });
    if (!existingPlan) {
      return notFoundError(res, 'Crop plan not found');
    }

    await prisma.cropPlan.delete({ where: { id } });

    logger.info({ cropPlanId: id }, 'Crop plan deleted');

    return successResponse(res, null, 'Crop plan deleted successfully');
  } catch (error) {
    logger.error({ error, cropPlanId: req.params.id }, 'Error deleting crop plan');
    return notFoundError(res, 'Crop plan not found');
  }
});

export default router;
