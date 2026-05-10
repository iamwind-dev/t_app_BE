ALTER TABLE "Upload"
  ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN "attachedToType" VARCHAR(30),
  ADD COLUMN "attachedToId" UUID,
  ADD COLUMN "attachedAt" TIMESTAMP(3),
  ADD COLUMN "orphanedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Upload_ownerId_status_createdAt_idx" ON "Upload"("ownerId", "status", "createdAt");
CREATE INDEX "Upload_attachedToType_attachedToId_idx" ON "Upload"("attachedToType", "attachedToId");
CREATE INDEX "Upload_orphanedAt_idx" ON "Upload"("orphanedAt");
CREATE INDEX "Upload_deletedAt_idx" ON "Upload"("deletedAt");
