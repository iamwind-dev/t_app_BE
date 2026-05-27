ALTER TABLE "Upload"
ADD COLUMN "aiModerationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "aiModerationLabel" VARCHAR(50),
ADD COLUMN "aiModerationConfidence" DOUBLE PRECISION,
ADD COLUMN "aiModerationRaw" JSONB,
ADD COLUMN "mediaSafetyPolicy" VARCHAR(40) NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "mediaSafetyReason" VARCHAR(255),
ADD COLUMN "mediaBlurSuggested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mediaRequiresClickToReveal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mediaVisibleByDefault" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "mediaBlockedFromPosting" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Upload_aiModerationStatus_createdAt_idx" ON "Upload"("aiModerationStatus", "createdAt");
CREATE INDEX "Upload_mediaSafetyPolicy_createdAt_idx" ON "Upload"("mediaSafetyPolicy", "createdAt");
CREATE INDEX "Upload_mediaBlockedFromPosting_createdAt_idx" ON "Upload"("mediaBlockedFromPosting", "createdAt");
