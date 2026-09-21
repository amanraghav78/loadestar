-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('MANUAL', 'GREENHOUSE', 'LEVER', 'ASHBY');

-- AlterEnum
ALTER TYPE "Level" ADD VALUE 'INTERN';

-- AlterEnum
ALTER TYPE "Currency" ADD VALUE 'INR';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "atsSource" "JobSource",
ADD COLUMN     "atsToken" TEXT,
ADD COLUMN     "lastSyncError" TEXT,
ADD COLUMN     "lastSyncJobCount" INTEGER,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "hq" DROP NOT NULL,
ALTER COLUMN "size" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "salaryDisclosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source" "JobSource" NOT NULL DEFAULT 'MANUAL',
ALTER COLUMN "salaryMin" DROP NOT NULL,
ALTER COLUMN "salaryMax" DROP NOT NULL,
ALTER COLUMN "currency" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Job_status_salaryDisclosed_postedAt_id_idx" ON "Job"("status", "salaryDisclosed", "postedAt" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Job_source_externalId_key" ON "Job"("source", "externalId");


-- Existing rows all had a band.
UPDATE "Job" SET "salaryDisclosed" = true WHERE "salaryMin" IS NOT NULL;

-- A band is now optional, but when present it must be complete and sane.
ALTER TABLE "Job" DROP CONSTRAINT "Job_salary_band_check";
ALTER TABLE "Job" ADD CONSTRAINT "Job_salary_band_check" CHECK (
  ("salaryMin" IS NULL AND "salaryMax" IS NULL AND "currency" IS NULL AND "salaryDisclosed" = false)
  OR ("salaryMin" > 0 AND "salaryMax" >= "salaryMin" AND "currency" IS NOT NULL AND "salaryDisclosed" = true)
);
