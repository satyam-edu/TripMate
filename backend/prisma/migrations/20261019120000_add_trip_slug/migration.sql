-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Trip_slug_key" ON "Trip"("slug");
