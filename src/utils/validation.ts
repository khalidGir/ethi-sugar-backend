import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'WORKER']).optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'WORKER']).optional(),
  isActive: z.boolean().optional(),
});

export const createFieldSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  cropType: z.string().min(1, 'Crop type is required'),
  warningThreshold: z.number().min(0).optional(),
  criticalThreshold: z.number().min(0).optional(),
});

export const updateFieldSchema = z.object({
  name: z.string().min(1).optional(),
  cropType: z.string().min(1).optional(),
  warningThreshold: z.number().min(0).optional(),
  criticalThreshold: z.number().min(0).optional(),
});

export const createIncidentSchema = z.object({
  fieldId: z.string().uuid('Invalid field ID'),
  type: z.enum(['CROP_DISEASE', 'EQUIPMENT_FAILURE', 'IRRIGATION_FAILURE', 'EMERGENCY_EVENT']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  description: z.string().min(1, 'Description is required'),
});

export const updateIncidentStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'RESOLVED']),
});

export const createIrrigationLogSchema = z.object({
  fieldId: z.string().uuid('Invalid field ID'),
  moistureDeficit: z.number(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(['COMPLETED']),
});

export const createTaskSchema = z.object({
  fieldId: z.string().uuid('Invalid field ID'),
  incidentId: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['NORMAL', 'WARNING', 'CRITICAL']).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateFieldInput = z.infer<typeof createFieldSchema>;
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentStatusInput = z.infer<typeof updateIncidentStatusSchema>;
export type CreateIrrigationLogInput = z.infer<typeof createIrrigationLogSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
