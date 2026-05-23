-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('THREAD', 'REEL');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "type" "PostType" NOT NULL DEFAULT 'THREAD',
ADD COLUMN     "videoUrl" VARCHAR(2048),
ADD COLUMN     "thumbnailUrl" VARCHAR(2048),
ADD COLUMN     "audioTitle" VARCHAR(120),
ADD COLUMN     "durationSeconds" INTEGER,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Post_type_createdAt_id_idx" ON "Post"("type", "createdAt", "id");
