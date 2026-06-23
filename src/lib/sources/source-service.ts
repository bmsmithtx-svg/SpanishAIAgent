import crypto from "node:crypto";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { withDatabaseQueryTimeout } from "@/lib/db/query-timeout";
import {
  LOCAL_EXTRACTED_DIR,
  LOCAL_PDF_DIR,
  ensureLocalSourceDirectories,
  sanitizePdfFileName
} from "@/lib/sources/storage";
import { buildSourceSnippet, formatCitation, type RetrievedSpanishSource } from "./citations";
import { chunkSpanishSourcePage, extractPdfTextByPage, type ExtractedPdfPage } from "./extract-pdf";

export type SourceProcessingStatus = "pending" | "processing" | "completed" | "failed";
export type SourceExtractionMethod = "pdf-text" | "mixed" | "failed" | "unknown";

export type SourceDocumentListItem = {
  id: string;
  fileName: string;
  originalFileName: string;
  localPath: string;
  fileHash: string;
  pageCount: number;
  processingStatus: string;
  extractionMethod: string;
  processingError: string | null;
  createdAt: string;
  updatedAt: string;
  pageRecordCount: number;
  chunkCount: number;
};

export type SourcePageListItem = {
  id: string;
  documentId: string;
  pageNumber: number;
  text: string;
  extractionMethod: string;
  characterCount: number;
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
  citationLabel: string;
};

export type SourceSearchResult = RetrievedSpanishSource & {
  preview: string;
  citationLabel: string;
};

export type SourceLibraryStats = {
  databaseConnected: boolean;
  sourceDocumentCount: number;
  sourcePageCount: number;
  sourceChunkCount: number;
  completedDocumentCount: number;
  failedDocumentCount: number;
  sourceIngestionReady: boolean;
  error?: string;
};

type UploadResult = {
  duplicate: boolean;
  message: string;
  document: SourceDocumentListItem | null;
  error?: string;
};

type DocumentWithCounts = {
  id: string;
  fileName: string;
  originalFileName: string;
  localPath: string;
  fileHash: string;
  pageCount: number;
  processingStatus: string;
  extractionMethod: string;
  processingError: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    pages: number;
    chunks: number;
  };
};

function serializeDocument(document: DocumentWithCounts): SourceDocumentListItem {
  return {
    id: document.id,
    fileName: document.fileName,
    originalFileName: document.originalFileName,
    localPath: document.localPath,
    fileHash: document.fileHash,
    pageCount: document.pageCount,
    processingStatus: document.processingStatus,
    extractionMethod: document.extractionMethod,
    processingError: document.processingError,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    pageRecordCount: document._count.pages,
    chunkCount: document._count.chunks
  };
}

export async function getSourceLibraryStats(): Promise<SourceLibraryStats> {
  const fallback: SourceLibraryStats = {
    databaseConnected: false,
    sourceDocumentCount: 0,
    sourcePageCount: 0,
    sourceChunkCount: 0,
    completedDocumentCount: 0,
    failedDocumentCount: 0,
    sourceIngestionReady: false,
    error: "Unable to connect to the source database quickly."
  };

  return withDatabaseQueryTimeout<SourceLibraryStats>(async () => {
    const prisma = await getPrisma();
    const [sourceDocumentCount, sourcePageCount, sourceChunkCount, completedDocumentCount, failedDocumentCount] =
      await Promise.all([
        prisma.spanishSourceDocument.count(),
        prisma.spanishSourcePage.count(),
        prisma.spanishSourceChunk.count(),
        prisma.spanishSourceDocument.count({ where: { processingStatus: "completed" } }),
        prisma.spanishSourceDocument.count({ where: { processingStatus: "failed" } })
      ]);

    return {
      databaseConnected: true,
      sourceDocumentCount,
      sourcePageCount,
      sourceChunkCount,
      completedDocumentCount,
      failedDocumentCount,
      sourceIngestionReady: completedDocumentCount > 0 && sourcePageCount > 0 && sourceChunkCount > 0
    };
  }, fallback);
}

export async function listSourceDocuments() {
  return withDatabaseQueryTimeout(async () => {
    const prisma = await getPrisma();
    const documents = await prisma.spanishSourceDocument.findMany({
      include: {
        _count: {
          select: {
            pages: true,
            chunks: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return documents.map(serializeDocument);
  }, []);
}

export async function getSourceDocument(documentId: string) {
  return withDatabaseQueryTimeout(async () => {
    const prisma = await getPrisma();
    const document = await prisma.spanishSourceDocument.findUnique({
      where: {
        id: documentId
      },
      include: {
        _count: {
          select: {
            pages: true,
            chunks: true
          }
        }
      }
    });

    return document ? serializeDocument(document) : null;
  }, null);
}

export async function listSourcePages(documentId: string): Promise<SourcePageListItem[]> {
  return withDatabaseQueryTimeout(async () => {
    const prisma = await getPrisma();
    const document = await prisma.spanishSourceDocument.findUnique({
      where: {
        id: documentId
      },
      select: {
        originalFileName: true
      }
    });

    if (!document) {
      return [];
    }

    const pages = await prisma.spanishSourcePage.findMany({
      where: {
        documentId
      },
      include: {
        _count: {
          select: {
            chunks: true
          }
        }
      },
      orderBy: {
        pageNumber: "asc"
      }
    });

    return pages.map((page) => ({
      id: page.id,
      documentId: page.documentId,
      pageNumber: page.pageNumber,
      text: page.text,
      extractionMethod: page.extractionMethod,
      characterCount: page.characterCount,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
      chunkCount: page._count.chunks,
      citationLabel: formatCitation({
        sourceFileName: document.originalFileName,
        pageNumber: page.pageNumber
      })
    }));
  }, []);
}

export async function searchSourceChunks(query: string, take = 20): Promise<SourceSearchResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  return withDatabaseQueryTimeout(async () => {
    const prisma = await getPrisma();
    const chunks = await prisma.spanishSourceChunk.findMany({
      where: {
        text: {
          contains: normalizedQuery
        }
      },
      include: {
        document: true
      },
      orderBy: [
        {
          pageNumber: "asc"
        },
        {
          chunkIndex: "asc"
        }
      ],
      take
    });

    return chunks.map((chunk) => {
      const citation = {
        sourceFileName: chunk.document.originalFileName,
        pageNumber: chunk.pageNumber,
        snippet: buildSourceSnippet(chunk.text, normalizedQuery)
      };

      return {
        documentId: chunk.documentId,
        pageId: chunk.pageId,
        chunkId: chunk.id,
        fileName: chunk.document.fileName,
        originalFileName: chunk.document.originalFileName,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        characterCount: chunk.characterCount,
        citation,
        preview: citation.snippet,
        citationLabel: formatCitation(citation)
      };
    });
  }, []);
}

export async function uploadSpanishSourcePdf(file: File): Promise<UploadResult> {
  await ensureLocalSourceDirectories();

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return {
      duplicate: false,
      message: `${file.name} was skipped because it is not a PDF.`,
      document: null,
      error: "Only PDF files can be uploaded."
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
  const prisma = await getPrisma();
  const existing = await prisma.spanishSourceDocument.findUnique({
    where: {
      fileHash
    },
    include: {
      _count: {
        select: {
          pages: true,
          chunks: true
        }
      }
    }
  });

  if (existing) {
    return {
      duplicate: true,
      message: `${file.name} already exists in the source library.`,
      document: serializeDocument(existing)
    };
  }

  const safeFileName = sanitizePdfFileName(file.name);
  const storedFileName = `${fileHash.slice(0, 12)}-${safeFileName}`;
  const localPath = path.join(LOCAL_PDF_DIR, storedFileName);

  await writeFile(localPath, buffer);

  const createdDocument = await prisma.spanishSourceDocument.create({
    data: {
      fileName: storedFileName,
      originalFileName: file.name,
      localPath,
      fileHash,
      processingStatus: "processing",
      extractionMethod: "unknown"
    },
    include: {
      _count: {
        select: {
          pages: true,
          chunks: true
        }
      }
    }
  });

  try {
    const extraction = await extractPdfTextByPage(localPath);

    await prisma.$transaction(async (tx) => {
      await tx.spanishSourceChunk.deleteMany({
        where: {
          documentId: createdDocument.id
        }
      });
      await tx.spanishSourcePage.deleteMany({
        where: {
          documentId: createdDocument.id
        }
      });

      for (const page of extraction.pages) {
        const createdPage = await tx.spanishSourcePage.create({
          data: {
            documentId: createdDocument.id,
            pageNumber: page.pageNumber,
            text: page.text,
            extractionMethod: page.extractionMethod,
            characterCount: page.characterCount
          }
        });
        const chunks = chunkPageForCreate(createdDocument.id, createdPage.id, page);

        if (chunks.length > 0) {
          await tx.spanishSourceChunk.createMany({
            data: chunks
          });
        }
      }

      await tx.spanishSourceDocument.update({
        where: {
          id: createdDocument.id
        },
        data: {
          pageCount: extraction.pageCount,
          processingStatus: "completed",
          extractionMethod: extraction.extractionMethod,
          processingError: null
        }
      });
    });

    await writeExtractionSnapshot(createdDocument.id, extraction).catch(() => undefined);
  } catch (error) {
    await prisma.spanishSourceDocument.update({
      where: {
        id: createdDocument.id
      },
      data: {
        processingStatus: "failed",
        extractionMethod: "failed",
        processingError: error instanceof Error ? error.message : "PDF extraction failed."
      }
    });

    return {
      duplicate: false,
      message: `${file.name} was stored, but extraction failed.`,
      document: await getSourceDocument(createdDocument.id),
      error: error instanceof Error ? error.message : "PDF extraction failed."
    };
  }

  return {
    duplicate: false,
    message: `${file.name} was imported and extracted.`,
    document: await getSourceDocument(createdDocument.id)
  };
}

async function getPrisma() {
  const { prisma } = await import("@/lib/db/prisma");

  return prisma;
}

function chunkPageForCreate(documentId: string, pageId: string, page: ExtractedPdfPage) {
  return chunkSpanishSourcePage(page.text).map((text, chunkIndex) => ({
    documentId,
    pageId,
    pageNumber: page.pageNumber,
    chunkIndex,
    text,
    characterCount: text.length
  }));
}

async function writeExtractionSnapshot(
  documentId: string,
  extraction: {
    pageCount: number;
    extractionMethod: string;
    pages: ExtractedPdfPage[];
  }
) {
  await writeFile(
    path.join(LOCAL_EXTRACTED_DIR, `${documentId}.json`),
    JSON.stringify(
      {
        documentId,
        pageCount: extraction.pageCount,
        extractionMethod: extraction.extractionMethod,
        pages: extraction.pages.map((page) => ({
          pageNumber: page.pageNumber,
          extractionMethod: page.extractionMethod,
          characterCount: page.characterCount,
          text: page.text
        }))
      },
      null,
      2
    )
  );
}
