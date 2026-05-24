-- Add SUPERADMIN to UserRole enum (SQLite: enum is stored as TEXT, no ALTER needed)
-- SQLite doesn't enforce enums at DB level, so no migration needed for the enum itself.

-- CreateTable: profesor_subscriptions
CREATE TABLE IF NOT EXISTS "profesor_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profesorId" TEXT NOT NULL,
    "planTipo" TEXT NOT NULL DEFAULT 'basico',
    "maxAlumnos" INTEGER NOT NULL DEFAULT 30,
    "maxPlanes" INTEGER NOT NULL DEFAULT 5,
    "estado" TEXT NOT NULL DEFAULT 'trial',
    "fechaInicio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" DATETIME,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "importe" REAL NOT NULL DEFAULT 0,
    "periodoDias" INTEGER NOT NULL DEFAULT 30,
    "notas" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "profesor_subscriptions_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex: unique profesorId
CREATE UNIQUE INDEX IF NOT EXISTS "profesor_subscriptions_profesorId_key" ON "profesor_subscriptions"("profesorId");

-- CreateTable: profesor_pagos
CREATE TABLE IF NOT EXISTS "profesor_pagos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "metodoPago" TEXT NOT NULL DEFAULT 'efectivo',
    "fechaPago" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodoDesde" DATETIME NOT NULL,
    "periodoHasta" DATETIME NOT NULL,
    "comprobante" TEXT,
    "notas" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "profesor_pagos_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "profesor_subscriptions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
