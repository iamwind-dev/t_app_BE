-- CreateEnum
CREATE TYPE "VisibilityLevel" AS ENUM ('NORMAL', 'LIMITED', 'COLLAPSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ModerationStatus" ADD VALUE 'SAFE';
ALTER TYPE "ModerationStatus" ADD VALUE 'WARNING';
ALTER TYPE "ModerationStatus" ADD VALUE 'RESTRICTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'NEW_MESSAGE';
ALTER TYPE "NotificationType" ADD VALUE 'NEW_POST';
ALTER TYPE "NotificationType" ADD VALUE 'SYSTEM';

-- AlterTable
ALTER TABLE "DeviceToken" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "aiReviewedAt" TIMESTAMP(3),
ADD COLUMN     "moderationCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "moderationHighlights" JSONB,
ADD COLUMN     "moderationMessage" VARCHAR(500),
ADD COLUMN     "moderationModel" VARCHAR(100),
ADD COLUMN     "moderationSuggestion" VARCHAR(500),
ADD COLUMN     "toxicityScore" DOUBLE PRECISION,
ADD COLUMN     "visibilityLevel" "VisibilityLevel" NOT NULL DEFAULT 'NORMAL';

-- CreateIndex
CREATE INDEX "Post_visibilityLevel_createdAt_idx" ON "Post"("visibilityLevel", "createdAt");
