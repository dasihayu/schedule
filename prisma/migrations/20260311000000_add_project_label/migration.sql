-- Add non-destructive label column for project categorization.
-- Existing rows will automatically receive default 'work'.
ALTER TABLE "Project"
ADD COLUMN "label" TEXT NOT NULL DEFAULT 'work';
