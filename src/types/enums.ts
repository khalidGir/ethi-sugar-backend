export enum Role {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  AGRONOMIST = 'AGRONOMIST',
  WORKER = 'WORKER',
}

export enum IncidentType {
  CROP_DISEASE = 'CROP_DISEASE',
  EQUIPMENT_FAILURE = 'EQUIPMENT_FAILURE',
  IRRIGATION_FAILURE = 'IRRIGATION_FAILURE',
  EMERGENCY_EVENT = 'EMERGENCY_EVENT',
}

export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum IncidentStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
}

export enum TaskStatus {
  OPEN = 'OPEN',
  COMPLETED = 'COMPLETED',
}

export enum TaskPriority {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum IrrigationStatus {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum FertilizerType {
  UREA = 'UREA',
  DAP = 'DAP',
  NPS = 'NPS',
  COMPOST = 'COMPOST',
  MANURE = 'MANURE',
  OTHER = 'OTHER',
}

export enum CropPlanStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum ApprovalType {
  CROP_PLAN = 'CROP_PLAN',
  FERTILIZER = 'FERTILIZER',
  IRRIGATION = 'IRRIGATION',
  BUDGET = 'BUDGET',
  DISEASE_ALERT = 'DISEASE_ALERT',
  SOIL_DATA = 'SOIL_DATA',
  AI_RECOMMENDATION = 'AI_RECOMMENDATION',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}
