import { embedText, cosineSimilarity, parseEmbeddingJson } from "@/lib/agent/embeddings";
import { hasOpenAIKey } from "@/lib/agent/openai-client";
import { prisma } from "@/lib/db/prisma";
import { buildSourceSnippet, formatCitation, type RetrievedSpanishSource } from "./citations";
import { getEmbeddingStatus } from "./embedding-service";

export type RetrievalMode = "hybrid" | "semantic" | "keyword" | "none";

export type RetrieveSpanishSourcesOptions = {
  maxSources?: number;
  candidateLimit?: number;
  semanticCandidateLimit?: number;
  maxChunksPerPage?: number;
};

export type RankedSpanishSource = RetrievedSpanishSource & {
  citationLabel: string;
  preview: string;
  relevanceScore: number;
  semanticScore: number;
  keywordScore: number;
  combinedScore: number;
  matchedTerms: string[];
};

export type RetrieveSpanishSourcesResult = {
  sources: RankedSpanishSource[];
  retrievalMode: RetrievalMode;
  semanticCandidateCount: number;
  keywordCandidateCount: number;
};

type SourceChunkWithDocument = {
  id: string;
  documentId: string;
  pageId: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  characterCount: number;
  embeddingJson?: string | null;
  document: {
    fileName: string;
    originalFileName: string;
  };
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
): Promise<RetrieveSpanishSourcesResult> {
  const normalizedQuery = normalizeText(query);
  const terms = tokenizeQuery(normalizedQuery);

  if (!normalizedQuery) {
    return emptyRetrieval();
  }

  const candidateLimit = clampNumber(options.candidateLimit ?? 80, 10, 200);
  const semanticCandidateLimit = clampNumber(options.semanticCandidateLimit ?? 1200, 20, 3000);
  const maxSources = clampNumber(options.maxSources ?? 6, 1, 12);
  const maxChunksPerPage = clampNumber(options.maxChunksPerPage ?? 2, 1, 4);
  const [keywordRanked, semanticRanked] = await Promise.all([
    retrieveKeywordCandidates(normalizedQuery, terms, candidateLimit),
    retrieveSemanticCandidates(normalizedQuery, terms, semanticCandidateLimit)
  ]);
  const merged = mergeRankedSources(keywordRanked, semanticRanked);
  const sources = dedupeByPage(merged, maxSources, maxChunksPerPage);
  const retrievalMode = getRetrievalMode(sources, keywordRanked.length, semanticRanked.length);

  return {
    sources,
    retrievalMode,
    semanticCandidateCount: semanticRanked.length,
    keywordCandidateCount: keywordRanked.length
  };
}

async function retrieveKeywordCandidates(
  normalizedQuery: string,
  terms: string[],
  candidateLimit: number
) {
  if (terms.length === 0) {
    return [];
  }

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

  return candidates
    .map((chunk) => rankKeywordChunk(chunk, normalizedQuery, terms))
    .filter((source) => source.keywordScore > 0);
}

async function retrieveSemanticCandidates(
  normalizedQuery: string,
  terms: string[],
  semanticCandidateLimit: number
) {
  const embeddingStatus = await getEmbeddingStatus();

  if (!embeddingStatus.semanticRetrievalReady || !hasOpenAIKey()) {
    return [];
  }

  try {
    const queryEmbedding = await embedText(normalizedQuery);
    const candidates = await prisma.spanishSourceChunk.findMany({
      where: {
        embeddingJson: {
          not: null
        },
        text: {
          not: ""
        }
      },
      include: {
        document: true
      },
      take: semanticCandidateLimit
    });

    return candidates
      .map((chunk) => {
        const embedding = parseEmbeddingJson(chunk.embeddingJson);
        const semanticScore = embedding ? cosineSimilarity(queryEmbedding, embedding) : 0;
        const keywordRank = rankKeywordChunk(chunk, normalizedQuery, terms);

        return {
          ...keywordRank,
          semanticScore,
          relevanceScore: semanticScore * 100 + keywordRank.keywordScore,
          combinedScore: semanticScore * 100 + keywordRank.keywordScore
        };
      })
      .filter((source) => source.semanticScore > 0)
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 120);
  } catch {
    return [];
  }
}

function rankKeywordChunk(
  chunk: SourceChunkWithDocument,
  normalizedQuery: string,
  terms: string[]
): RankedSpanishSource {
  const searchableText = normalizeText(`${chunk.document.originalFileName} ${chunk.text}`);
  const exactPhraseMatch = terms.length > 0 && searchableText.includes(normalizedQuery);
  const matchedTerms = terms.filter((term) => searchableText.includes(term));
  const uniqueMatchedTerms = Array.from(new Set(matchedTerms));
  const filenameMatches = terms.filter((term) =>
    normalizeText(chunk.document.originalFileName).includes(term)
  ).length;
  const coverage = terms.length > 0 ? uniqueMatchedTerms.length / terms.length : 0;
  const earlyPageBoost = chunk.pageNumber <= 20 ? 4 : chunk.pageNumber <= 60 ? 2 : 0;
  const keywordScore =
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
    relevanceScore: keywordScore,
    semanticScore: 0,
    keywordScore,
    combinedScore: keywordScore,
    matchedTerms: uniqueMatchedTerms
  };
}

function mergeRankedSources(
  keywordRanked: RankedSpanishSource[],
  semanticRanked: RankedSpanishSource[]
) {
  const byChunkId = new Map<string, RankedSpanishSource>();

  for (const source of [...keywordRanked, ...semanticRanked]) {
    const existing = byChunkId.get(source.chunkId);

    if (!existing) {
      byChunkId.set(source.chunkId, source);
      continue;
    }

    byChunkId.set(source.chunkId, {
      ...existing,
      semanticScore: Math.max(existing.semanticScore, source.semanticScore),
      keywordScore: Math.max(existing.keywordScore, source.keywordScore),
      relevanceScore: Math.max(existing.relevanceScore, source.relevanceScore),
      combinedScore:
        Math.max(existing.semanticScore, source.semanticScore) * 100 +
        Math.max(existing.keywordScore, source.keywordScore),
      matchedTerms: Array.from(new Set([...existing.matchedTerms, ...source.matchedTerms]))
    });
  }

  return Array.from(byChunkId.values())
    .filter((source) => source.text.trim().length > 0 && source.combinedScore > 0)
    .sort((a, b) => {
      if (b.combinedScore !== a.combinedScore) {
        return b.combinedScore - a.combinedScore;
      }

      if (a.documentId !== b.documentId) {
        return a.originalFileName.localeCompare(b.originalFileName);
      }

      if (a.pageNumber !== b.pageNumber) {
        return a.pageNumber - b.pageNumber;
      }

      return a.chunkIndex - b.chunkIndex;
    });
}

function getRetrievalMode(
  sources: RankedSpanishSource[],
  keywordCandidateCount: number,
  semanticCandidateCount: number
): RetrievalMode {
  if (sources.length === 0) {
    return "none";
  }

  if (semanticCandidateCount > 0 && keywordCandidateCount > 0) {
    return "hybrid";
  }

  if (semanticCandidateCount > 0) {
    return "semantic";
  }

  return "keyword";
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

function emptyRetrieval(): RetrieveSpanishSourcesResult {
  return {
    sources: [],
    retrievalMode: "none",
    semanticCandidateCount: 0,
    keywordCandidateCount: 0
  };
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}
