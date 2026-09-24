-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'dead');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('add_label', 'add_comment', 'slack_notify', 'ai_triage');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('pending', 'succeeded', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "installations" (
    "id" BIGINT NOT NULL,
    "user_id" TEXT NOT NULL,
    "github_account_id" BIGINT NOT NULL,
    "github_account_login" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" BIGINT NOT NULL,
    "installation_id" BIGINT NOT NULL,
    "full_name" TEXT NOT NULL,
    "is_private" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "action" TEXT,
    "repository_id" BIGINT,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" UUID NOT NULL,
    "repository_id" BIGINT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" UUID NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "rule_id" UUID NOT NULL,
    "type" "ActionType" NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "installations_user_id_idx" ON "installations"("user_id");

-- CreateIndex
CREATE INDEX "repositories_installation_id_idx" ON "repositories"("installation_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_repository_id_received_at_idx" ON "webhook_deliveries"("repository_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_delivery_id_key" ON "jobs"("delivery_id");

-- CreateIndex
CREATE INDEX "jobs_status_next_run_at_idx" ON "jobs"("status", "next_run_at");

-- CreateIndex
CREATE INDEX "rules_repository_id_event_enabled_idx" ON "rules"("repository_id", "event", "enabled");

-- CreateIndex
CREATE INDEX "actions_status_idx" ON "actions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "actions_delivery_id_rule_id_type_key" ON "actions"("delivery_id", "rule_id", "type");

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_installation_id_fkey" FOREIGN KEY ("installation_id") REFERENCES "installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "webhook_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "webhook_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
