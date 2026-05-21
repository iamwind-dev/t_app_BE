ALTER TYPE "ModerationStatus" ADD VALUE IF NOT EXISTS 'AI_UNAVAILABLE';

ALTER TABLE "Post"
ADD COLUMN "moderationLabel" VARCHAR(20),
ADD COLUMN "moderationConfidence" DOUBLE PRECISION,
ADD COLUMN "moderationAction" VARCHAR(30),
ADD COLUMN "moderationIsWarning" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "moderationRaw" JSONB;

ALTER TABLE "Reply"
ADD COLUMN "moderationLabel" VARCHAR(20),
ADD COLUMN "moderationConfidence" DOUBLE PRECISION,
ADD COLUMN "moderationAction" VARCHAR(30),
ADD COLUMN "moderationIsWarning" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "moderationModel" VARCHAR(100),
ADD COLUMN "moderationRaw" JSONB,
ADD COLUMN "aiReviewedAt" TIMESTAMP(3);
