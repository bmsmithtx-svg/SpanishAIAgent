import { prisma } from "@/lib/db/prisma";
import { buildSourceSnippet, formatCitation, type RetrievedSpanishSource } from "./citations";

export type RetrieveSpanishSourcesOptions = {
  maxSources?: number;
  candidateLimit?: number;
  maxChunksPerPage?: number;
};

export type RankedSpanishSource = RetrievedSpanishSource & {
  citationLabel: string;
  preview: string;
  relevanceScore: number;
  matchedTerms: string[];
};

const STOP_WORDS = new Set([
  "a",
  "about",
  "and",
  "are",
  "based",
  "for",
  "from",
  "give",
  "how",
  "into",
  "lesson",
  "me",
  "my",
  "of",
  "on",
  "only",
  "pdf",
  "pdfs",
  "practice",
  "spanish",
  "teach",
  "the",
  "to",
  "using",
  "what",
  "with",
  "you"
]);

export async function retrieveSpanishSources(
  query: string,
  options: RetrieveSpanishSourcesOptions = {}
): Promise<RankedSpanishSource[]> {
  const normalizedQuery = normalizeText(query);
  const terms = tokenizeQuery(normalizedQuery);

  if (!normalizedQuery || terms.length === 0) {
    return [];
  }

  const candidateLimit = clampNumber(options.candidateLimit ?? 80, 10, 200);
  const maxSources = clampNumber(options.maxSources ?? 6, 1, 12);
  const maxChunksPerPage = clampNumber(options.maxChunksPerPage ?? 2, 1, 4);
  const candidates = await prisma.spanishSourceChunk.findMany({
    where: {
      text: {
        not: ""
      },
      OR: [
        {
          text: {
            contains: normalizedQuery
          }
        },
        ...terms.map((term) => ({
          text: {
            contains: term
          }
        })),
        ...terms.map((term) => ({
          document: {
            originalFileName: {
              contains: term
            }
          }
        }))
      ]
    },
    include: {
      document: true
    },
    take: candidateLimit
  });

  const ranked = candidates
    .map((chunk) => {
      const searchableText = normalizeText(`${chunk.document.originalFileName} ${chunk.text}`);
      const exactPhraseMatch = searchableText.includes(normalizedQuery);
      const matchedTerms = terms.filter((term) => searchableText.includes(term));
      const uniqueMatchedTerms = Array.from(new Set(matchedTerms));
      const filenameMatches = terms.filter((term) =>
        normalizeText(chunk.document.originalFileName).includes(term)
      ).length;
      const coverage = uniqueMatchedTerms.length / terms.length;
      const earlyPageBoost = chunk.pageNumber <= 20 ? 4 : chunk.pageNumber <= 60 ? 2 : 0;
      const score =
        (exactPhraseMatch ? 80 : 0) +
        uniqueMatchedTerms.length * 18 +
        coverage * 40 +
        filenameMatches * 10 +
        earlyPageBoost -
        Math.min(chunk.chunkIndex, 8) * 0.5;
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
        citationLabel: formatCitation(citation),
        preview: citation.snippet ?? "",
        relevanceScore: score,
        matchedTerms: uniqueMatchedTerms
      };
    })
    .filter((source) => source.text.trim().length > 0 && source.relevanceScore > 0)
    .sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }

      if (a.documentId !== b.documentId) {
        return a.originalFileName.localeCompare(b.originalFileName);
      }

      if (a.pageNumber !== b.pageNumber) {
        return a.pageNumber - b.pageNumber;
      }

      return a.chunkIndex - b.chunkIndex;
    });

  return dedupeByPage(ranked, maxSources, maxChunksPerPage);
}

function tokenizeQuery(query: string) {
  return Array.from(
    new Set(
      query
        .split(/[^a-z0-9áéíóúüñ]+/i)
        .map((term) => term.trim().toLowerCase())
        .filter((term) => term.length >= 3 && !STOP_WORDS.has(term))
    )
  ).slice(0, 12);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeByPage(
  ranked: RankedSpanishSource[],
  maxSources: number,
  maxChunksPerPage: number
) {
  const selected: RankedSpanishSource[] = [];
  const pageCounts = new Map<string, number>();
  const seenChunkIds = new Set<string>();

  for (const source of ranked) {
    if (seenChunkIds.has(source.chunkId)) {
      continue;
    }

    const pageKey = `${source.documentId}:${source.pageNumber}`;
    const pageCount = pageCounts.get(pageKey) ?? 0;

    if (pageCount >= maxChunksPerPage) {
      continue;
    }

    selected.push(source);
    seenChunkIds.add(source.chunkId);
    pageCounts.set(pageKey, pageCount + 1);

    if (selected.length >= maxSources) {
      break;
    }
  }

  return selected;
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}
