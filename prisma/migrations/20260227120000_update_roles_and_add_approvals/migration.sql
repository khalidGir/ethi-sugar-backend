-- Drop SUPERVISOR from Role enum and create Approval table
BEGIN;

-- Drop existing SUPERVISOR values first
UPDATE "User" SET role = 'WORKER' WHERE role = 'SUPERVISOR';

-- Create new enum types
CREATE TYPE "ApprovalType_new" AS ENUM ('CROP_PLAN', 'FERTILIZER', 'IRRIGATION', 'BUDGET', 'DISEASE_ALERT', 'SOIL_DATA', 'AI_RECOMMENDATION');
CREATE TYPE "ApprovalStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Rename old types
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "ApprovalType_new" RENAME TO "ApprovalType";
ALTER TYPE "ApprovalStatus_new" RENAME TO "ApprovalStatus";

-- Create new Role enum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'AGRONOMIST', 'WORKER');

-- Update User table to use new Role type
ALTER TABLE "User" ALTER COLUMN role TYPE "Role" USING role::text::"Role";

-- Drop old types
DROP TYPE "Role_old";

-- Create Approval table
CREATE TABLE "Approval" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type "ApprovalType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "requestedById" UUID NOT NULL REFERENCES "User"(id),
    "requiredRole" "Role" NOT NULL,
    status "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "confidenceScore" FLOAT,
    reason TEXT,
    "approvedById" UUID REFERENCES "User"(id),
    "approvedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX "Approval_type_idx" ON "Approval"(type);
CREATE INDEX "Approval_status_idx" ON "Approval"(status);
CREATE INDEX "Approval_requiredRole_idx" ON "Approval"("requiredRole");
CREATE INDEX "Approval_requestedById_idx" ON "Approval"("requestedById");
CREATE INDEX "Approval_approvedById_idx" ON "Approval"("approvedById");
CREATE INDEX "Approval_createdAt_idx" ON "Approval"("createdAt");

COMMIT;
