-- Trigram matching for job search (Neon supports pg_trgm out of the box)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Discipline" AS ENUM ('ENGINEERING', 'DESIGN', 'PRODUCT', 'DATA', 'SECURITY', 'INFRASTRUCTURE');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('JUNIOR', 'MID', 'SENIOR', 'STAFF', 'PRINCIPAL', 'MANAGER', 'DIRECTOR');

-- CreateEnum
CREATE TYPE "RemotePolicy" AS ENUM ('ONSITE', 'HYBRID', 'REMOTE');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('EUR', 'GBP', 'USD');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('ACTIVE', 'EXPIRED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "website" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hq" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "medianResponseDays" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "discipline" "Discipline" NOT NULL,
    "level" "Level" NOT NULL,
    "tags" TEXT[],
    "location" TEXT NOT NULL,
    "remote" "RemotePolicy" NOT NULL,
    "remoteRegion" TEXT,
    "salaryMin" INTEGER NOT NULL,
    "salaryMax" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "applyUrl" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'ACTIVE',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "searchText" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplyClick" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "referrer" TEXT,
    "countryCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplyClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Job_slug_key" ON "Job"("slug");

-- CreateIndex
CREATE INDEX "Job_status_postedAt_id_idx" ON "Job"("status", "postedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Job_status_discipline_idx" ON "Job"("status", "discipline");

-- CreateIndex
CREATE INDEX "Job_companyId_status_idx" ON "Job"("companyId", "status");

-- CreateIndex
CREATE INDEX "Job_status_lastVerifiedAt_idx" ON "Job"("status", "lastVerifiedAt");

-- CreateIndex
CREATE INDEX "Job_tags_idx" ON "Job" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "Job_searchText_idx" ON "Job" USING GIN ("searchText" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ApplyClick_jobId_createdAt_idx" ON "ApplyClick"("jobId", "createdAt");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplyClick" ADD CONSTRAINT "ApplyClick_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Every listing must publish a sane salary band
ALTER TABLE "Job" ADD CONSTRAINT "Job_salary_band_check" CHECK ("salaryMin" > 0 AND "salaryMax" >= "salaryMin");
