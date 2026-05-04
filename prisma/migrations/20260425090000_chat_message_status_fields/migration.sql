ALTER TABLE "Message"
ADD COLUMN "content" VARCHAR(2000) NOT NULL DEFAULT '',
ADD COLUMN "mediaUrl" VARCHAR(2048),
ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "Message"
SET "content" = COALESCE("text", '')
WHERE "content" = '';

CREATE INDEX "Message_deletedAt_idx" ON "Message"("deletedAt");
