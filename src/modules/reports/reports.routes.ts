import { Router, Response } from 'express';
import { AuthRequest } from '../../types/express';
import prisma from '../../config/database';
import { authenticate } from '../../middlewares/auth';
import { successResponse, errorResponse, badRequestError } from '../../utils/response';
import logger from '../../config/logger';
import { z } from 'zod';

const router = Router();

// Validation schemas
const dailyReportSchema = z.object({
  date: z.string().date().optional(),
});

const weeklyReportSchema = z.object({
  weekNumber: z.string().optional(),
  year: z.string().optional(),
  fieldId: z.string().uuid().optional(),
});

const monthlyReportSchema = z.object({
  month: z.string().optional(),
  year: z.string().optional(),
});

const workerPerformanceSchema = z.object({
  workerId: z.string().uuid().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});

// Helper function to get date range for a week
function getWeekRange(weekNumber?: number, year?: number) {
  const now = new Date();
  const currentWeek = Math.ceil(now.getDate() / 7);
  const currentYear = now.getFullYear();
  
  const week = weekNumber || currentWeek;
  const yr = year || currentYear;
  
  const startDate = new Date(yr, 0, (week - 1) * 7 + 1);
  const endDate = new Date(yr, 0, week * 7);
  
  return { startDate, endDate };
}

// Helper function to get date range for a month
function getMonthRange(month?: number, year?: number) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const m = month !== undefined ? month : currentMonth;
  const yr = year || currentYear;
  
  const startDate = new Date(yr, m, 1);
  const endDate = new Date(yr, m + 1, 0);
  
  return { startDate, endDate };
}

/**
 * @swagger
 * /api/v1/reports/daily:
 *   get:
 *     summary: Get daily activity report
 *     description: Get daily activity report including tasks completed, worker logs, and weather summary
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Daily report generated successfully
 */
router.get('/daily', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = dailyReportSchema.safeParse(req.query);
    if (!validationResult.success) {
      return badRequestError(res, validationResult.error.errors.map(e => e.message).join(', '));
    }

    const reportDate = validationResult.data.date ? new Date(validationResult.data.date) : new Date();
    reportDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(reportDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Get tasks completed today
    const tasksCompleted = await prisma.task.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: {
          gte: reportDate,
          lt: nextDay,
        },
      },
      include: {
        field: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
    });

    // Get worker daily logs
    const workerLogs = await prisma.workerDailyLog.findMany({
      where: {
        loggedAt: {
          gte: reportDate,
          lt: nextDay,
        },
      },
      include: {
        worker: { select: { id: true, fullName: true } },
        field: { select: { id: true, name: true } },
      },
    });

    // Get weather data
    const weatherData = await prisma.weatherRecord.findMany({
      where: {
        recordedAt: {
          gte: reportDate,
          lt: nextDay,
        },
      },
    });

    // Get incidents reported
    const incidentsReported = await prisma.incident.findMany({
      where: {
        createdAt: {
          gte: reportDate,
          lt: nextDay,
        },
      },
      include: {
        field: { select: { id: true, name: true } },
      },
    });

    // Calculate summary
    const totalHoursWorked = workerLogs.reduce((sum, log) => sum + log.hoursSpent, 0);
    const avgTemperature = weatherData.length > 0
      ? weatherData.reduce((sum, w) => sum + w.temperature, 0) / weatherData.length
      : null;
    const totalRainfall = weatherData.reduce((sum, w) => sum + w.rainfall, 0);

    const insights: string[] = [];
    if (tasksCompleted.length > 5) insights.push('High productivity day with many tasks completed');
    if (totalRainfall > 10) insights.push('Significant rainfall recorded - irrigation may not be needed');
    if (workerLogs.length === 0) insights.push('No worker activity logged for this day');

    return successResponse(res, {
      reportType: 'daily',
      period: {
        start: reportDate,
        end: nextDay,
      },
      generatedAt: new Date(),
      summary: {
        tasksCompleted: tasksCompleted.length,
        workerLogsCount: workerLogs.length,
        totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
        incidentsReported: incidentsReported.length,
        weatherRecords: weatherData.length,
      },
      details: {
        tasks: tasksCompleted,
        workerLogs,
        incidents: incidentsReported,
        weather: {
          avgTemperature: avgTemperature ? Math.round(avgTemperature * 100) / 100 : null,
          totalRainfall: Math.round(totalRainfall * 100) / 100,
        },
      },
      insights,
    });
  } catch (error) {
    logger.error({ error }, 'Error generating daily report');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/reports/weekly:
 *   get:
 *     summary: Get weekly field report
 *     description: Get weekly report including task completion rate, weather correlation, and issues
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: weekNumber
 *         schema:
 *           type: string
 *       - in: query
 *         name: year
 *         schema:
 *           type: string
 *       - in: query
 *         name: fieldId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Weekly report generated successfully
 */
router.get('/weekly', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = weeklyReportSchema.safeParse(req.query);
    if (!validationResult.success) {
      return badRequestError(res, validationResult.error.errors.map(e => e.message).join(', '));
    }

    const { startDate, endDate } = getWeekRange(
      validationResult.data.weekNumber ? parseInt(validationResult.data.weekNumber) : undefined,
      validationResult.data.year ? parseInt(validationResult.data.year) : undefined
    );

    const where: Record<string, unknown> = {
      createdAt: { gte: startDate, lt: endDate },
    };

    if (validationResult.data.fieldId) {
      where.fieldId = validationResult.data.fieldId;
    }

    // Get all tasks
    const allTasks = await prisma.task.findMany({ where });
    const completedTasks = allTasks.filter(t => t.status === 'COMPLETED');

    // Get worker logs
    const workerLogs = await prisma.workerDailyLog.findMany({
      where: {
        loggedAt: { gte: startDate, lt: endDate },
        fieldId: validationResult.data.fieldId,
      },
    });

    // Get weather data
    const weatherData = await prisma.weatherRecord.findMany({
      where: {
        recordedAt: { gte: startDate, lt: endDate },
      },
    });

    // Get incidents
    const incidents = await prisma.incident.findMany({
      where: {
        createdAt: { gte: startDate, lt: endDate },
        fieldId: validationResult.data.fieldId,
      },
    });

    // Calculate metrics
    const taskCompletionRate = allTasks.length > 0
      ? Math.round((completedTasks.length / allTasks.length) * 100)
      : 0;

    const totalHoursWorked = workerLogs.reduce((sum, log) => sum + log.hoursSpent, 0);
    const avgTemperature = weatherData.length > 0
      ? weatherData.reduce((sum, w) => sum + w.temperature, 0) / weatherData.length
      : null;
    const totalRainfall = weatherData.reduce((sum, w) => sum + w.rainfall, 0);
    const rainyDays = weatherData.filter(w => w.rainfall > 0).length;

    const insights: string[] = [];
    if (taskCompletionRate >= 80) insights.push('Excellent task completion rate this week');
    if (taskCompletionRate < 50) insights.push('Task completion rate below target - review workload');
    if (rainyDays >= 3) insights.push('Multiple rainy days - outdoor work may have been affected');
    if (incidents.length > 2) insights.push('Multiple incidents reported - review safety protocols');

    return successResponse(res, {
      reportType: 'weekly',
      period: { start: startDate, end: endDate },
      generatedAt: new Date(),
      summary: {
        totalTasks: allTasks.length,
        completedTasks: completedTasks.length,
        taskCompletionRate,
        workerLogsCount: workerLogs.length,
        totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
        incidentsCount: incidents.length,
      },
      details: {
        weather: {
          avgTemperature: avgTemperature ? Math.round(avgTemperature * 100) / 100 : null,
          totalRainfall: Math.round(totalRainfall * 100) / 100,
          rainyDays,
        },
        incidentsByType: incidents.reduce((acc, inc) => {
          acc[inc.type] = (acc[inc.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      insights,
    });
  } catch (error) {
    logger.error({ error }, 'Error generating weekly report');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/reports/monthly:
 *   get:
 *     summary: Get monthly operational report
 *     description: Get monthly report including yield progress, budget variance, and performance KPIs
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *       - in: query
 *         name: year
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Monthly report generated successfully
 */
router.get('/monthly', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = monthlyReportSchema.safeParse(req.query);
    if (!validationResult.success) {
      return badRequestError(res, validationResult.error.errors.map(e => e.message).join(', '));
    }

    const { startDate, endDate } = getMonthRange(
      validationResult.data.month ? parseInt(validationResult.data.month) : undefined,
      validationResult.data.year ? parseInt(validationResult.data.year) : undefined
    );

    // Get tasks
    const tasks = await prisma.task.findMany({
      where: { createdAt: { gte: startDate, lt: endDate } },
    });
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED');

    // Get worker logs
    const workerLogs = await prisma.workerDailyLog.findMany({
      where: { loggedAt: { gte: startDate, lt: endDate } },
    });

    // Get fertilizer logs
    const fertilizerLogs = await prisma.fertilizerLog.findMany({
      where: { appliedAt: { gte: startDate, lt: endDate } },
    });

    // Get crop plans updated this month
    const cropPlans = await prisma.cropPlan.findMany({
      where: { updatedAt: { gte: startDate, lt: endDate } },
    });

    // Calculate KPIs
    const taskCompletionRate = tasks.length > 0
      ? Math.round((completedTasks.length / tasks.length) * 100)
      : 0;

    const totalHoursWorked = workerLogs.reduce((sum, log) => sum + log.hoursSpent, 0);
    const totalFertilizerCost = fertilizerLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
    const totalFertilizerAmount = fertilizerLogs.reduce((sum, log) => sum + log.totalAmount, 0);

    const uniqueWorkers = new Set(workerLogs.map(log => log.workerId)).size;
    const avgHoursPerWorker = uniqueWorkers > 0 ? totalHoursWorked / uniqueWorkers : 0;

    const insights: string[] = [];
    if (taskCompletionRate >= 85) insights.push('Outstanding task completion rate for the month');
    if (totalFertilizerCost > 10000) insights.push('High fertilizer expenditure - review usage efficiency');
    if (uniqueWorkers < 3) insights.push('Low worker activity - consider workforce planning');

    return successResponse(res, {
      reportType: 'monthly',
      period: { start: startDate, end: endDate },
      generatedAt: new Date(),
      summary: {
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        taskCompletionRate,
        totalWorkerHours: Math.round(totalHoursWorked * 100) / 100,
        uniqueActiveWorkers: uniqueWorkers,
        avgHoursPerWorker: Math.round(avgHoursPerWorker * 100) / 100,
        fertilizerCost: Math.round(totalFertilizerCost * 100) / 100,
        fertilizerAmountKg: Math.round(totalFertilizerAmount * 100) / 100,
        cropPlansUpdated: cropPlans.length,
      },
      details: {
        tasksByStatus: {
          completed: completedTasks.length,
          open: tasks.length - completedTasks.length,
        },
        fertilizerByType: fertilizerLogs.reduce((acc, log) => {
          acc[log.fertilizerType] = (acc[log.fertilizerType] || 0) + log.totalAmount;
          return acc;
        }, {} as Record<string, number>),
      },
      insights,
    });
  } catch (error) {
    logger.error({ error }, 'Error generating monthly report');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/reports/soil-analytics:
 *   get:
 *     summary: Get soil health report
 *     description: Get soil health report including NPK levels by field, deficiencies, and recommendations
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Soil analytics report generated successfully
 */
router.get('/soil-analytics', authenticate, async (req: AuthRequest, res: Response) => {
  try {
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
        reportType: 'soil-analytics',
        generatedAt: new Date(),
        message: 'No soil data available',
        fields: [],
        overallHealth: 'UNKNOWN',
      });
    }

    // Group by field
    const byField: Record<string, any> = {};
    soilData.forEach(data => {
      if (!byField[data.fieldId]) {
        byField[data.fieldId] = {
          field: data.field,
          latestData: data,
          history: [] as typeof soilData,
        };
      }
      byField[data.fieldId].history.push(data);
    });

    // Analyze each field
    const fieldAnalysis = Object.values(byField).map((item: any) => {
      const latest = item.latestData;
      const deficiencies: string[] = [];
      const recommendations: string[] = [];

      if (latest.nitrogen < 20) {
        deficiencies.push('Low Nitrogen');
        recommendations.push('Apply nitrogen-rich fertilizer');
      }
      if (latest.phosphorus < 10) {
        deficiencies.push('Low Phosphorus');
        recommendations.push('Apply phosphorus-rich fertilizer');
      }
      if (latest.potassium < 150) {
        deficiencies.push('Low Potassium');
        recommendations.push('Apply potassium-rich fertilizer');
      }
      if (latest.pH < 6) {
        deficiencies.push('Acidic Soil');
        recommendations.push('Apply lime to raise pH');
      } else if (latest.pH > 7.5) {
        deficiencies.push('Alkaline Soil');
        recommendations.push('Apply sulfur to lower pH');
      }

      let healthStatus = 'GOOD';
      if (deficiencies.length >= 3) healthStatus = 'POOR';
      else if (deficiencies.length >= 1) healthStatus = 'FAIR';

      return {
        fieldId: item.field.id,
        fieldName: item.field.name,
        cropType: item.field.cropType,
        latestAnalysis: {
          nitrogen: latest.nitrogen,
          phosphorus: latest.phosphorus,
          potassium: latest.potassium,
          pH: latest.pH,
          analyzedAt: latest.analyzedAt,
        },
        deficiencies,
        recommendations,
        healthStatus,
        dataPoints: item.history.length,
      };
    });

    // Overall statistics
    const avgNitrogen = soilData.reduce((sum, d) => sum + d.nitrogen, 0) / soilData.length;
    const avgPhosphorus = soilData.reduce((sum, d) => sum + d.phosphorus, 0) / soilData.length;
    const avgPotassium = soilData.reduce((sum, d) => sum + d.potassium, 0) / soilData.length;
    const avgPH = soilData.reduce((sum, d) => sum + d.pH, 0) / soilData.length;

    const overallHealth = fieldAnalysis.filter((f: any) => f.healthStatus === 'POOR').length > 0
      ? 'NEEDS_ATTENTION'
      : fieldAnalysis.filter((f: any) => f.healthStatus === 'FAIR').length > soilData.length / 2
        ? 'FAIR'
        : 'GOOD';

    return successResponse(res, {
      reportType: 'soil-analytics',
      generatedAt: new Date(),
      overallHealth,
      summary: {
        totalFields: Object.keys(byField).length,
        avgNPK: {
          nitrogen: Math.round(avgNitrogen * 100) / 100,
          phosphorus: Math.round(avgPhosphorus * 100) / 100,
          potassium: Math.round(avgPotassium * 100) / 100,
        },
        avgPH: Math.round(avgPH * 100) / 100,
        fieldsNeedingAttention: fieldAnalysis.filter((f: any) => f.healthStatus === 'POOR').length,
      },
      fields: fieldAnalysis,
    });
  } catch (error) {
    logger.error({ error }, 'Error generating soil analytics report');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/reports/fertilizer-summary:
 *   get:
 *     summary: Get fertilizer usage report
 *     description: Get fertilizer usage report including cost by field and nutrient application summary
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Fertilizer summary report generated successfully
 */
router.get('/fertilizer-summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate: startStr, endDate: endStr } = req.query;

    const where: Record<string, unknown> = {};
    if (startStr || endStr) {
      where.appliedAt = {};
      if (startStr) (where.appliedAt as Record<string, unknown>).gte = new Date(startStr as string);
      if (endStr) (where.appliedAt as Record<string, unknown>).lte = new Date(endStr as string);
    }

    const fertilizerLogs = await prisma.fertilizerLog.findMany({
      where,
      include: {
        field: {
          select: {
            id: true,
            name: true,
          },
        },
        appliedByUser: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });

    if (fertilizerLogs.length === 0) {
      return successResponse(res, {
        reportType: 'fertilizer-summary',
        period: { start: startStr || 'all time', end: endStr || 'present' },
        generatedAt: new Date(),
        message: 'No fertilizer data available',
      });
    }

    // Summary by field
    const byField: Record<string, { fieldName: string; totalAmount: number; totalCost: number; applications: number }> = {};
    fertilizerLogs.forEach(log => {
      if (!byField[log.fieldId]) {
        byField[log.fieldId] = {
          fieldName: log.field.name,
          totalAmount: 0,
          totalCost: 0,
          applications: 0,
        };
      }
      byField[log.fieldId].totalAmount += log.totalAmount;
      byField[log.fieldId].totalCost += log.cost || 0;
      byField[log.fieldId].applications += 1;
    });

    // Summary by type
    const byType: Record<string, { totalAmount: number; totalCost: number; applications: number }> = {};
    fertilizerLogs.forEach(log => {
      if (!byType[log.fertilizerType]) {
        byType[log.fertilizerType] = { totalAmount: 0, totalCost: 0, applications: 0 };
      }
      byType[log.fertilizerType].totalAmount += log.totalAmount;
      byType[log.fertilizerType].totalCost += log.cost || 0;
      byType[log.fertilizerType].applications += 1;
    });

    const totalCost = fertilizerLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
    const totalAmount = fertilizerLogs.reduce((sum, log) => sum + log.totalAmount, 0);

    return successResponse(res, {
      reportType: 'fertilizer-summary',
      period: { start: startStr || 'all time', end: endStr || 'present' },
      generatedAt: new Date(),
      summary: {
        totalApplications: fertilizerLogs.length,
        totalAmountKg: Math.round(totalAmount * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        avgCostPerKg: totalAmount > 0 ? Math.round((totalCost / totalAmount) * 100) / 100 : 0,
      },
      byField: Object.entries(byField).map(([fieldId, data]) => ({
        fieldId,
        ...data,
        totalAmount: Math.round(data.totalAmount * 100) / 100,
        totalCost: Math.round(data.totalCost * 100) / 100,
      })),
      byType: Object.entries(byType).map(([type, data]) => ({
        type,
        ...data,
        totalAmount: Math.round(data.totalAmount * 100) / 100,
        totalCost: Math.round(data.totalCost * 100) / 100,
      })),
    });
  } catch (error) {
    logger.error({ error }, 'Error generating fertilizer summary report');
    return errorResponse(res);
  }
});

/**
 * @swagger
 * /api/v1/reports/worker-performance:
 *   get:
 *     summary: Get worker performance report
 *     description: Get worker productivity report including tasks completed, hours logged, and verification rate
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: workerId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Worker performance report generated successfully
 */
router.get('/worker-performance', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = workerPerformanceSchema.safeParse(req.query);
    if (!validationResult.success) {
      return badRequestError(res, validationResult.error.errors.map(e => e.message).join(', '));
    }

    const { workerId, startDate: startStr, endDate: endStr } = validationResult.data;

    const where: Record<string, unknown> = {};
    if (workerId) where.workerId = workerId;
    if (startStr || endStr) {
      where.loggedAt = {};
      if (startStr) (where.loggedAt as Record<string, unknown>).gte = new Date(startStr);
      if (endStr) (where.loggedAt as Record<string, unknown>).lte = new Date(endStr);
    }

    const workerLogs = await prisma.workerDailyLog.findMany({
      where,
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        field: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { loggedAt: 'desc' },
    });

    if (workerLogs.length === 0) {
      return successResponse(res, {
        reportType: 'worker-performance',
        period: { start: startStr || 'all time', end: endStr || 'present' },
        generatedAt: new Date(),
        message: 'No worker log data available',
      });
    }

    // Group by worker
    const byWorker: Record<string, {
      worker: any;
      totalHours: number;
      logsCount: number;
      verifiedCount: number;
      pendingCount: number;
      rejectedCount: number;
      fieldsWorked: Set<string>;
    }> = {};

    workerLogs.forEach(log => {
      if (!byWorker[log.workerId]) {
        byWorker[log.workerId] = {
          worker: log.worker,
          totalHours: 0,
          logsCount: 0,
          verifiedCount: 0,
          pendingCount: 0,
          rejectedCount: 0,
          fieldsWorked: new Set(),
        };
      }
      byWorker[log.workerId].totalHours += log.hoursSpent;
      byWorker[log.workerId].logsCount += 1;
      byWorker[log.workerId].fieldsWorked.add(log.fieldId);
      
      if (log.verificationStatus === 'VERIFIED') byWorker[log.workerId].verifiedCount += 1;
      else if (log.verificationStatus === 'PENDING') byWorker[log.workerId].pendingCount += 1;
      else if (log.verificationStatus === 'REJECTED') byWorker[log.workerId].rejectedCount += 1;
    });

    // Calculate performance metrics
    const workerPerformance = Object.values(byWorker).map(data => {
      const verificationRate = data.logsCount > 0
        ? Math.round((data.verifiedCount / data.logsCount) * 100)
        : 0;

      let performanceRating = 'GOOD';
      if (verificationRate >= 90 && data.totalHours >= 40) performanceRating = 'EXCELLENT';
      else if (verificationRate < 50) performanceRating = 'NEEDS_IMPROVEMENT';

      return {
        workerId: data.worker.id,
        workerName: data.worker.fullName,
        totalHours: Math.round(data.totalHours * 100) / 100,
        logsSubmitted: data.logsCount,
        verificationRate,
        fieldsWorked: data.fieldsWorked.size,
        performanceRating,
        breakdown: {
          verified: data.verifiedCount,
          pending: data.pendingCount,
          rejected: data.rejectedCount,
        },
      };
    });

    // Overall summary
    const totalHours = workerPerformance.reduce((sum, w) => sum + w.totalHours, 0);
    const avgVerificationRate = workerPerformance.length > 0
      ? Math.round(workerPerformance.reduce((sum, w) => sum + w.verificationRate, 0) / workerPerformance.length)
      : 0;

    return successResponse(res, {
      reportType: 'worker-performance',
      period: { start: startStr || 'all time', end: endStr || 'present' },
      generatedAt: new Date(),
      summary: {
        totalWorkers: workerPerformance.length,
        totalHours: Math.round(totalHours * 100) / 100,
        avgVerificationRate,
        totalLogsSubmitted: workerLogs.length,
      },
      workers: workerPerformance,
    });
  } catch (error) {
    logger.error({ error }, 'Error generating worker performance report');
    return errorResponse(res);
  }
});

export default router;
