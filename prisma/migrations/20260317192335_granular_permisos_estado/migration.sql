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
    "puedeVerTodosAlumnos" BOOLEAN NOT NULL DEFAULT false,
    "permisosGranulares" JSONB,
    "estado" TEXT NOT NULL DEFAULT 'activo'
);
INSERT INTO "new_users" ("altura", "createdAt", "direccion", "edad", "email", "emailVerified", "fechaNacimiento", "id", "nombreCompleto", "password", "puedeEditarPlanes", "puedeEditarRegistros", "puedeVerTodosAlumnos", "role", "telefono", "updatedAt") SELECT "altura", "createdAt", "direccion", "edad", "email", "emailVerified", "fechaNacimiento", "id", "nombreCompleto", "password", "puedeEditarPlanes", "puedeEditarRegistros", "puedeVerTodosAlumnos", "role", "telefono", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
