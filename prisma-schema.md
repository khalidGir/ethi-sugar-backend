# Prisma Schema – EthioSugar Backend (MVP)

generator client {
provider = "prisma-client-js"
}

datasource db {
provider = "postgresql"
url = env("DATABASE_URL")
}

enum Role {
ADMIN
SUPERVISOR
WORKER
}

enum IncidentType {
CROP_DISEASE
EQUIPMENT_FAILURE
IRRIGATION_FAILURE
EMERGENCY_EVENT
}

enum Severity {
LOW
MEDIUM
HIGH
}

enum IncidentStatus {
OPEN
IN_PROGRESS
RESOLVED
}

enum TaskStatus {
OPEN
COMPLETED
}

enum TaskPriority {
NORMAL
WARNING
CRITICAL
}

model User {
id String @id @default(uuid())
fullName String
email String @unique
passwordHash String
role Role
isActive Boolean @default(true)
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

incidents Incident[] @relation("ReportedIncidents")
irrigationLogs IrrigationLog[]
}

model Field {
id String @id @default(uuid())
name String
cropType String
warningThreshold Float @default(10)
criticalThreshold Float @default(15)
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

incidents Incident[]
irrigationLogs IrrigationLog[]
tasks Task[]
}

model Incident {
id String @id @default(uuid())
field Field @relation(fields: [fieldId], references: [id])
fieldId String
reportedBy User @relation("ReportedIncidents", fields: [reportedById], references: [id])
reportedById String

type IncidentType
severity Severity
description String
status IncidentStatus @default(OPEN)

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

relatedTasks Task[]
}

model IrrigationLog {
id String @id @default(uuid())
field Field @relation(fields: [fieldId], references: [id])
fieldId String
moistureDeficit Float
recordedBy User @relation(fields: [recordedById], references: [id])
recordedById String
createdAt DateTime @default(now())
}

model Task {
id String @id @default(uuid())
field Field @relation(fields: [fieldId], references: [id])
fieldId String

incident Incident? @relation(fields: [incidentId], references: [id])
incidentId String?

title String
description String
status TaskStatus @default(OPEN)
priority TaskPriority @default(NORMAL)

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
}

model NotificationLog {
id String @id @default(uuid())
eventType String
relatedEntityId String
deliveryStatus String
createdAt DateTime @default(now())
}
