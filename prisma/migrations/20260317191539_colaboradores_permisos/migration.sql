-- CreateTable
CREATE TABLE "AlumnoAsignado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "colaboradorId" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "puedeEditar" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlumnoAsignado_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlumnoAsignado_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CLIENTE',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "nombreCompleto" TEXT NOT NULL DEFAULT 'Sin nombre',
    "edad" INTEGER NOT NULL DEFAULT 0,
    "fechaNacimiento" DATETIME NOT NULL DEFAULT '2000-01-01 00:00:00 +00:00',
    "altura" REAL NOT NULL DEFAULT 0.0,
    "telefono" TEXT,
    "direccion" TEXT,
    "puedeEditarRegistros" BOOLEAN NOT NULL DEFAULT false,
    "puedeEditarPlanes" BOOLEAN NOT NULL DEFAULT false,
    "puedeVerTodosAlumnos" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_users" ("createdAt", "email", "emailVerified", "id", "password", "role", "updatedAt") SELECT "createdAt", "email", "emailVerified", "id", "password", "role", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");
