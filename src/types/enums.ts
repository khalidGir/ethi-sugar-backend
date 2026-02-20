export enum Role {
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR',
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
