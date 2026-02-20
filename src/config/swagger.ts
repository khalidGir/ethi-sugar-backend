import { Options } from 'swagger-jsdoc';

const swaggerOptions: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EthioSugar Farm Automation API',
      version: '1.0.0',
      description: `
## Overview
Backend API for EthioSugar Farm Automation MVP.

## Authentication
All protected endpoints require JWT Bearer token authentication.
Include in header: \`Authorization: Bearer <token>\`

## Roles
- **ADMIN**: Full access to all endpoints
- **SUPERVISOR**: Can manage incidents, tasks, view fields
- **WORKER**: Can create incidents, irrigation logs, view assigned fields

## Base URL
\`/api/v1\`

## Internal Endpoints
- \`/internal/daily-summary\` - Requires \`x-internal-token\` header
      `,
      contact: {
        name: 'EthioSugar Development Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /auth/login',
        },
        internalAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-internal-token',
          description: 'Internal API token for n8n integration',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'admin@ethiosugar.local' },
            password: { type: 'string', format: 'password', example: 'Admin123!' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    fullName: { type: 'string' },
                    role: { type: 'string', enum: ['ADMIN', 'SUPERVISOR', 'WORKER'] },
                    email: { type: 'string', format: 'email' },
                  },
                },
              },
            },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'fullName'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            fullName: { type: 'string', minLength: 2 },
            role: { type: 'string', enum: ['ADMIN', 'SUPERVISOR', 'WORKER'] },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'SUPERVISOR', 'WORKER'] },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Field: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Field A' },
            cropType: { type: 'string', example: 'Sugarcane' },
            warningThreshold: { type: 'number', example: 10 },
            criticalThreshold: { type: 'number', example: 15 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateFieldRequest: {
          type: 'object',
          required: ['name', 'cropType'],
          properties: {
            name: { type: 'string' },
            cropType: { type: 'string' },
            warningThreshold: { type: 'number', default: 10 },
            criticalThreshold: { type: 'number', default: 15 },
          },
        },
        Incident: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            fieldId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['CROP_DISEASE', 'EQUIPMENT_FAILURE', 'IRRIGATION_FAILURE', 'EMERGENCY_EVENT'] },
            severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
            description: { type: 'string' },
            status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED'] },
            reportedById: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateIncidentRequest: {
          type: 'object',
          required: ['fieldId', 'type', 'severity', 'description'],
          properties: {
            fieldId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['CROP_DISEASE', 'EQUIPMENT_FAILURE', 'IRRIGATION_FAILURE', 'EMERGENCY_EVENT'] },
            severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
            description: { type: 'string' },
          },
        },
        UpdateIncidentStatusRequest: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['IN_PROGRESS', 'RESOLVED'] },
          },
        },
        IrrigationLog: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            fieldId: { type: 'string', format: 'uuid' },
            moistureDeficit: { type: 'number' },
            recordedById: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateIrrigationLogRequest: {
          type: 'object',
          required: ['fieldId', 'moistureDeficit'],
          properties: {
            fieldId: { type: 'string', format: 'uuid' },
            moistureDeficit: { type: 'number' },
          },
        },
        IrrigationLogResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['NORMAL', 'WARNING', 'CRITICAL'] },
          },
        },
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            fieldId: { type: 'string', format: 'uuid' },
            incidentId: { type: 'string', format: 'uuid', nullable: true },
            title: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['OPEN', 'COMPLETED'] },
            priority: { type: 'string', enum: ['NORMAL', 'WARNING', 'CRITICAL'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        UpdateTaskStatusRequest: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['COMPLETED'] },
          },
        },
        DailySummary: {
          type: 'object',
          properties: {
            totalIncidents: { type: 'integer' },
            openIncidents: { type: 'integer' },
            criticalFields: { type: 'integer' },
            pendingTasks: { type: 'integer' },
          },
        },
      },
    },
    security: [
      { bearerAuth: [] },
    ],
    paths: {},
  },
  apis: ['./src/**/*.routes.ts'],
};

export default swaggerOptions;
