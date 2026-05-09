CREATE TABLE "Upload" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "secureUrl" VARCHAR(2048) NOT NULL,
    "publicId" VARCHAR(512) NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalName" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Upload_publicId_key" ON "Upload"("publicId");
CREATE INDEX "Upload_ownerId_createdAt_idx" ON "Upload"("ownerId", "createdAt");
CREATE INDEX "Upload_type_createdAt_idx" ON "Upload"("type", "createdAt");

ALTER TABLE "Upload" ADD CONSTRAINT "Upload_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

