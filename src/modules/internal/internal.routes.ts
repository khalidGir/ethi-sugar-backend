import { Router, Response, Request } from 'express';
import prisma from '../../config/database';
import { successResponse, unauthorizedError } from '../../utils/response';
import logger from '../../config/logger';

const router = Router();

/**
 * @swagger
 * /internal/daily-summary:
 *   get:
 *     summary: Daily summary for n8n
 *     description: Get daily statistics for farm operations (Internal use - requires API token)
 *     tags: [Internal]
 *     security:
 *       - internalAuth: []
 *     parameters:
 *       - in: header
 *         name: x-internal-token
 *         required: true
 *         schema:
 *           type: string
 *         description: Internal API token
 *     responses:
 *       200:
 *         description: Daily summary statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DailySummary'
 *       401:
 *         description: Invalid internal token
 */
router.get('/daily-summary', (req: Request, res: Response) => {
  const internalToken = req.headers['x-internal-token'];

  if (!internalToken || internalToken !== process.env.INTERNAL_API_TOKEN) {
    return unauthorizedError(res, 'Invalid internal token');
  }

  Promise.all([
    prisma.incident.count(),
    prisma.incident.count({ where: { status: 'OPEN' } }),
    prisma.task.count({ where: { status: 'OPEN' } }),
    prisma.$queryRaw<Array<{ field_id: string; status: string }>>`
      SELECT il.field_id, 
             CASE 
               WHEN il.moisture_deficit >= f.critical_threshold THEN 'CRITICAL'
               WHEN il.moisture_deficit >= f.warning_threshold THEN 'WARNING'
               ELSE 'NORMAL'
             END as status
      FROM irrigation_logs il
      JOIN fields f ON il.field_id = f.id
      WHERE il.created_at >= NOW() - INTERVAL '24 hours'
    `.then((results) => {
      const criticalFields = new Set(
        results.filter((r) => r.status === 'CRITICAL').map((r) => r.field_id)
      );
      return criticalFields.size;
    }),
  ])
    .then(([totalIncidents, openIncidents, pendingTasks, criticalFields]) => {
      logger.info('Daily summary fetched');
      return successResponse(res, {
        totalIncidents,
        openIncidents,
        criticalFields,
        pendingTasks,
      });
    })
    .catch((error) => {
      logger.error({ error }, 'Error fetching daily summary');
      return res.status(500).json({
        success: false,
        message: 'Error fetching daily summary',
      });
    });
});

export default router;
