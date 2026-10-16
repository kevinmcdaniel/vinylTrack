/*
  Warnings:

  - You are about to drop the column `ownerId` on the `location` table. All the data in the column will be lost.
  - Made the column `ownerId` on table `copy` required. This step will fail if there are existing NULL values in that column.

*/
-- Guards (#56): fail loudly, before any DDL, rather than let SET NOT NULL
-- error opaquely or DROP COLUMN lose data. Both are expected to pass: the API
-- has required copy.ownerId since #54, and nothing has written
-- location.ownerId since #53. If either raises, fix the rows by hand first.
DO $$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM "copy" WHERE "ownerId" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION '#56: % copy row(s) have no ownerId; assign an owner before migrating', n;
  END IF;
  SELECT count(*) INTO n FROM "location" WHERE "ownerId" IS NOT NULL;
  IF n > 0 THEN
    RAISE EXCEPTION '#56: % location row(s) still have an ownerId; dropping it would lose data', n;
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "copy" DROP CONSTRAINT "copy_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "location" DROP CONSTRAINT "location_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "want_item" DROP CONSTRAINT "want_item_albumId_fkey";

-- DropForeignKey
ALTER TABLE "want_item" DROP CONSTRAINT "want_item_artistId_fkey";

-- DropIndex
DROP INDEX "location_ownerId_idx";

-- AlterTable
ALTER TABLE "copy" ALTER COLUMN "ownerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "location" DROP COLUMN "ownerId";

-- AddForeignKey
ALTER TABLE "copy" ADD CONSTRAINT "copy_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "want_item" ADD CONSTRAINT "want_item_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "want_item" ADD CONSTRAINT "want_item_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
