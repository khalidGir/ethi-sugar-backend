import express, { Response, Request, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import fieldsRoutes from './modules/fields/fields.routes';
import incidentsRoutes from './modules/incidents/incidents.routes';
import irrigationRoutes from './modules/irrigation/irrigation.routes';
import tasksRoutes from './modules/tasks/tasks.routes';
import internalRoutes from './modules/internal/internal.routes';
import telegramRoutes from './modules/telegram/telegram.routes';
import weatherRoutes from './modules/weather/weather.routes';
import detectRoutes from './modules/detect/detect.routes';
import soilRoutes from './modules/soil/soil.routes';
import weatherRecordsRoutes from './modules/weather-records/weather-records.routes';
import dailyLogsRoutes from './modules/daily-logs/daily-logs.routes';
import fertilizerRoutes from './modules/fertilizer/fertilizer.routes';
import cropPlansRoutes from './modules/crop-plans/crop-plans.routes';
import reportsRoutes from './modules/reports/reports.routes';
import uploadsRoutes from './modules/uploads/uploads.routes';
import auditRoutes from './modules/audit/audit.routes';
import approvalsRoutes from './modules/approvals/approvals.routes';
import { errorResponse } from './utils/response';
import logger from './config/logger';
import swaggerOptions from './config/swagger';

dotenv.config();

const app = express();

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically
const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadDir));

const requestCounts: Record<string, number> = {};
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS = 100;

app.use((req: Request, res: Response, next: NextFunction) => {
  const key = req.ip || 'unknown';
  const now = Date.now();
  
  if (!requestCounts[key]) {
    requestCounts[key] = 0;
  }
  
  if (now - requestCounts[key] > RATE_LIMIT_WINDOW) {
    requestCounts[key] = 1;
  } else {
    requestCounts[key]++;
  }
  
  if (requestCounts[key] > MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  }
  
  next();
});

// const specs = swaggerJsdoc(swaggerOptions);

app.get('/health', (req, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
//   customCss: `
//     .swagger-ui .topbar { display: none }
//     .swagger-ui .info .title { font-size: 2.5em; }
//     .swagger-ui .info .description { font-size: 1.1em; line-height: 1.6; }
//   `,
//   customSiteTitle: 'EthioSugar API Documentation',
//   customfavIcon: '/favicon.ico',
//   swaggerOptions: {
//     persistAuthorization: true,
//     displayRequestDuration: true,
//     docExpansion: 'list',
//     filter: true,
//     showExtensions: true,
//     showCommonExtensions: true,
//   },
// }));

// app.get('/api-json', (req, res: Response) => {
//   res.json(specs);
// });

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/fields', fieldsRoutes);
app.use('/api/v1/incidents', incidentsRoutes);
app.use('/api/v1/irrigation-logs', irrigationRoutes);
app.use('/api/v1/irrigation', irrigationRoutes);
app.use('/api/v1/tasks', tasksRoutes);
app.use('/api/v1/telegram', telegramRoutes);
app.use('/api/v1/weather', weatherRoutes);
app.use('/api/v1/detect', detectRoutes);
app.use('/api/v1/soil-data', soilRoutes);
app.use('/api/v1/weather-records', weatherRecordsRoutes);
app.use('/api/v1/daily-logs', dailyLogsRoutes);
app.use('/api/v1/fertilizer-logs', fertilizerRoutes);
app.use('/api/v1/crop-plans', cropPlansRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/uploads', uploadsRoutes);
app.use('/api/v1/approvals', approvalsRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/internal', internalRoutes);

app.use((req, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    code: 'NOT_FOUND',
  });
});

app.use((err: Error, req: express.Request, res: Response, next: express.NextFunction) => {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  return errorResponse(res, 'Internal server error', 'INTERNAL_ERROR', 500);
});

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<Response | void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default app;
