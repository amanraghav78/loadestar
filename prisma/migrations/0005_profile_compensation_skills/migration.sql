-- Compensation, notice period and skills on the candidate profile.
--
-- Purely additive: every column is nullable (or defaulted), so a profile saved
-- before this migration stays valid and nothing has to be backfilled.
--
-- "skills" holds the same vocabulary as "Job"."tags" (lib/ingest/classify.ts),
-- which is what lets a candidate's skills be matched against open roles with
-- the existing GIN index on "Job"."tags" rather than a text search.

-- AlterTable
ALTER TABLE "CandidateProfile"
    ADD COLUMN "currentSalary" INTEGER,
    ADD COLUMN "expectedSalary" INTEGER,
    ADD COLUMN "noticePeriod" INTEGER,
    ADD COLUMN "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "resumeParsedAt" TIMESTAMP(3);

-- Annual pay in rupees. The upper bound is the same one the admin job form
-- enforces; the lower bound rejects a figure typed in lakhs ("25") that would
-- otherwise silently mean twenty-five rupees.
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_currentSalary_check"
    CHECK ("currentSalary" IS NULL OR ("currentSalary" >= 1000 AND "currentSalary" <= 200000000));

ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_expectedSalary_check"
    CHECK ("expectedSalary" IS NULL OR ("expectedSalary" >= 1000 AND "expectedSalary" <= 200000000));

-- Days until they could join: 0 is "immediately", and six months is the longest
-- notice period Indian employers serve.
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_noticePeriod_check"
    CHECK ("noticePeriod" IS NULL OR ("noticePeriod" >= 0 AND "noticePeriod" <= 180));

-- A bounded list of short labels: the parser caps this, and the check stops a
-- bug or a hand-written UPDATE from turning the column into a document store.
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_skills_check"
    CHECK (array_length("skills", 1) IS NULL OR array_length("skills", 1) <= 40);
