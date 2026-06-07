import { prisma } from "@/lib/db/prisma";
import {
  embedTexts,
  getEmbeddingDimensions,
  getEmbeddingModel,
  serializeEmbedding
} from "@/lib/agent/embeddings";
import { hasOpenAIKey } from "@/lib/agent/openai-client";

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
};

export type EmbeddingBackfillResult = EmbeddingStatus & {
  alreadyEmbeddedCount: number;
  attemptedCount: number;
  successfulCount: number;
  failedCount: number;
  remainingCount: number;
};

export async function getEmbeddingStatus(): Promise<EmbeddingStatus> {
  const embeddingModel = getEmbeddingModel();
  const embeddingDimensions = getEmbeddingDimensions();
  const [totalChunks, embeddedChunks, failedEmbeddings] = await Promise.all([
    prisma.spanishSourceChunk.count(),
    prisma.spanishSourceChunk.count({
      where: {
        embeddingJson: {
          not: null
        }
      }
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
  const missingEmbeddings = Math.max(totalChunks - embeddedChunks, 0);

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
  if (!hasOpenAIKey()) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const embeddingModel = getEmbeddingModel();
  const embeddingDimensions = getEmbeddingDimensions();
  const limit = clampNumber(options.limit ?? 25, 1, 200);
  const batchSize = clampNumber(options.batchSize ?? 8, 1, 32);
  const statusBefore = await getEmbeddingStatus();
  const chunks = await prisma.spanishSourceChunk.findMany({
    where: {
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
    alreadyEmbeddedCount: statusBefore.embeddedChunks,
    attemptedCount: chunks.length,
    successfulCount,
    failedCount,
    remainingCount: statusAfter.missingEmbeddings
  };
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}
