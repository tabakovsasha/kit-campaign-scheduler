-- AlterEnum
ALTER TYPE "LogAction" ADD VALUE 'delete_schedule';

-- AlterEnum
ALTER TYPE "LogAction" ADD VALUE 'restore_schedule';

-- AlterEnum
ALTER TYPE "LogAction" ADD VALUE 'auto_delete_schedule';

-- AlterTable
ALTER TABLE "Schedule"
  ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "purgeAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ScheduleActionLog"
  ALTER COLUMN "scheduleId" DROP NOT NULL;

-- DropForeignKey
ALTER TABLE "ScheduleActionLog" DROP CONSTRAINT "ScheduleActionLog_scheduleId_fkey";

-- AddForeignKey
ALTER TABLE "ScheduleActionLog"
  ADD CONSTRAINT "ScheduleActionLog_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
