-- Add telefonoVerificado field to users table
ALTER TABLE "users" ADD COLUMN "telefonoVerificado" BOOLEAN NOT NULL DEFAULT false;
