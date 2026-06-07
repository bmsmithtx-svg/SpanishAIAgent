import type { SpanishAgentResponse } from "@/types";
import { getOpenAIModel } from "@/lib/agent/openai-client";
import { getEmbeddingStatus } from "@/lib/sources/embedding-service";
import { getSourceLibraryStats } from "@/lib/sources/source-service";

export type SpanishAgentStatus = {
  appName: string;
  model: string;
  openAIConfigured: boolean;
  databaseConnected: boolean;
  sourceGroundingConfigured: boolean;
  sourceDocumentCount: number;
  sourcePageCount: number;
  sourceChunkCount: number;
  sourceIngestionReady: boolean;
  embeddingModel: string;
  embeddingDimensions: number;
  embeddedChunkCount: number;
  missingEmbeddingCount: number;
  semanticRetrievalReady: boolean;
  retrievalReady: boolean;
  chatReady: boolean;
  agentReady: boolean;
  message: string;
};

export async function getAgentStatus(): Promise<SpanishAgentStatus> {
  const openAIConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const [stats, embeddingStatus] = await Promise.all([
    getSourceLibraryStats(),
    getEmbeddingStatus()
  ]);
  const retrievalReady = stats.sourceChunkCount > 0;
  const chatReady = openAIConfigured && retrievalReady;

  return {
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? "SpanishAIAgent",
    model: getOpenAIModel(),
    openAIConfigured,
    databaseConnected: stats.databaseConnected,
    sourceGroundingConfigured: retrievalReady,
    sourceDocumentCount: stats.sourceDocumentCount,
    sourcePageCount: stats.sourcePageCount,
    sourceChunkCount: stats.sourceChunkCount,
    sourceIngestionReady: stats.sourceIngestionReady,
    embeddingModel: embeddingStatus.embeddingModel,
    embeddingDimensions: embeddingStatus.embeddingDimensions,
    embeddedChunkCount: embeddingStatus.embeddedChunks,
    missingEmbeddingCount: embeddingStatus.missingEmbeddings,
    semanticRetrievalReady: embeddingStatus.semanticRetrievalReady,
    retrievalReady,
    chatReady,
    agentReady: chatReady,
    message: chatReady
      ? "Retrieval-grounded chat is ready. Tutor answers must use retrieved SpanishSourceChunk records and cite file/page references."
      : "Chat is not ready yet. Configure OPENAI_API_KEY and import PDF chunks before tutor answers are enabled."
  };
}

export async function createNotImplementedAgentResponse(): Promise<SpanishAgentResponse> {
  return {
    answer:
      "SpanishAIAgent chat is not active yet. Future answers will retrieve SpanishSourceChunk records and cite uploaded PDF file/page references.",
    citations: [],
    unsupportedBySources: true,
    followUpSuggestions: []
  };
}
