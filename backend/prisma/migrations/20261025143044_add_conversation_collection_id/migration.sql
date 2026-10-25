-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "collection_id" TEXT;

-- CreateIndex
CREATE INDEX "conversations_collection_id_idx" ON "conversations"("collection_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
