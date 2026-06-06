export type SourceCitation = {
  sourceFileName: string;
  pageNumber: number;
  sectionOrChapter?: string;
  snippet?: string;
};

export type RetrievedSpanishSource = {
  documentId: string;
  pageId: string;
  chunkId: string;
  fileName: string;
  originalFileName: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  characterCount: number;
  citation: SourceCitation;
};

export function formatCitation(citation: Pick<SourceCitation, "sourceFileName" | "pageNumber">) {
  return `${citation.sourceFileName}, page ${citation.pageNumber}`;
}

export function buildSourceSnippet(text: string, query?: string, maxLength = 260) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  if (!query?.trim()) {
    return `${normalized.slice(0, maxLength).trim()}...`;
  }

  const lowerText = normalized.toLowerCase();
  const lowerQuery = query.trim().toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex === -1) {
    return `${normalized.slice(0, maxLength).trim()}...`;
  }

  const contextLength = Math.floor(maxLength / 2);
  const start = Math.max(0, matchIndex - contextLength);
  const end = Math.min(normalized.length, matchIndex + lowerQuery.length + contextLength);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalized.length ? "..." : "";

  return `${prefix}${normalized.slice(start, end).trim()}${suffix}`;
}
