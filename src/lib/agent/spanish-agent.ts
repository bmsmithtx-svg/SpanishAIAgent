import type { SpanishAgentResponse } from "@/types";
import { getSourceLibraryStats } from "@/lib/sources/source-service";

export type SpanishAgentStatus = {
  appName: string;
  openAIConfigured: boolean;
  databaseConnected: boolean;
  sourceGroundingConfigured: boolean;
  sourceDocumentCount: number;
  sourcePageCount: number;
  sourceChunkCount: number;
  sourceIngestionReady: boolean;
  agentReady: boolean;
  message: string;
};

export async function getAgentStatus(): Promise<SpanishAgentStatus> {
  const openAIConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const stats = await getSourceLibraryStats();

  return {
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? "SpanishAIAgent",
    openAIConfigured,
    databaseConnected: stats.databaseConnected,
    sourceGroundingConfigured: stats.sourceIngestionReady,
    sourceDocumentCount: stats.sourceDocumentCount,
    sourcePageCount: stats.sourcePageCount,
    sourceChunkCount: stats.sourceChunkCount,
    sourceIngestionReady: stats.sourceIngestionReady,
    agentReady: false,
    message:
      "Agent is not active yet. The next step is retrieval-grounded AI chat over SpanishSourceChunk records with required file/page citations."
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
