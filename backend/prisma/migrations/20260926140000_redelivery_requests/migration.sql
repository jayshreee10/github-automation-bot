-- CreateTable
CREATE TABLE "redelivery_requests" (
    "delivery_id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redelivery_requests_pkey" PRIMARY KEY ("delivery_id")
);

-- CreateIndex
CREATE INDEX "redelivery_requests_requested_at_idx" ON "redelivery_requests"("requested_at");

