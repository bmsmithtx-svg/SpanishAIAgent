import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  embedTexts,
  getEmbeddingDimensions,
  getEmbeddingModel,
  serializeEmbedding
} from "@/lib/agent/embeddings";
import { hasOpenAIKey } from "@/lib/agent/openai-client";
import { formatCitation } from "./citations";

export const DEFAULT_EMBEDDING_BACKFILL_LIMIT = 10;
export const HARD_EMBEDDING_BACKFILL_MAX_LIMIT = 100;
export const EMBEDDING_BACKFILL_WARNING =
  "Each non-dry-run embedding backfill request uses OpenAI API credits. Run it intentionally in small batches.";

export type EmbeddingStatus = {
  totalChunks: number;
  embeddedChunks: number;
  missingEmbeddings: number;
  failedEmbeddings: number;
  embeddingModel: string;
  embeddingDimensions: number;
  semanticRetrievalReady: boolean;
};

export type EmbeddingBackfillOptions = {
  limit?: number;
  batchSize?: number;
  dryRun?: boolean;
};

export type EmbeddingBackfillSampleChunk = {
  chunkId: string;
  documentId: string;
  pageId: string;
  fileName: string;
  pageNumber: number;
  chunkIndex: number;
  citationLabel: string;
};

export type EmbeddingBackfillResult = EmbeddingStatus & {
  dryRun: boolean;
  explicitLimit: boolean;
  effectiveLimit: number;
  maxLimit: number;
  warningMessage: string;
  alreadyEmbeddedCount: number;
  attemptedCount: number;
  wouldEmbedCount: number;
  successfulCount: number;
  failedCount: number;
  remainingCount: number;
  sampleChunks: EmbeddingBackfillSampleChunk[];
};

export async function getEmbeddingStatus(): Promise<EmbeddingStatus> {
  const embeddingModel = getEmbeddingModel();
  const embeddingDimensions = getEmbeddingDimensions();
  const [totalChunks, embeddedChunks, missingEmbeddings, failedEmbeddings] = await Promise.all([
    prisma.spanishSourceChunk.count(),
    prisma.spanishSourceChunk.count({
      where: {
        embeddingJson: {
          not: null
        },
        embeddingModel,
        embeddingDimensions
      }
    }),
    prisma.spanishSourceChunk.count({
      where: chunkNeedsEmbeddingWhere(embeddingModel, embeddingDimensions)
    }),
    prisma.spanishSourceChunk.count({
      where: {
        embeddingError: {
          not: null
        },
        embeddingJson: null
      }
    })
  ]);

  return {
    totalChunks,
    embeddedChunks,
    missingEmbeddings,
    failedEmbeddings,
    embeddingModel,
    embeddingDimensions,
    semanticRetrievalReady: embeddedChunks > 0
  };
}

export async function backfillChunkEmbeddings(
  options: EmbeddingBackfillOptions = {}
): Promise<EmbeddingBackfillResult> {
  const embeddingModel = getEmbeddingModel();
  const embeddingDimensions = getEmbeddingDimensions();
  const explicitLimit = typeof options.limit === "number" && Number.isFinite(options.limit);
  const limit = resolveEmbeddingBackfillLimit(options.limit);
  const batchSize = clampNumber(options.batchSize ?? 8, 1, Math.min(limit, 32));
  const statusBefore = await getEmbeddingStatus();
  const chunks = await prisma.spanishSourceChunk.findMany({
    where: chunkNeedsEmbeddingWhere(embeddingModel, embeddingDimensions),
    include: {
      document: true
    },
    orderBy: [
      {
        documentId: "asc"
      },
      {
        pageNumber: "asc"
      },
      {
        chunkIndex: "asc"
      }
    ],
    take: limit
  });
  const sampleChunks = buildSampleChunks(chunks);

  if (options.dryRun) {
    return {
      ...statusBefore,
      dryRun: true,
      explicitLimit,
      effectiveLimit: limit,
      maxLimit: getEmbeddingBackfillMaxLimit(),
      warningMessage: EMBEDDING_BACKFILL_WARNING,
      alreadyEmbeddedCount: statusBefore.embeddedChunks,
      attemptedCount: 0,
      wouldEmbedCount: chunks.length,
      successfulCount: 0,
      failedCount: 0,
      remainingCount: statusBefore.missingEmbeddings,
      sampleChunks
    };
  }

  if (!explicitLimit && chunks.length > 0 && statusBefore.missingEmbeddings <= limit) {
    throw new Error(
      "Refusing to embed all remaining chunks without an explicit limit. Pass a limit intentionally, such as { \"limit\": 10 }."
    );
  }

  if (chunks.length > 0 && !hasOpenAIKey()) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  let successfulCount = 0;
  let failedCount = 0;

  for (let start = 0; start < chunks.length; start += batchSize) {
    const batch = chunks.slice(start, start + batchSize);

    try {
      const embeddings = await embedTexts(batch.map((chunk) => chunk.text));

      await prisma.$transaction(
        batch.map((chunk, index) =>
          prisma.spanishSourceChunk.update({
            where: {
              id: chunk.id
            },
            data: {
              embeddingJson: serializeEmbedding(embeddings[index]),
              embeddingModel,
              embeddingDimensions,
              embeddedAt: new Date(),
              embeddingError: null
            }
          })
        )
      );
      successfulCount += batch.length;
    } catch (error) {
      failedCount += batch.length;
      await prisma.spanishSourceChunk.updateMany({
        where: {
          id: {
            in: batch.map((chunk) => chunk.id)
          }
        },
        data: {
          embeddingError: error instanceof Error ? error.message : "Embedding request failed."
        }
      });
    }
  }

  const statusAfter = await getEmbeddingStatus();

  return {
    ...statusAfter,
    dryRun: false,
    explicitLimit,
    effectiveLimit: limit,
    maxLimit: getEmbeddingBackfillMaxLimit(),
    warningMessage: EMBEDDING_BACKFILL_WARNING,
    alreadyEmbeddedCount: statusBefore.embeddedChunks,
    attemptedCount: chunks.length,
    wouldEmbedCount: chunks.length,
    successfulCount,
    failedCount,
    remainingCount: statusAfter.missingEmbeddings,
    sampleChunks
  };
}

export function getEmbeddingBackfillDefaultLimit() {
  const maxLimit = getEmbeddingBackfillMaxLimit();
  const parsed = Number.parseInt(process.env.EMBEDDING_BACKFILL_DEFAULT_LIMIT ?? "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(DEFAULT_EMBEDDING_BACKFILL_LIMIT, maxLimit);
  }

  return Math.min(Math.floor(parsed), maxLimit);
}

export function getEmbeddingBackfillMaxLimit() {
  const parsed = Number.parseInt(process.env.EMBEDDING_BACKFILL_MAX_LIMIT ?? "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return HARD_EMBEDDING_BACKFILL_MAX_LIMIT;
  }

  return Math.min(Math.floor(parsed), HARD_EMBEDDING_BACKFILL_MAX_LIMIT);
}

function resolveEmbeddingBackfillLimit(limit?: number) {
  return clampNumber(
    limit ?? getEmbeddingBackfillDefaultLimit(),
    1,
    getEmbeddingBackfillMaxLimit()
  );
}

function chunkNeedsEmbeddingWhere(
  embeddingModel: string,
  embeddingDimensions: number
): Prisma.SpanishSourceChunkWhereInput {
  return {
    text: {
      not: ""
    },
    OR: [
      {
        embeddingJson: null
      },
      {
        embeddingModel: {
          not: embeddingModel
        }
      },
      {
        embeddingDimensions: {
          not: embeddingDimensions
        }
      }
    ]
  };
}

function buildSampleChunks(
  chunks: Array<{
    id: string;
    documentId: string;
    pageId: string;
    pageNumber: number;
    chunkIndex: number;
    document: {
      originalFileName: string;
    };
  }>
): EmbeddingBackfillSampleChunk[] {
  return chunks.slice(0, 5).map((chunk) => ({
    chunkId: chunk.id,
    documentId: chunk.documentId,
    pageId: chunk.pageId,
    fileName: chunk.document.originalFileName,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    citationLabel: formatCitation({
      sourceFileName: chunk.document.originalFileName,
      pageNumber: chunk.pageNumber
    })
  }));
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}
