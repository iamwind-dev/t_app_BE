CREATE TABLE "DomainEventOutbox" (
    "id" UUID NOT NULL,
    "type" VARCHAR(120) NOT NULL,
    "actorId" UUID,
    "subjectType" VARCHAR(50) NOT NULL,
    "subjectId" UUID NOT NULL,
    "orderingKey" VARCHAR(180) NOT NULL,
    "rooms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainEventOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DomainEventOutbox_occurredAt_id_idx"
ON "DomainEventOutbox"("occurredAt", "id");

CREATE INDEX "DomainEventOutbox_publishedAt_occurredAt_idx"
ON "DomainEventOutbox"("publishedAt", "occurredAt");

CREATE INDEX "DomainEventOutbox_subjectType_subjectId_occurredAt_idx"
ON "DomainEventOutbox"("subjectType", "subjectId", "occurredAt");

CREATE INDEX "DomainEventOutbox_orderingKey_occurredAt_id_idx"
ON "DomainEventOutbox"("orderingKey", "occurredAt", "id");