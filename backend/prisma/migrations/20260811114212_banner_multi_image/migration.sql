-- Add the new multi-image column
ALTER TABLE "Banner" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill existing single-image banners into the new array column
UPDATE "Banner" SET "images" = ARRAY["image"] WHERE "image" IS NOT NULL AND "image" != '';

-- Drop the old single-image column now that data has been preserved
ALTER TABLE "Banner" DROP COLUMN "image";
