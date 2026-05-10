CREATE TABLE "AuthRefreshToken" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "replacedByTokenId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AuthRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthRefreshToken_tokenHash_key" ON "AuthRefreshToken"("tokenHash");
CREATE INDEX "AuthRefreshToken_userId_revokedAt_expiresAt_idx" ON "AuthRefreshToken"("userId", "revokedAt", "expiresAt");
CREATE INDEX "AuthRefreshToken_expiresAt_idx" ON "AuthRefreshToken"("expiresAt");

ALTER TABLE "AuthRefreshToken"
  ADD CONSTRAINT "AuthRefreshToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
