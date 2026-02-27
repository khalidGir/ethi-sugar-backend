import { Router, Response } from 'express';
import { AuthRequest } from '../../types/express';
import prisma from '../../config/database';
import { authenticate, authorize } from '../../middlewares/auth';
import { successResponse, notFoundError, errorResponse, badRequestError } from '../../utils/response';
import { Role, FertilizerType, ApprovalType } from '../../types/enums';
import logger from '../../config/logger';
import { z } from 'zod';
import { createApprovalRequest, shouldRequireManagerApproval } from '../../utils/approval';

const router = Router();

// Validation schemas
const createFertilizerLogSchema = z.object({
  fieldId: z.string().uuid('Invalid field ID'),
  fertilizerType: z.enum(['UREA', 'DAP', 'NPS', 'COMPOST', 'MANURE', 'OTHER']),
  fertilizerName: z.string().min(1, 'Fertilizer name is required'),
  applicationRate: z.number().min(0, 'Application rate must be positive'),
  totalAmount: z.number().min(0, 'Total amount must be positive'),
  cost: z.number().min(0).optional(),
  applicationMethod: z.string().min(1, 'Application method is required'),
  growthStage: z.string().optional(),
  appliedBy: z.string().uuid('Invalid user ID').optional(),
  notes: z.string().optional(),
  appliedAt: z.string().datetime().optional(),
});

const updateFertilizerLogSchema = z.object({
  fertilizerName: z.string().min(1).optional(),
  applicationRate: z.number().min(0).optional(),
  totalAmount: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  applicationMethod: z.string().min(1).optional(),
  growthStage: z.string().optional(),
  notes: z.string().optional(),
  appliedAt: z.string().datetime().optional(),
});

/**
 * @swagger
 * /api/v1/fertilizer-logs:
 *   post:
 *     summary: Log fertilizer application
 *     description: Log fertilizer application (AGRONOMIST, SUPERVISOR only)
 *     tags: [Fertilizer Logs]
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
 *               - fertilizerType
 *               - fertilizerName
 *               - applicationRate
 *               - totalAmount
 *               - applicationMethod
 *             properties:
 *               fieldId:
 *                 type: string
 *                 format: uuid
 *               fertilizerType:
 *                 type: string
 *                 enum: [UREA, DAP, NPS, COMPOST, MANURE, OTHER]
 *               fertilizerName:
 *                 type: string
 *                 description: e.g., "Urea 46-0-0"
 *               applicationRate:
 *                 type: number
 *                 description: kg/hectare
 *               totalAmount:
 *                 type: number
 *                 description: kg used
 *               cost:
 *                 type: number
 *                 description: Cost in ETB
 *               applicationMethod:
 *                 type: string
 *                 description: e.g., "Broadcasting", "Side-dressing"
 *               growthStage:
 *                 type: string
 *                 description: e.g., "Vegetative", "Flowering"
 *               appliedBy:
 *                 type: string
 *                 format: uuid
 *               notes:
 *                 type: string
 *               appliedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Fertilizer log created successfully
 *       400:
 *         description: Validation error
 *       403:
 *     description: Forbidden - AGRONOMIST or MANAGER only
 */

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fieldId } = req.query;
    
    const where: Record<string, unknown> = {};
    if (fieldId) where.fieldId = fieldId as string;

    const logs = await prisma.fertilizerLog.findMany({
      where,
      include: {
        field: { select: { id: true, name: true, cropType: true } },
        appliedByUser: { select: { id: true, fullName: true } },
      },
      orderBy: { appliedAt: 'desc' },
    });

    return successResponse(res, logs);
  } catch (error) {
    logger.error({ error }, 'Error fetching fertilizer logs');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/fertilizer-logs/summary:
 *   get:
 *     summary: Get fertilizer summary
 *     tags: [Fertilizer Logs]
 */
router.get('/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.fertilizerLog.findMany({
      include: {
        field: { select: { id: true, name: true } },
      },
    });

    const totalApplications = logs.length;
    const totalCost = logs.reduce((sum, log) => sum + (log.cost || 0), 0);
    const totalAmount = logs.reduce((sum, log) => sum + log.totalAmount, 0);
    
    const byType = logs.reduce((acc, log) => {
      acc[log.fertilizerType] = (acc[log.fertilizerType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byField = logs.reduce((acc, log) => {
      const fieldName = log.field.name;
      acc[fieldName] = (acc[fieldName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return successResponse(res, {
      totalApplications,
      totalCost,
      totalAmount,
      byType,
      byField,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching fertilizer summary');
    return errorResponse(res);
  }
});

router.post('/', authenticate, authorize(Role.AGRONOMIST, Role.MANAGER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = createFertilizerLogSchema.safeParse(req.body);
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

    // Use authenticated user's ID if appliedBy not provided
    const appliedBy = data.appliedBy || user.id;

    // Validate appliedBy user exists
    const appliedByUser = await prisma.user.findUnique({ where: { id: appliedBy } });
    if (!appliedByUser) {
      return notFoundError(res, 'User not found');
    }

    const fertilizerLog = await prisma.fertilizerLog.create({
      data: {
        fieldId: data.fieldId,
        fertilizerType: data.fertilizerType as FertilizerType,
        fertilizerName: data.fertilizerName,
        applicationRate: data.applicationRate,
        totalAmount: data.totalAmount,
        cost: data.cost,
        applicationMethod: data.applicationMethod,
        growthStage: data.growthStage,
        appliedBy,
        notes: data.notes,
        appliedAt: data.appliedAt ? new Date(data.appliedAt) : new Date(),
      },
      include: {
        field: {
          select: {
            id: true,
            name: true,
            cropType: true,
          },
        },
        appliedByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    // Create approval request for high-cost fertilizer applications
    if (data.cost) {
      const approvalCheck = await shouldRequireManagerApproval(ApprovalType.FERTILIZER, data.cost);
      if (approvalCheck.required) {
        await createApprovalRequest({
          type: ApprovalType.FERTILIZER,
          referenceId: fertilizerLog.id,
          requestedById: user.id,
          requiredRole: approvalCheck.role,
          reason: approvalCheck.reason,
        });
        logger.info({ fertilizerLogId: fertilizerLog.id }, 'Approval request created for fertilizer application');
      }
    }

    logger.info({ fertilizerLogId: fertilizerLog.id, fieldId: data.fieldId }, 'Fertilizer log created');

    return successResponse(res, fertilizerLog, 'Fertilizer log created successfully', 201);
  } catch (error) {
    logger.error({ error }, 'Error creating fertilizer log');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/fertilizer-logs/field/{fieldId}:
 *   get:
 *     summary: Get field fertilizer history
 *     description: Get fertilizer application history for a specific field
 *     tags: [Fertilizer Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fieldId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Field fertilizer history retrieved successfully
 */
router.get('/field/:fieldId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fieldId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    // Validate field exists
    const field = await prisma.field.findUnique({ where: { id: fieldId } });
    if (!field) {
      return notFoundError(res, 'Field not found');
    }

    const fertilizerLogs = await prisma.fertilizerLog.findMany({
      where: { fieldId },
      orderBy: { appliedAt: 'desc' },
      take: limit,
      include: {
        field: {
          select: {
            id: true,
            name: true,
            cropType: true,
          },
        },
        appliedByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    // Calculate summary
    const totalCost = fertilizerLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
    const totalAmount = fertilizerLogs.reduce((sum, log) => sum + log.totalAmount, 0);

    // Group by fertilizer type
    const byType: Record<string, { count: number; totalAmount: number; totalCost: number }> = {};
    fertilizerLogs.forEach(log => {
      if (!byType[log.fertilizerType]) {
        byType[log.fertilizerType] = { count: 0, totalAmount: 0, totalCost: 0 };
      }
      byType[log.fertilizerType].count += 1;
      byType[log.fertilizerType].totalAmount += log.totalAmount;
      byType[log.fertilizerType].totalCost += log.cost || 0;
    });

    return successResponse(res, {
      logs: fertilizerLogs,
      count: fertilizerLogs.length,
      summary: {
        totalCost: Math.round(totalCost * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        byType,
      },
    });
  } catch (error) {
    logger.error({ error, fieldId: req.params.fieldId }, 'Error fetching fertilizer history');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/fertilizer-logs/recommendations:
 *   get:
 *     summary: Get AI-based fertilizer recommendations
 *     description: Get fertilizer recommendations based on soil data, crop type, and growth stage
 *     tags: [Fertilizer Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fieldId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Fertilizer recommendations retrieved successfully
 */
router.get('/recommendations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fieldId } = req.query;

    const recommendations: any[] = [];

    if (fieldId) {
      // Get latest soil data for the field
      const latestSoilData = await prisma.soilData.findFirst({
        where: { fieldId: fieldId as string },
        orderBy: { analyzedAt: 'desc' },
      });

      const field = await prisma.field.findUnique({
        where: { id: fieldId as string },
      });

      if (latestSoilData && field) {
        // Nitrogen recommendation
        if (latestSoilData.nitrogen < 20) {
          recommendations.push({
            nutrient: 'Nitrogen',
            recommendation: 'Apply nitrogen-rich fertilizer (UREA or DAP)',
            reason: `Low nitrogen level detected: ${latestSoilData.nitrogen} ppm`,
            priority: 'HIGH',
          });
        }

        // Phosphorus recommendation
        if (latestSoilData.phosphorus < 10) {
          recommendations.push({
            nutrient: 'Phosphorus',
            recommendation: 'Apply phosphorus-rich fertilizer (DAP or NPS)',
            reason: `Low phosphorus level detected: ${latestSoilData.phosphorus} ppm`,
            priority: 'HIGH',
          });
        }

        // Potassium recommendation
        if (latestSoilData.potassium < 150) {
          recommendations.push({
            nutrient: 'Potassium',
            recommendation: 'Apply potassium-rich fertilizer',
            reason: `Low potassium level detected: ${latestSoilData.potassium} ppm`,
            priority: 'MEDIUM',
          });
        }

        // pH recommendation
        if (latestSoilData.pH < 6) {
          recommendations.push({
            nutrient: 'pH Adjustment',
            recommendation: 'Apply lime to raise soil pH',
            reason: `Soil is acidic: pH ${latestSoilData.pH}`,
            priority: 'MEDIUM',
          });
        } else if (latestSoilData.pH > 7.5) {
          recommendations.push({
            nutrient: 'pH Adjustment',
            recommendation: 'Apply sulfur or organic matter to lower soil pH',
            reason: `Soil is alkaline: pH ${latestSoilData.pH}`,
            priority: 'MEDIUM',
          });
        }

        // Crop-specific recommendations
        if (field.cropType.toLowerCase().includes('maize') || field.cropType.toLowerCase().includes('sugarcane')) {
          recommendations.push({
            nutrient: 'General',
            recommendation: `${field.cropType} typically requires high nitrogen. Consider split application.`,
            reason: `Crop type: ${field.cropType}`,
            priority: 'LOW',
          });
        }
      }
    }

    if (recommendations.length === 0) {
      return successResponse(res, {
        recommendations: [],
        message: fieldId ? 'No specific recommendations. Soil nutrients appear adequate.' : 'Provide fieldId parameter for specific recommendations.',
        generalTips: [
          'Regular soil testing is recommended every 3-6 months',
          'Apply fertilizers during optimal growth stages',
          'Consider split applications for better nutrient uptake',
          'Monitor weather conditions before fertilizer application',
        ],
      });
    }

    return successResponse(res, {
      recommendations,
      fieldId,
      generatedAt: new Date(),
    });
  } catch (error) {
    logger.error({ error }, 'Error generating fertilizer recommendations');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/fertilizer-logs/{id}:
 *   get:
 *     summary: Get fertilizer log by ID
 *     description: Get specific fertilizer log
 *     tags: [Fertilizer Logs]
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
 *         description: Fertilizer log retrieved successfully
 *       404:
 *         description: Fertilizer log not found
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const fertilizerLog = await prisma.fertilizerLog.findUnique({
      where: { id },
      include: {
        field: {
          select: {
            id: true,
            name: true,
            cropType: true,
          },
        },
        appliedByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!fertilizerLog) {
      return notFoundError(res, 'Fertilizer log not found');
    }

    return successResponse(res, fertilizerLog);
  } catch (error) {
    logger.error({ error, fertilizerLogId: req.params.id }, 'Error fetching fertilizer log');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/fertilizer-logs/{id}:
 *   patch:
 *     summary: Update fertilizer log
 *     description: Update fertilizer log (AGRONOMIST, SUPERVISOR only)
 *     tags: [Fertilizer Logs]
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
 *               fertilizerName:
 *                 type: string
 *               applicationRate:
 *                 type: number
 *               totalAmount:
 *                 type: number
 *               cost:
 *                 type: number
 *               applicationMethod:
 *                 type: string
 *               growthStage:
 *                 type: string
 *               notes:
 *                 type: string
 *               appliedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Fertilizer log updated successfully
 *       404:
 *         description: Fertilizer log not found
 *       403:
 *     description: Forbidden - AGRONOMIST or MANAGER only
 */
router.patch('/:id', authenticate, authorize(Role.AGRONOMIST, Role.MANAGER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const validationResult = updateFertilizerLogSchema.safeParse(req.body);
    if (!validationResult.success) {
      return badRequestError(res, validationResult.error.errors.map(e => e.message).join(', '));
    }

    const data = validationResult.data;

    const existingLog = await prisma.fertilizerLog.findUnique({ where: { id } });
    if (!existingLog) {
      return notFoundError(res, 'Fertilizer log not found');
    }

    const fertilizerLog = await prisma.fertilizerLog.update({
      where: { id },
      data: {
        ...data,
        appliedAt: data.appliedAt ? new Date(data.appliedAt) : undefined,
      },
      include: {
        field: {
          select: {
            id: true,
            name: true,
            cropType: true,
          },
        },
        appliedByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    logger.info({ fertilizerLogId: id }, 'Fertilizer log updated');

    return successResponse(res, fertilizerLog, 'Fertilizer log updated successfully');
  } catch (error) {
    logger.error({ error, fertilizerLogId: req.params.id }, 'Error updating fertilizer log');
    return notFoundError(res, 'Fertilizer log not found');
  }
});

/**
 * @swagger
 * /api/v1/fertilizer-logs/{id}:
 *   delete:
 *     summary: Delete fertilizer log
 *     description: Delete fertilizer log (ADMIN only)
 *     tags: [Fertilizer Logs]
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
 *         description: Fertilizer log deleted successfully
 *       404:
 *         description: Fertilizer log not found
 *       403:
 *         description: Forbidden - ADMIN only
 */
router.delete('/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingLog = await prisma.fertilizerLog.findUnique({ where: { id } });
    if (!existingLog) {
      return notFoundError(res, 'Fertilizer log not found');
    }

    await prisma.fertilizerLog.delete({ where: { id } });

    logger.info({ fertilizerLogId: id }, 'Fertilizer log deleted');

    return successResponse(res, null, 'Fertilizer log deleted successfully');
  } catch (error) {
    logger.error({ error, fertilizerLogId: req.params.id }, 'Error deleting fertilizer log');
    return notFoundError(res, 'Fertilizer log not found');
  }
});

export default router;
