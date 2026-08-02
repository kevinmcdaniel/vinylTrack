-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_share" (
    "collectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'full',

    CONSTRAINT "collection_share_pkey" PRIMARY KEY ("collectionId","userId")
);

-- CreateTable
CREATE TABLE "artist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortName" TEXT,
    "notes" TEXT,

    CONSTRAINT "artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "format" TEXT,
    "year" INTEGER,
    "genre" TEXT,
    "notes" TEXT,
    "coverImageUrl" TEXT,

    CONSTRAINT "album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_artist" (
    "albumId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,

    CONSTRAINT "album_artist_pkey" PRIMARY KEY ("albumId","artistId")
);

-- CreateTable
CREATE TABLE "location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "parentLocationId" TEXT,
    "ownerId" TEXT,
    "notes" TEXT,

    CONSTRAINT "location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactNotes" TEXT,

    CONSTRAINT "source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copy" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "sourceId" TEXT,
    "dateAcquired" TIMESTAMP(3),
    "price" DECIMAL(10,2),
    "condition" TEXT,
    "notes" TEXT,

    CONSTRAINT "copy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "want_item" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "artistId" TEXT,
    "albumId" TEXT,
    "priority" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "want_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "collection_ownerId_idx" ON "collection"("ownerId");

-- CreateIndex
CREATE INDEX "collection_share_userId_idx" ON "collection_share"("userId");

-- CreateIndex
CREATE INDEX "artist_name_idx" ON "artist"("name");

-- CreateIndex
CREATE INDEX "album_collectionId_idx" ON "album"("collectionId");

-- CreateIndex
CREATE INDEX "album_title_idx" ON "album"("title");

-- CreateIndex
CREATE INDEX "album_artist_artistId_idx" ON "album_artist"("artistId");

-- CreateIndex
CREATE INDEX "location_parentLocationId_idx" ON "location"("parentLocationId");

-- CreateIndex
CREATE INDEX "location_ownerId_idx" ON "location"("ownerId");

-- CreateIndex
CREATE INDEX "copy_albumId_idx" ON "copy"("albumId");

-- CreateIndex
CREATE INDEX "copy_locationId_idx" ON "copy"("locationId");

-- CreateIndex
CREATE INDEX "want_item_collectionId_idx" ON "want_item"("collectionId");

-- CreateIndex
CREATE INDEX "want_item_artistId_idx" ON "want_item"("artistId");

-- CreateIndex
CREATE INDEX "want_item_albumId_idx" ON "want_item"("albumId");

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_share" ADD CONSTRAINT "collection_share_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_share" ADD CONSTRAINT "collection_share_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album" ADD CONSTRAINT "album_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_artist" ADD CONSTRAINT "album_artist_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_artist" ADD CONSTRAINT "album_artist_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location" ADD CONSTRAINT "location_parentLocationId_fkey" FOREIGN KEY ("parentLocationId") REFERENCES "location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location" ADD CONSTRAINT "location_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy" ADD CONSTRAINT "copy_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy" ADD CONSTRAINT "copy_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy" ADD CONSTRAINT "copy_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "want_item" ADD CONSTRAINT "want_item_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "want_item" ADD CONSTRAINT "want_item_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "want_item" ADD CONSTRAINT "want_item_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "album"("id") ON DELETE SET NULL ON UPDATE CASCADE;
