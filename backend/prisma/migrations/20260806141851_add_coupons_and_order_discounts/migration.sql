/*
  Warnings:

  - Added the required column `subtotalAmount` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('PERCENTAGE', 'FIXED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "couponCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "couponId" TEXT,
ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "shippingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "subtotalAmount" DECIMAL(10,2),
ADD COLUMN     "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Backfill: historical orders had no discount, so subtotal == total.
UPDATE "Order" SET "subtotalAmount" = "totalAmount" WHERE "subtotalAmount" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "subtotalAmount" SET NOT NULL;

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "minOrderAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint: coupon value/minimum bounds
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_value_nonneg" CHECK ("value" >= 0);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_percentage_capped" CHECK ("type" != 'PERCENTAGE' OR "value" <= 100);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_minOrderAmount_nonneg" CHECK ("minOrderAmount" IS NULL OR "minOrderAmount" >= 0);

-- CheckConstraint: order money fields must stay internally consistent and non-negative
ALTER TABLE "Order" ADD CONSTRAINT "Order_subtotalAmount_nonneg" CHECK ("subtotalAmount" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_discountAmount_nonneg" CHECK ("discountAmount" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_discount_not_exceed_subtotal" CHECK ("discountAmount" <= "subtotalAmount");
ALTER TABLE "Order" ADD CONSTRAINT "Order_taxAmount_nonneg" CHECK ("taxAmount" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingAmount_nonneg" CHECK ("shippingAmount" >= 0);
