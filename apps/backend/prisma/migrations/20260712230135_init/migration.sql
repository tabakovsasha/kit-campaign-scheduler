-- CreateEnum
CREATE TYPE "IntegrationVerifyStatus" AS ENUM ('unverified', 'success', 'failed');

-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('day_off', 'custom_working_hours');

-- CreateEnum
CREATE TYPE "RuntimeState" AS ENUM ('paused', 'resumed', 'unknown');

-- CreateEnum
CREATE TYPE "LogSource" AS ENUM ('manual', 'scheduler', 'system');

-- CreateEnum
CREATE TYPE "LogAction" AS ENUM ('pause', 'resume', 'verify_integration');

-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('success', 'error');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "accessTokenIv" TEXT NOT NULL,
    "accessTokenAuthTag" TEXT NOT NULL,
    "encryptionVersion" INTEGER NOT NULL DEFAULT 1,
    "tokenLast4" TEXT,
    "verifyStatus" "IntegrationVerifyStatus" NOT NULL DEFAULT 'unverified',
    "verifyMessage" TEXT,
    "verifiedAccountId" BIGINT,
    "verifiedAccountName" TEXT,
    "verifiedRegions" JSONB,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campaignId" BIGINT NOT NULL,
    "campaignTitle" TEXT NOT NULL,
    "campaignTimezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleWeekday" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleWeekday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleWorkInterval" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleWorkInterval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleBreakInterval" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleBreakInterval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleException" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "exceptionDate" TIMESTAMP(3) NOT NULL,
    "type" "ExceptionType" NOT NULL,
    "customStartTime" TEXT,
    "customEndTime" TEXT,
    "title" TEXT,
    "isRecurringYearly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleRuntimeState" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "currentState" "RuntimeState" NOT NULL DEFAULT 'unknown',
    "lastDecisionReason" TEXT,
    "lastTransitionAt" TIMESTAMP(3),
    "lastCheckAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleRuntimeState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleActionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "campaignId" BIGINT NOT NULL,
    "campaignTitle" TEXT,
    "source" "LogSource" NOT NULL,
    "action" "LogAction" NOT NULL,
    "status" "LogStatus" NOT NULL,
    "httpStatus" INTEGER,
    "requestId" TEXT,
    "errorMessage" TEXT,
    "responsePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_jti_key" ON "UserSession"("jti");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSettings_userId_key" ON "IntegrationSettings"("userId");

-- CreateIndex
CREATE INDEX "Schedule_userId_idx" ON "Schedule"("userId");

-- CreateIndex
CREATE INDEX "ScheduleWeekday_scheduleId_idx" ON "ScheduleWeekday"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleWeekday_scheduleId_weekday_key" ON "ScheduleWeekday"("scheduleId", "weekday");

-- CreateIndex
CREATE INDEX "ScheduleWorkInterval_scheduleId_idx" ON "ScheduleWorkInterval"("scheduleId");

-- CreateIndex
CREATE INDEX "ScheduleBreakInterval_scheduleId_idx" ON "ScheduleBreakInterval"("scheduleId");

-- CreateIndex
CREATE INDEX "ScheduleException_scheduleId_idx" ON "ScheduleException"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleException_scheduleId_exceptionDate_isRecurringYearl_key" ON "ScheduleException"("scheduleId", "exceptionDate", "isRecurringYearly");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleRuntimeState_scheduleId_key" ON "ScheduleRuntimeState"("scheduleId");

-- CreateIndex
CREATE INDEX "ScheduleActionLog_userId_idx" ON "ScheduleActionLog"("userId");

-- CreateIndex
CREATE INDEX "ScheduleActionLog_scheduleId_idx" ON "ScheduleActionLog"("scheduleId");

-- CreateIndex
CREATE INDEX "ScheduleActionLog_createdAt_idx" ON "ScheduleActionLog"("createdAt");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSettings" ADD CONSTRAINT "IntegrationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleWeekday" ADD CONSTRAINT "ScheduleWeekday_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleWorkInterval" ADD CONSTRAINT "ScheduleWorkInterval_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBreakInterval" ADD CONSTRAINT "ScheduleBreakInterval_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleRuntimeState" ADD CONSTRAINT "ScheduleRuntimeState_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleActionLog" ADD CONSTRAINT "ScheduleActionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleActionLog" ADD CONSTRAINT "ScheduleActionLog_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
