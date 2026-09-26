-- AlterTable
ALTER TABLE "installations" ADD COLUMN     "account_type" TEXT,
ADD COLUMN     "repository_selection" TEXT;

-- AlterTable
ALTER TABLE "repositories" ADD COLUMN     "default_branch" TEXT;

-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "duration_ms" INTEGER;

-- CreateIndex
CREATE INDEX "actions_rule_id_created_at_idx" ON "actions"("rule_id", "created_at");

