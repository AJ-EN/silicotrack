-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Worker" (
    "workerId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "sex" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "village" TEXT NOT NULL,
    "phone" TEXT,
    "smokingStatus" TEXT NOT NULL,
    "priorTB" BOOLEAN NOT NULL,
    "clinicalStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "createdBy" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL
);
INSERT INTO "new_Worker" ("age", "block", "createdAt", "createdBy", "district", "name", "phone", "priorTB", "sex", "smokingStatus", "village", "workerId") SELECT "age", "block", "createdAt", "createdBy", "district", "name", "phone", "priorTB", "sex", "smokingStatus", "village", "workerId" FROM "Worker";
DROP TABLE "Worker";
ALTER TABLE "new_Worker" RENAME TO "Worker";
CREATE INDEX "Worker_district_block_idx" ON "Worker"("district", "block");
CREATE INDEX "Worker_district_village_idx" ON "Worker"("district", "village");
CREATE INDEX "Worker_district_block_clinicalStatus_idx" ON "Worker"("district", "block", "clinicalStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
