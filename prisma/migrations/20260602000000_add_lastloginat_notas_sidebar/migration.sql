-- Add lastLoginAt, notasInternas and sidebarImage to users table
-- These fields were added to the schema without a corresponding migration.
ALTER TABLE "users" ADD COLUMN "lastLoginAt" DATETIME;
ALTER TABLE "users" ADD COLUMN "notasInternas" TEXT;
ALTER TABLE "users" ADD COLUMN "sidebarImage" TEXT;
