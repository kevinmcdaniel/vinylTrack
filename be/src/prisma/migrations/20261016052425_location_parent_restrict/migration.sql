-- DropForeignKey
ALTER TABLE "location" DROP CONSTRAINT "location_parentLocationId_fkey";

-- AddForeignKey
ALTER TABLE "location" ADD CONSTRAINT "location_parentLocationId_fkey" FOREIGN KEY ("parentLocationId") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
