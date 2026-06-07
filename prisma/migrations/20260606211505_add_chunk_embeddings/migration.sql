-- AlterTable
ALTER TABLE "SpanishSourceChunk" ADD COLUMN "embeddedAt" DATETIME;
ALTER TABLE "SpanishSourceChunk" ADD COLUMN "embeddingDimensions" INTEGER;
ALTER TABLE "SpanishSourceChunk" ADD COLUMN "embeddingError" TEXT;
ALTER TABLE "SpanishSourceChunk" ADD COLUMN "embeddingJson" TEXT;
ALTER TABLE "SpanishSourceChunk" ADD COLUMN "embeddingModel" TEXT;

-- CreateIndex
CREATE INDEX "SpanishSourceChunk_embeddingModel_idx" ON "SpanishSourceChunk"("embeddingModel");

-- CreateIndex
CREATE INDEX "SpanishSourceChunk_embeddedAt_idx" ON "SpanishSourceChunk"("embeddedAt");
