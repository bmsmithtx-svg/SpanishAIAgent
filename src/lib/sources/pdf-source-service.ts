import type { SpanishSourceDocument, SpanishSourcePage } from "@/types";
import { listSourceDocuments, searchSourceChunks } from "./source-service";

export async function listSpanishSourceDocuments(): Promise<SpanishSourceDocument[]> {
  const documents = await listSourceDocuments();

  return documents.map((document) => ({
    id: document.id,
    fileName: document.originalFileName,
    title: document.originalFileName,
    pageCount: document.pageCount,
    uploadedAt: document.createdAt,
    status:
      document.processingStatus === "completed"
        ? "indexed"
        : document.processingStatus === "failed"
          ? "failed"
          : "parsing",
    pages: []
  }));
}

export async function retrieveSourcePagesForQuery(
  query: string
): Promise<SpanishSourcePage[]> {
  const results = await searchSourceChunks(query, 10);

  return results.map((result) => ({
    id: result.pageId,
    documentId: result.documentId,
    pageNumber: result.pageNumber,
    text: result.text,
    citations: [
      {
        sourceFileName: result.originalFileName,
        pageNumber: result.pageNumber,
        snippet: result.preview
      }
    ]
  }));
}
