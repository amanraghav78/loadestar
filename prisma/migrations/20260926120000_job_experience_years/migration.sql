-- Years of experience a role asks for, parsed from the posting or entered by
-- the recruiter. Both null when unknown; the search then falls back to level.
-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "experienceMax" INTEGER,
ADD COLUMN     "experienceMin" INTEGER;

-- A range is a minimum with an optional maximum above it ("3+" is 3 and null),
-- never a maximum alone. The IS NOT NULL matters: without it a lone maximum
-- makes the second branch NULL, and a CHECK that is NULL passes.
ALTER TABLE "Job" ADD CONSTRAINT "Job_experience_check" CHECK (
  ("experienceMin" IS NULL AND "experienceMax" IS NULL)
  OR (
    "experienceMin" IS NOT NULL
    AND "experienceMin" BETWEEN 0 AND 40
    AND ("experienceMax" IS NULL OR "experienceMax" BETWEEN "experienceMin" AND 40)
  )
);

-- CreateIndex
CREATE INDEX "Job_status_experienceMin_idx" ON "Job"("status", "experienceMin");
