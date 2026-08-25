-- Drop old unique index tied to a single exception date
DROP INDEX "ScheduleException_scheduleId_exceptionDate_isRecurringYearl_key";

-- Add new range columns (temporarily nullable for data backfill)
ALTER TABLE "ScheduleException"
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "endDate" TIMESTAMP(3);

-- Backfill existing records so old one-day exceptions become one-day ranges
UPDATE "ScheduleException"
SET "startDate" = "exceptionDate",
    "endDate" = "exceptionDate";

-- Enforce required range bounds
ALTER TABLE "ScheduleException"
  ALTER COLUMN "startDate" SET NOT NULL,
  ALTER COLUMN "endDate" SET NOT NULL;

-- Remove legacy column
ALTER TABLE "ScheduleException"
  DROP COLUMN "exceptionDate";

-- Add range-aware indexes
CREATE UNIQUE INDEX "ScheduleException_scheduleId_startDate_endDate_isRecurringYearly_key"
  ON "ScheduleException"("scheduleId", "startDate", "endDate", "isRecurringYearly");

CREATE INDEX "ScheduleException_scheduleId_startDate_endDate_idx"
  ON "ScheduleException"("scheduleId", "startDate", "endDate");
