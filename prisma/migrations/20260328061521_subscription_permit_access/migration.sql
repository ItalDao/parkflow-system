/*
  Warnings:

  - Added the required column `parking_lot_id` to the `subscriptions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "parking_lot_id" TEXT NOT NULL,
ADD COLUMN     "space_id" TEXT;

-- CreateTable
CREATE TABLE "subscription_access_logs" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "parking_lot_id" TEXT NOT NULL,
    "space_id" TEXT,
    "entry_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "subscription_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_access_logs_vehicle_id_idx" ON "subscription_access_logs"("vehicle_id");

-- CreateIndex
CREATE INDEX "subscription_access_logs_parking_lot_id_idx" ON "subscription_access_logs"("parking_lot_id");

-- CreateIndex
CREATE INDEX "subscription_access_logs_subscription_id_idx" ON "subscription_access_logs"("subscription_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_parking_lot_id_fkey" FOREIGN KEY ("parking_lot_id") REFERENCES "parking_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_access_logs" ADD CONSTRAINT "subscription_access_logs_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_access_logs" ADD CONSTRAINT "subscription_access_logs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_access_logs" ADD CONSTRAINT "subscription_access_logs_parking_lot_id_fkey" FOREIGN KEY ("parking_lot_id") REFERENCES "parking_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_access_logs" ADD CONSTRAINT "subscription_access_logs_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
