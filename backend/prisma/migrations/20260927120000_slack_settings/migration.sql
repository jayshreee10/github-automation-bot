-- CreateTable
CREATE TABLE "slack_settings" (
    "user_id" TEXT NOT NULL,
    "webhook_cipher" TEXT,
    "webhook_last4" TEXT,
    "channel_label" TEXT,
    "include_link" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_settings_pkey" PRIMARY KEY ("user_id")
);
