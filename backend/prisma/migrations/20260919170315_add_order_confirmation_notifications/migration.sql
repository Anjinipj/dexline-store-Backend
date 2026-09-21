-- CreateEnum
CREATE TYPE "OrderNotificationType" AS ENUM ('order_confirmed');

-- CreateEnum
CREATE TYPE "OrderNotificationStatus" AS ENUM ('queued', 'sending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "OrderNotification" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "OrderNotificationType" NOT NULL,
    "status" "OrderNotificationStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT NOT NULL DEFAULT '',
    "providerMessageId" TEXT NOT NULL DEFAULT '',
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderNotification_status_nextAttemptAt_idx" ON "OrderNotification"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderNotification_orderId_type_key" ON "OrderNotification"("orderId", "type");

-- AddForeignKey
ALTER TABLE "OrderNotification" ADD CONSTRAINT "OrderNotification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
