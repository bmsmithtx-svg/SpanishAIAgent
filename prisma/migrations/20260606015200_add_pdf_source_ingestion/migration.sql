-- CreateTable
CREATE TABLE "SpanishSourceDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "extractionMethod" TEXT NOT NULL DEFAULT 'unknown',
    "processingError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SpanishSourcePage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "extractionMethod" TEXT NOT NULL DEFAULT 'unknown',
    "characterCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpanishSourcePage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SpanishSourceDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpanishSourceChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "characterCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpanishSourceChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SpanishSourceDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SpanishSourceChunk_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SpanishSourcePage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SpanishSourceDocument_fileHash_key" ON "SpanishSourceDocument"("fileHash");

-- CreateIndex
CREATE INDEX "SpanishSourceDocument_fileHash_idx" ON "SpanishSourceDocument"("fileHash");

-- CreateIndex
CREATE INDEX "SpanishSourceDocument_processingStatus_idx" ON "SpanishSourceDocument"("processingStatus");

-- CreateIndex
CREATE INDEX "SpanishSourcePage_documentId_idx" ON "SpanishSourcePage"("documentId");

-- CreateIndex
CREATE INDEX "SpanishSourcePage_pageNumber_idx" ON "SpanishSourcePage"("pageNumber");

-- CreateIndex
CREATE INDEX "SpanishSourcePage_documentId_pageNumber_idx" ON "SpanishSourcePage"("documentId", "pageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SpanishSourcePage_documentId_pageNumber_key" ON "SpanishSourcePage"("documentId", "pageNumber");

-- CreateIndex
CREATE INDEX "SpanishSourceChunk_documentId_idx" ON "SpanishSourceChunk"("documentId");

-- CreateIndex
CREATE INDEX "SpanishSourceChunk_pageId_idx" ON "SpanishSourceChunk"("pageId");

-- CreateIndex
CREATE INDEX "SpanishSourceChunk_pageNumber_idx" ON "SpanishSourceChunk"("pageNumber");

-- CreateIndex
CREATE INDEX "SpanishSourceChunk_documentId_pageNumber_idx" ON "SpanishSourceChunk"("documentId", "pageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SpanishSourceChunk_pageId_chunkIndex_key" ON "SpanishSourceChunk"("pageId", "chunkIndex");
