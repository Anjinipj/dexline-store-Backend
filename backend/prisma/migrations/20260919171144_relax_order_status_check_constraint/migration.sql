-- Defense-in-depth CHECK constraints on Order.status / OrderStatusHistory.status
-- were added via raw SQL in the init migration and are invisible to Prisma's
-- schema diffing (schema.prisma types `status` as a plain String, with the
-- allowed values enforced only in application code — src/constants/orderStatus.js
-- — and this DB-level constraint). Adding "Confirmed" to that app-level list
-- without updating these would make every "Confirmed" status update fail at
-- the database with a check-constraint violation.
ALTER TABLE "Order" DROP CONSTRAINT "Order_status_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_status_check"
  CHECK ("status" IN ('Pending Confirmation','Confirmed','Payment Confirmed','Processing','Shipped','Delivered','Cancelled'));

ALTER TABLE "OrderStatusHistory" DROP CONSTRAINT "OrderStatusHistory_status_check";
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_status_check"
  CHECK ("status" IN ('Pending Confirmation','Confirmed','Payment Confirmed','Processing','Shipped','Delivered','Cancelled'));
