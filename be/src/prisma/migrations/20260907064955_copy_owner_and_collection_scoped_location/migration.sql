/*
  Warnings:

  - Added the required column `collectionId` to the `location` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "copy" ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "location" ADD COLUMN     "collectionId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "owner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "owner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owner_userId_idx" ON "owner"("userId");

-- CreateIndex
CREATE INDEX "owner_name_idx" ON "owner"("name");

-- CreateIndex
CREATE INDEX "copy_ownerId_idx" ON "copy"("ownerId");

-- CreateIndex
CREATE INDEX "location_collectionId_idx" ON "location"("collectionId");

-- AddForeignKey
ALTER TABLE "owner" ADD CONSTRAINT "owner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location" ADD CONSTRAINT "location_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy" ADD CONSTRAINT "copy_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
