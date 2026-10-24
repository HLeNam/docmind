-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "summarized_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "summary" TEXT;
