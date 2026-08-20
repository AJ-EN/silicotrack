-- Preserve uncertainty disclosed during the exposure interview instead of
-- making estimated dates and seasonal work look exact after sync.
ALTER TABLE "ExposureSegment"
ADD COLUMN "durationCertainty" TEXT NOT NULL DEFAULT 'exact',
ADD COLUMN "frequencyPattern" TEXT NOT NULL DEFAULT 'regular';