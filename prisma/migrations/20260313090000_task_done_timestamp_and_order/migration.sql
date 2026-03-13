-- Add non-destructive task completion timestamp and manual ordering.
ALTER TABLE "Task"
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "orderIndex" INTEGER;

-- Keep old DONE rows behavior by treating creation time as completion time.
UPDATE "Task"
SET "completedAt" = "createdAt"
WHERE "status" = 'DONE' AND "completedAt" IS NULL;

-- Backfill stable ordering per project based on existing creation order.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "projectId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) - 1 AS "nextOrderIndex"
  FROM "Task"
)
UPDATE "Task" t
SET "orderIndex" = ranked."nextOrderIndex"
FROM ranked
WHERE t."id" = ranked."id";

ALTER TABLE "Task"
ALTER COLUMN "orderIndex" SET NOT NULL,
ALTER COLUMN "orderIndex" SET DEFAULT 0;

CREATE INDEX "Task_projectId_orderIndex_idx" ON "Task"("projectId", "orderIndex");
