ALTER TABLE "DomainEventOutbox"
ADD COLUMN "orderingKey" VARCHAR(180) NOT NULL DEFAULT '';

UPDATE "DomainEventOutbox"
SET "orderingKey" = "subjectType" || ':' || "subjectId"
WHERE "orderingKey" = '';

ALTER TABLE "DomainEventOutbox"
ALTER COLUMN "orderingKey" DROP DEFAULT;

CREATE INDEX "DomainEventOutbox_orderingKey_occurredAt_id_idx"
ON "DomainEventOutbox"("orderingKey", "occurredAt", "id");
