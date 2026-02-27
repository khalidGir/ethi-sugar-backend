import { Router, Response } from 'express';
import { AuthRequest } from '../../types/express';
import prisma from '../../config/database';
import { authenticate, authorize } from '../../middlewares/auth';
import { successResponse, notFoundError, errorResponse, badRequestError } from '../../utils/response';
import { Role } from '../../types/enums';
import logger from '../../config/logger';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createSoilDataSchema = z.object({
  fieldId: z.string().uuid('Invalid field ID'),
  nitrogen: z.number().min(0, 'Nitrogen must be positive'),
  phosphorus: z.number().min(0, 'Phosphorus must be positive'),
  potassium: z.number().min(0, 'Potassium must be positive'),
  pH: z.number().min(0).max(14, 'pH must be between 0 and 14'),
  organicMatter: z.number().min(0).max(100).optional(),
  electricalConductivity: z.number().min(0).optional(),
  soilType: z.string().optional(),
  sampleDepth: z.number().min(0).optional(),
  analyzedAt: z.string().datetime().optional(),
  labReportUrl: z.string().url().optional().or(z.literal('')),
  analyzedBy: z.string().optional(),
});

const updateSoilDataSchema = z.object({
  nitrogen: z.number().min(0).optional(),
  phosphorus: z.number().min(0).optional(),
  potassium: z.number().min(0).optional(),
  pH: z.number().min(0).max(14).optional(),
  organicMatter: z.number().min(0).max(100).optional(),
  electricalConductivity: z.number().min(0).optional(),
  soilType: z.string().optional(),
  sampleDepth: z.number().min(0).optional(),
  analyzedAt: z.string().datetime().optional(),
  labReportUrl: z.string().url().optional().or(z.literal('')),
  analyzedBy: z.string().optional(),
});

/**
 * @swagger
 * /api/v1/soil-data:
 *   post:
 *     summary: Create soil analysis record
 *     description: Upload soil analysis data (AGRONOMIST, ADMIN only)
 *     tags: [Soil Data]
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
 *               - nitrogen
 *               - phosphorus
 *               - potassium
 *               - pH
 *             properties:
 *               fieldId:
 *                 type: string
 *                 format: uuid
 *               nitrogen:
 *                 type: number
 *                 description: Nitrogen level (mg/kg or ppm)
 *               phosphorus:
 *                 type: number
 *                 description: Phosphorus level (mg/kg or ppm)
 *               potassium:
 *                 type: number
 *                 description: Potassium level (mg/kg or ppm)
 *               pH:
 *                 type: number
 *                 description: Soil pH (0-14)
 *               organicMatter:
 *                 type: number
 *                 description: Organic matter percentage
 *               electricalConductivity:
 *                 type: number
 *                 description: Electrical conductivity (mS/cm)
 *               soilType:
 *                 type: string
 *               sampleDepth:
 *                 type: number
 *                 description: Sample depth in cm
 *               analyzedAt:
 *                 type: string
 *                 format: date-time
 *               labReportUrl:
 *                 type: string
 *               analyzedBy:
 *                 type: string
 *     responses:
 *       201:
 *         description: Soil data created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden - AGRONOMIST or ADMIN only
 */
router.post('/', authenticate, authorize(Role.AGRONOMIST, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = createSoilDataSchema.safeParse(req.body);
    if (!validationResult.success) {
      return badRequestError(res, validationResult.error.errors.map(e => e.message).join(', '));
    }

    const data = validationResult.data;

    // Validate field exists
    const field = await prisma.field.findUnique({ where: { id: data.fieldId } });
    if (!field) {
      return notFoundError(res, 'Field not found');
    }

    const soilData = await prisma.soilData.create({
      data: {
        fieldId: data.fieldId,
        nitrogen: data.nitrogen,
        phosphorus: data.phosphorus,
        potassium: data.potassium,
        pH: data.pH,
        organicMatter: data.organicMatter,
        electricalConductivity: data.electricalConductivity,
        soilType: data.soilType,
        sampleDepth: data.sampleDepth,
        analyzedAt: data.analyzedAt ? new Date(data.analyzedAt) : new Date(),
        labReportUrl: data.labReportUrl,
        analyzedBy: data.analyzedBy,
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

    logger.info({ soilDataId: soilData.id, fieldId: data.fieldId }, 'Soil data created');

    return successResponse(res, soilData, 'Soil data created successfully', 201);
  } catch (error) {
    logger.error({ error }, 'Error creating soil data');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/soil-data/field/{fieldId}:
 *   get:
 *     summary: Get soil history for a field
 *     description: Get soil analysis history for a specific field (last 5 records by default)
 *     tags: [Soil Data]
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
 *           default: 5
 *     responses:
 *       200:
 *         description: Soil history retrieved successfully
 *       404:
 *         description: Field not found
 */
router.get('/field/:fieldId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fieldId } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;

    // Validate field exists
    const field = await prisma.field.findUnique({ where: { id: fieldId } });
    if (!field) {
      return notFoundError(res, 'Field not found');
    }

    const soilData = await prisma.soilData.findMany({
      where: { fieldId },
      orderBy: { analyzedAt: 'desc' },
      take: limit,
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

    // Calculate trend analysis
    let trendAnalysis = null;
    if (soilData.length >= 2) {
      const latest = soilData[0];
      const previous = soilData[1];
      trendAnalysis = {
        nitrogenChange: latest.nitrogen - previous.nitrogen,
        phosphorusChange: latest.phosphorus - previous.phosphorus,
        potassiumChange: latest.potassium - previous.potassium,
        pHChange: latest.pH - previous.pH,
      };
    }

    return successResponse(res, {
      soilData,
      trendAnalysis,
      count: soilData.length,
    });
  } catch (error) {
    logger.error({ error, fieldId: req.params.fieldId }, 'Error fetching soil history');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/soil-data/analytics:
 *   get:
 *     summary: Get soil health analytics
 *     description: Get soil health analytics across all fields
 *     tags: [Soil Data]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Soil analytics retrieved successfully
 */
router.get('/analytics', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Get all soil data with field info
    const soilData = await prisma.soilData.findMany({
      include: {
        field: {
          select: {
            id: true,
            name: true,
            cropType: true,
          },
        },
      },
      orderBy: { analyzedAt: 'desc' },
    });

    if (soilData.length === 0) {
      return successResponse(res, {
        averageNPK: { nitrogen: 0, phosphorus: 0, potassium: 0 },
        averagePH: 0,
        pHDistribution: {},
        deficiencies: [],
        totalRecords: 0,
      });
    }

    // Calculate averages
    const total = soilData.length;
    const avgNitrogen = soilData.reduce((sum, s) => sum + s.nitrogen, 0) / total;
    const avgPhosphorus = soilData.reduce((sum, s) => sum + s.phosphorus, 0) / total;
    const avgPotassium = soilData.reduce((sum, s) => sum + s.potassium, 0) / total;
    const avgPH = soilData.reduce((sum, s) => sum + s.pH, 0) / total;

    // pH distribution
    const pHDistribution = {
      acidic: soilData.filter(s => s.pH < 6).length,
      neutral: soilData.filter(s => s.pH >= 6 && s.pH <= 7.5).length,
      alkaline: soilData.filter(s => s.pH > 7.5).length,
    };

    // Identify deficiencies (simplified thresholds)
    const deficiencies: string[] = [];
    if (avgNitrogen < 20) deficiencies.push('Low nitrogen levels detected');
    if (avgPhosphorus < 10) deficiencies.push('Low phosphorus levels detected');
    if (avgPotassium < 150) deficiencies.push('Low potassium levels detected');
    if (avgPH < 6 || avgPH > 7.5) deficiencies.push('pH outside optimal range (6.0-7.5)');

    return successResponse(res, {
      averageNPK: {
        nitrogen: Math.round(avgNitrogen * 100) / 100,
        phosphorus: Math.round(avgPhosphorus * 100) / 100,
        potassium: Math.round(avgPotassium * 100) / 100,
      },
      averagePH: Math.round(avgPH * 100) / 100,
      pHDistribution,
      deficiencies,
      totalRecords: total,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching soil analytics');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/soil-data/{id}:
 *   patch:
 *     summary: Update soil data record
 *     description: Update existing soil analysis (AGRONOMIST, ADMIN only)
 *     tags: [Soil Data]
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
 *               nitrogen:
 *                 type: number
 *               phosphorus:
 *                 type: number
 *               potassium:
 *                 type: number
 *               pH:
 *                 type: number
 *               organicMatter:
 *                 type: number
 *               electricalConductivity:
 *                 type: number
 *               soilType:
 *                 type: string
 *               sampleDepth:
 *                 type: number
 *               analyzedAt:
 *                 type: string
 *                 format: date-time
 *               labReportUrl:
 *                 type: string
 *               analyzedBy:
 *                 type: string
 *     responses:
 *       200:
 *         description: Soil data updated successfully
 *       404:
 *         description: Soil data not found
 *       403:
 *         description: Forbidden - AGRONOMIST or ADMIN only
 */
router.patch('/:id', authenticate, authorize(Role.AGRONOMIST, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const validationResult = updateSoilDataSchema.safeParse(req.body);
    if (!validationResult.success) {
      return badRequestError(res, validationResult.error.errors.map(e => e.message).join(', '));
    }

    const data = validationResult.data;

    const existingSoilData = await prisma.soilData.findUnique({ where: { id } });
    if (!existingSoilData) {
      return notFoundError(res, 'Soil data not found');
    }

    const soilData = await prisma.soilData.update({
      where: { id },
      data: {
        ...data,
        analyzedAt: data.analyzedAt ? new Date(data.analyzedAt) : undefined,
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

    logger.info({ soilDataId: id }, 'Soil data updated');

    return successResponse(res, soilData, 'Soil data updated successfully');
  } catch (error) {
    logger.error({ error, soilDataId: req.params.id }, 'Error updating soil data');
    return notFoundError(res, 'Soil data not found');
  }
});

/**
 * @swagger
 * /api/v1/soil-data/{id}:
 *   get:
 *     summary: Get soil data by ID
 *     description: Get specific soil analysis record
 *     tags: [Soil Data]
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
 *         description: Soil data retrieved successfully
 *       404:
 *         description: Soil data not found
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const soilData = await prisma.soilData.findUnique({
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

    if (!soilData) {
      return notFoundError(res, 'Soil data not found');
    }

    return successResponse(res, soilData);
  } catch (error) {
    logger.error({ error, soilDataId: req.params.id }, 'Error fetching soil data');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/soil-data/{id}:
 *   delete:
 *     summary: Delete soil data record
 *     description: Delete soil analysis record (ADMIN only)
 *     tags: [Soil Data]
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
 *         description: Soil data deleted successfully
 *       404:
 *         description: Soil data not found
 *       403:
 *         description: Forbidden - ADMIN only
 */
router.delete('/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingSoilData = await prisma.soilData.findUnique({ where: { id } });
    if (!existingSoilData) {
      return notFoundError(res, 'Soil data not found');
    }

    await prisma.soilData.delete({ where: { id } });

    logger.info({ soilDataId: id }, 'Soil data deleted');

    return successResponse(res, null, 'Soil data deleted successfully');
  } catch (error) {
    logger.error({ error, soilDataId: req.params.id }, 'Error deleting soil data');
    return notFoundError(res, 'Soil data not found');
  }
});

export default router;
