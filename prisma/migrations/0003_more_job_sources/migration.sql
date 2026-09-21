-- New public careers-site sources for MNC and startup listings.
ALTER TYPE "JobSource" ADD VALUE 'WORKDAY';
ALTER TYPE "JobSource" ADD VALUE 'SMARTRECRUITERS';
ALTER TYPE "JobSource" ADD VALUE 'EIGHTFOLD';
ALTER TYPE "JobSource" ADD VALUE 'ORACLE';
ALTER TYPE "JobSource" ADD VALUE 'AMAZON';

-- The sync works through companies least-recently attempted first, a time-boxed batch per run.
ALTER TABLE "Company" ADD COLUMN "lastSyncAttemptAt" TIMESTAMP(3);

-- Listings older than 30 days are no longer kept.
DELETE FROM "Job" WHERE "postedAt" < NOW() - INTERVAL '30 days';
