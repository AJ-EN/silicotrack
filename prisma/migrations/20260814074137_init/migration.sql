-- CreateTable
CREATE TABLE "Worker" (
    "workerId" TEXT NOT NULL,
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
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("workerId")
);

-- CreateTable
CREATE TABLE "ExposureSegment" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "taskCode" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "enclosure" TEXT NOT NULL,
    "ppeUse" TEXT NOT NULL,
    "siteType" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER,
    "monthsPerYear" INTEGER NOT NULL,
    "hoursPerDay" INTEGER NOT NULL,
    "siteName" TEXT,

    CONSTRAINT "ExposureSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "cumulativeExposure" DOUBLE PRECISION NOT NULL,
    "peakIntensity" DOUBLE PRECISION NOT NULL,
    "yearsSinceFirstExposure" INTEGER NOT NULL,
    "baseTier" INTEGER NOT NULL,
    "tier" INTEGER NOT NULL,
    "escalationsJson" TEXT NOT NULL,
    "rescreenMonths" INTEGER NOT NULL,
    "topContributorsJson" TEXT NOT NULL,
    "reasonEn" TEXT NOT NULL,
    "reasonHi" TEXT NOT NULL,
    "insufficientData" BOOLEAN NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "jemVersion" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "computedAt" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Camp" (
    "campId" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "Camp_pkey" PRIMARY KEY ("campId")
);

-- CreateTable
CREATE TABLE "CampInvite" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "priorityRank" INTEGER NOT NULL,
    "tierAtInvite" INTEGER NOT NULL,
    "attended" BOOLEAN NOT NULL,

    CONSTRAINT "CampInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningEvent" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "campId" TEXT,
    "date" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "aiFlag" TEXT,
    "radiologistRead" TEXT,

    CONSTRAINT "ScreeningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "toBoard" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "slotDate" TEXT,
    "lastContactAt" TEXT,
    "daysInStage" INTEGER NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralStageEvent" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "enteredAt" TEXT NOT NULL,
    "daysInPreviousStage" INTEGER,
    "note" TEXT,

    CONSTRAINT "ReferralStageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Worker_district_block_idx" ON "Worker"("district", "block");

-- CreateIndex
CREATE INDEX "Worker_district_village_idx" ON "Worker"("district", "village");

-- CreateIndex
CREATE INDEX "Worker_district_block_clinicalStatus_idx" ON "Worker"("district", "block", "clinicalStatus");

-- CreateIndex
CREATE INDEX "ExposureSegment_workerId_idx" ON "ExposureSegment"("workerId");

-- CreateIndex
CREATE INDEX "ExposureSegment_taskCode_idx" ON "ExposureSegment"("taskCode");

-- CreateIndex
CREATE INDEX "RiskAssessment_workerId_isCurrent_idx" ON "RiskAssessment"("workerId", "isCurrent");

-- CreateIndex
CREATE INDEX "RiskAssessment_tier_isCurrent_idx" ON "RiskAssessment"("tier", "isCurrent");

-- CreateIndex
CREATE INDEX "RiskAssessment_computedAt_idx" ON "RiskAssessment"("computedAt");

-- CreateIndex
CREATE INDEX "Camp_district_block_date_idx" ON "Camp"("district", "block", "date");

-- CreateIndex
CREATE INDEX "Camp_date_idx" ON "Camp"("date");

-- CreateIndex
CREATE INDEX "CampInvite_workerId_idx" ON "CampInvite"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "CampInvite_campId_workerId_key" ON "CampInvite"("campId", "workerId");

-- CreateIndex
CREATE INDEX "ScreeningEvent_workerId_idx" ON "ScreeningEvent"("workerId");

-- CreateIndex
CREATE INDEX "ScreeningEvent_campId_idx" ON "ScreeningEvent"("campId");

-- CreateIndex
CREATE INDEX "ScreeningEvent_date_idx" ON "ScreeningEvent"("date");

-- CreateIndex
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

-- CreateIndex
CREATE INDEX "Referral_status_daysInStage_idx" ON "Referral"("status", "daysInStage");

-- CreateIndex
CREATE INDEX "Referral_workerId_idx" ON "Referral"("workerId");

-- CreateIndex
CREATE INDEX "ReferralStageEvent_referralId_enteredAt_idx" ON "ReferralStageEvent"("referralId", "enteredAt");

-- CreateIndex
CREATE INDEX "ReferralStageEvent_stage_idx" ON "ReferralStageEvent"("stage");

-- AddForeignKey
ALTER TABLE "ExposureSegment" ADD CONSTRAINT "ExposureSegment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampInvite" ADD CONSTRAINT "CampInvite_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("campId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampInvite" ADD CONSTRAINT "CampInvite_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningEvent" ADD CONSTRAINT "ScreeningEvent_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningEvent" ADD CONSTRAINT "ScreeningEvent_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("campId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralStageEvent" ADD CONSTRAINT "ReferralStageEvent_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;
