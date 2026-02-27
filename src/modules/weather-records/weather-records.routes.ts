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
const createWeatherRecordSchema = z.object({
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  temperature: z.number(),
  humidity: z.number().min(0).max(100),
  rainfall: z.number().min(0),
  windSpeed: z.number().min(0).optional(),
  windDirection: z.string().optional(),
  solarRadiation: z.number().min(0).optional(),
  cloudCover: z.number().min(0).max(100).optional(),
  isForecast: z.boolean().optional(),
  forecastDate: z.string().datetime().optional(),
  recordedAt: z.string().datetime().optional(),
});

/**
 * @swagger
 * /api/v1/weather/records:
 *   post:
 *     summary: Store weather record
 *     description: Store weather data (internal use, n8n webhook)
 *     tags: [Weather Records]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - temperature
 *               - humidity
 *               - rainfall
 *             properties:
 *               location:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               temperature:
 *                 type: number
 *                 description: Temperature in °C
 *               humidity:
 *                 type: number
 *                 description: Humidity percentage (0-100)
 *               rainfall:
 *                 type: number
 *                 description: Rainfall in mm
 *               windSpeed:
 *                 type: number
 *                 description: Wind speed in m/s
 *               windDirection:
 *                 type: string
 *               solarRadiation:
 *                 type: number
 *                 description: Solar radiation in W/m²
 *               cloudCover:
 *                 type: number
 *                 description: Cloud cover percentage
 *               isForecast:
 *                 type: boolean
 *               forecastDate:
 *                 type: string
 *                 format: date-time
 *               recordedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Weather record created successfully
 *       400:
 *         description: Validation error
 */
router.post('/records', authenticate, authorize(Role.ADMIN, Role.MANAGER, Role.AGRONOMIST), async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = createWeatherRecordSchema.safeParse(req.body);
    if (!validationResult.success) {
      return badRequestError(res, validationResult.error.errors.map(e => e.message).join(', '));
    }

    const data = validationResult.data;

    const weatherRecord = await prisma.weatherRecord.create({
      data: {
        location: data.location || 'Addis Ababa',
        latitude: data.latitude,
        longitude: data.longitude,
        temperature: data.temperature,
        humidity: data.humidity,
        rainfall: data.rainfall,
        windSpeed: data.windSpeed,
        windDirection: data.windDirection,
        solarRadiation: data.solarRadiation,
        cloudCover: data.cloudCover,
        isForecast: data.isForecast || false,
        forecastDate: data.forecastDate ? new Date(data.forecastDate) : null,
        recordedAt: data.recordedAt ? new Date(data.recordedAt) : new Date(),
      },
    });

    logger.info({ weatherRecordId: weatherRecord.id, location: weatherRecord.location }, 'Weather record created');

    return successResponse(res, weatherRecord, 'Weather record created successfully', 201);
  } catch (error) {
    logger.error({ error }, 'Error creating weather record');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/weather/history:
 *   get:
 *     summary: Get historical weather data
 *     description: Get historical weather records with optional date range and location filters
 *     tags: [Weather Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *       - in: query
 *         name: isForecast
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Historical weather data retrieved successfully
 */
router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, location, isForecast, limit } = req.query;
    
    const where: Record<string, unknown> = {};

    if (startDate || endDate) {
      where.recordedAt = {};
      if (startDate) (where.recordedAt as Record<string, unknown>).gte = new Date(startDate as string);
      if (endDate) (where.recordedAt as Record<string, unknown>).lte = new Date(endDate as string);
    }

    if (location) {
      where.location = location as string;
    }

    if (isForecast !== undefined) {
      where.isForecast = isForecast === 'true';
    }

    const weatherRecords = await prisma.weatherRecord.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take: parseInt(limit as string) || 50,
    });

    return successResponse(res, {
      records: weatherRecords,
      count: weatherRecords.length,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching weather history');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/weather/analytics:
 *   get:
 *     summary: Get weather pattern analytics
 *     description: Get weather pattern analytics including rainfall trends and temperature averages
 *     tags: [Weather Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Weather analytics retrieved successfully
 */
router.get('/analytics', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const weatherRecords = await prisma.weatherRecord.findMany({
      where: {
        recordedAt: { gte: startDate },
        isForecast: false,
      },
      orderBy: { recordedAt: 'asc' },
    });

    if (weatherRecords.length === 0) {
      return successResponse(res, {
        period: { start: startDate, end: new Date() },
        totalRecords: 0,
        message: 'No weather data available for the selected period',
      });
    }

    // Calculate averages
    const total = weatherRecords.length;
    const avgTemperature = weatherRecords.reduce((sum, w) => sum + w.temperature, 0) / total;
    const avgHumidity = weatherRecords.reduce((sum, w) => sum + w.humidity, 0) / total;
    const totalRainfall = weatherRecords.reduce((sum, w) => sum + w.rainfall, 0);
    const rainyDays = weatherRecords.filter(w => w.rainfall > 0).length;

    // Temperature trends
    const firstHalf = weatherRecords.slice(0, Math.floor(total / 2));
    const secondHalf = weatherRecords.slice(Math.floor(total / 2));
    const firstHalfAvgTemp = firstHalf.length > 0 ? firstHalf.reduce((sum, w) => sum + w.temperature, 0) / firstHalf.length : 0;
    const secondHalfAvgTemp = secondHalf.length > 0 ? secondHalf.reduce((sum, w) => sum + w.temperature, 0) / secondHalf.length : 0;
    const temperatureTrend = secondHalfAvgTemp - firstHalfAvgTemp;

    // Rainfall trends
    const firstHalfRain = firstHalf.reduce((sum, w) => sum + w.rainfall, 0);
    const secondHalfRain = secondHalf.reduce((sum, w) => sum + w.rainfall, 0);
    const rainfallTrend = secondHalfRain - firstHalfRain;

    // Insights
    const insights: string[] = [];
    if (temperatureTrend > 1) insights.push('Temperature increasing over the period');
    if (temperatureTrend < -1) insights.push('Temperature decreasing over the period');
    if (rainfallTrend > 10) insights.push('Rainfall increasing over the period');
    if (rainfallTrend < -10) insights.push('Rainfall decreasing over the period');
    if (totalRainfall < 20 && days >= 30) insights.push('Low rainfall detected - consider irrigation planning');

    return successResponse(res, {
      period: { start: startDate, end: new Date() },
      totalRecords: total,
      averages: {
        temperature: Math.round(avgTemperature * 100) / 100,
        humidity: Math.round(avgHumidity * 100) / 100,
      },
      rainfall: {
        total: Math.round(totalRainfall * 100) / 100,
        rainyDays,
        averagePerRainyDay: rainyDays > 0 ? Math.round((totalRainfall / rainyDays) * 100) / 100 : 0,
      },
      trends: {
        temperatureChange: Math.round(temperatureTrend * 100) / 100,
        rainfallChange: Math.round(rainfallTrend * 100) / 100,
      },
      insights,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching weather analytics');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/weather/records/{id}:
 *   get:
 *     summary: Get weather record by ID
 *     description: Get specific weather record
 *     tags: [Weather Records]
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
 *         description: Weather record retrieved successfully
 *       404:
 *         description: Weather record not found
 */
router.get('/records/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const weatherRecord = await prisma.weatherRecord.findUnique({ where: { id } });
    if (!weatherRecord) {
      return notFoundError(res, 'Weather record not found');
    }

    return successResponse(res, weatherRecord);
  } catch (error) {
    logger.error({ error, weatherRecordId: req.params.id }, 'Error fetching weather record');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/weather/records/{id}:
 *   delete:
 *     summary: Delete weather record
 *     description: Delete weather record (ADMIN only)
 *     tags: [Weather Records]
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
 *         description: Weather record deleted successfully
 *       404:
 *         description: Weather record not found
 *       403:
 *         description: Forbidden - ADMIN only
 */
router.delete('/records/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingRecord = await prisma.weatherRecord.findUnique({ where: { id } });
    if (!existingRecord) {
      return notFoundError(res, 'Weather record not found');
    }

    await prisma.weatherRecord.delete({ where: { id } });

    logger.info({ weatherRecordId: id }, 'Weather record deleted');

    return successResponse(res, null, 'Weather record deleted successfully');
  } catch (error) {
    logger.error({ error, weatherRecordId: req.params.id }, 'Error deleting weather record');
    return notFoundError(res, 'Weather record not found');
  }
});

export default router;
