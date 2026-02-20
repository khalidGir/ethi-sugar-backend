import express, { Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import fieldsRoutes from './modules/fields/fields.routes';
import incidentsRoutes from './modules/incidents/incidents.routes';
import irrigationRoutes from './modules/irrigation/irrigation.routes';
import tasksRoutes from './modules/tasks/tasks.routes';
import internalRoutes from './modules/internal/internal.routes';
import { errorResponse } from './utils/response';
import logger from './config/logger';
import swaggerOptions from './config/swagger';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const specs = swaggerJsdoc(swaggerOptions);

app.get('/health', (req, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { font-size: 2.5em; }
    .swagger-ui .info .description { font-size: 1.1em; line-height: 1.6; }
  `,
  customSiteTitle: 'EthioSugar API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
  },
}));

app.get('/api-json', (req, res: Response) => {
  res.json(specs);
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/fields', fieldsRoutes);
app.use('/api/v1/incidents', incidentsRoutes);
app.use('/api/v1/irrigation-logs', irrigationRoutes);
app.use('/api/v1/irrigation', irrigationRoutes);
app.use('/api/v1/tasks', tasksRoutes);
app.use('/internal', internalRoutes);

app.use((req, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    code: 'NOT_FOUND',
  });
});

app.use((err: Error, req: express.Request, res: Response, next: express.NextFunction) => {
  logger.error({ err, path: req.path }, 'Unhandled error');
  return errorResponse(res, 'Internal server error', 'INTERNAL_ERROR', 500);
});

export default app;
