import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  role: z.enum(['ADMIN', 'MANAGER', 'AGRONOMIST', 'SUPERVISOR', 'WORKER']).optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'AGRONOMIST', 'SUPERVISOR', 'WORKER']).optional(),
  isActive: z.boolean().optional(),
});

export const createFieldSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  cropType: z.string().min(1, 'Crop type is required'),
  warningThreshold: z.number().min(0).optional(),
  criticalThreshold: z.number().min(0).optional(),
  area: z.number().min(0).optional(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  soilType: z.string().optional(),
  irrigationType: z.string().optional(),
  plantingDate: z.string().datetime().optional(),
  cropStage: z.string().optional(),
});

export const updateFieldSchema = z.object({
  name: z.string().min(1).optional(),
  cropType: z.string().min(1).optional(),
  warningThreshold: z.number().min(0).optional(),
  criticalThreshold: z.number().min(0).optional(),
  area: z.number().min(0).optional(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  soilType: z.string().optional(),
  irrigationType: z.string().optional(),
  plantingDate: z.string().datetime().optional(),
  cropStage: z.string().optional(),
});

export const createIncidentSchema = z.object({
  fieldId: z.string().uuid('Invalid field ID'),
  type: z.string().transform((val) => {
    // Map frontend string values to backend enum
    const typeMap: Record<string, string> = {
      'Pest Infestation': 'CROP_DISEASE',
      'Disease Outbreak': 'CROP_DISEASE',
      'Irrigation Issue': 'IRRIGATION_FAILURE',
      'Equipment Failure': 'EQUIPMENT_FAILURE',
      'Other': 'EMERGENCY_EVENT',
    };
    return typeMap[val] || val.toUpperCase().replace(/ /g, '_');
  }).refine(
    (val) => ['CROP_DISEASE', 'EQUIPMENT_FAILURE', 'IRRIGATION_FAILURE', 'EMERGENCY_EVENT'].includes(val),
    { message: 'Invalid incident type' }
  ),
  severity: z.enum(['NORMAL', 'WARNING', 'CRITICAL']),
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
  assignedToId: z.string().uuid('Invalid user ID').optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['NORMAL', 'WARNING', 'CRITICAL']).optional(),
  dueDate: z.string().datetime().optional(),
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

// Soil Data schemas
export const createSoilDataSchema = z.object({
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

export type CreateSoilDataInput = z.infer<typeof createSoilDataSchema>;

// Weather Record schemas
export const createWeatherRecordSchema = z.object({
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

export type CreateWeatherRecordInput = z.infer<typeof createWeatherRecordSchema>;

// Worker Daily Log schemas
export const createDailyLogSchema = z.object({
  workerId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  fieldId: z.string().uuid('Invalid field ID'),
  activity: z.string().min(1, 'Activity description is required'),
  activityType: z.string().min(1, 'Activity type is required'),
  hoursSpent: z.number().min(0).max(24),
  resourcesUsed: z.string().optional(),
  observations: z.string().optional(),
  photos: z.array(z.string().url()).optional(),
  loggedAt: z.string().datetime().optional(),
});

export const verifyDailyLogSchema = z.object({
  verificationStatus: z.enum(['VERIFIED', 'REJECTED']),
  notes: z.string().optional(),
});

export type CreateDailyLogInput = z.infer<typeof createDailyLogSchema>;
export type VerifyDailyLogInput = z.infer<typeof verifyDailyLogSchema>;

// Fertilizer Log schemas
export const createFertilizerLogSchema = z.object({
  fieldId: z.string().uuid('Invalid field ID'),
  fertilizerType: z.enum(['UREA', 'DAP', 'NPS', 'COMPOST', 'MANURE', 'OTHER']),
  fertilizerName: z.string().min(1, 'Fertilizer name is required'),
  applicationRate: z.number().min(0, 'Application rate must be positive'),
  totalAmount: z.number().min(0, 'Total amount must be positive'),
  cost: z.number().min(0).optional(),
  applicationMethod: z.string().min(1, 'Application method is required'),
  growthStage: z.string().optional(),
  appliedBy: z.string().uuid().optional(),
  notes: z.string().optional(),
  appliedAt: z.string().datetime().optional(),
});

export type CreateFertilizerLogInput = z.infer<typeof createFertilizerLogSchema>;

// Crop Plan schemas
export const createCropPlanSchema = z.object({
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
  createdBy: z.string().uuid().optional(),
});

export const updateCropPlanSchema = z.object({
  plantedArea: z.number().min(0).optional(),
  targetYield: z.number().min(0).optional(),
  actualYield: z.number().min(0).optional(),
  budget: z.number().min(0).optional(),
  actualCost: z.number().min(0).optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED']).optional(),
  cropVariety: z.string().optional(),
  expectedHarvestDate: z.string().datetime().optional(),
});

export type CreateCropPlanInput = z.infer<typeof createCropPlanSchema>;
export type UpdateCropPlanInput = z.infer<typeof updateCropPlanSchema>;
