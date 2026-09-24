-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "Industry" AS ENUM ('SAAS', 'FINTECH', 'ECOMMERCE', 'HEALTHTECH', 'EDTECH', 'GAMING', 'AI_ML', 'SECURITY', 'CONSUMER', 'MOBILITY', 'LOGISTICS', 'MEDIA', 'IT_SERVICES', 'HARDWARE', 'ENERGY', 'OTHER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SEEKER', 'RECRUITER');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED', 'GHOSTED');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('HIGH_SCHOOL', 'DIPLOMA', 'BACHELORS', 'MASTERS', 'DOCTORATE', 'OTHER');

-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'PENDING';
ALTER TYPE "JobStatus" ADD VALUE 'REJECTED';
ALTER TYPE "JobStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "industry" "Industry";

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
ADD COLUMN     "moderationNote" TEXT,
ADD COLUMN     "postedById" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN     "degree" TEXT,
ADD COLUMN     "educationLevel" "EducationLevel",
ADD COLUMN     "graduationYear" INTEGER,
ADD COLUMN     "institution" TEXT;

-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "note" TEXT,
ADD COLUMN     "stage" "ApplicationStage" NOT NULL DEFAULT 'APPLIED',
ADD COLUMN     "stageUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'SEEKER';

-- CreateTable
CREATE TABLE "CompanyMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "workEmail" TEXT NOT NULL,
    "note" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyReview" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "pros" TEXT NOT NULL,
    "cons" TEXT NOT NULL,
    "roleTitle" TEXT,
    "stillThere" BOOLEAN NOT NULL DEFAULT false,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Company_industry_idx" ON "Company"("industry");

-- CreateIndex
CREATE INDEX "Job_status_employmentType_idx" ON "Job"("status", "employmentType");

-- CreateIndex
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Job_postedById_createdAt_idx" ON "Job"("postedById", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "JobApplication_userId_stage_idx" ON "JobApplication"("userId", "stage");

-- CreateIndex
CREATE INDEX "CompanyMember_status_createdAt_idx" ON "CompanyMember"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyMember_companyId_status_idx" ON "CompanyMember"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMember_userId_companyId_key" ON "CompanyMember"("userId", "companyId");

-- CreateIndex
CREATE INDEX "CompanyReview_companyId_status_createdAt_idx" ON "CompanyReview"("companyId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CompanyReview_status_createdAt_idx" ON "CompanyReview"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyReview_userId_createdAt_idx" ON "CompanyReview"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyReview_companyId_userId_key" ON "CompanyReview"("companyId", "userId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyReview" ADD CONSTRAINT "CompanyReview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyReview" ADD CONSTRAINT "CompanyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
