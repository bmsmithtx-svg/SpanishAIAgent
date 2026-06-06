import type { SpanishAgentResponse } from "@/types";

export type SpanishAgentStatus = {
  appName: string;
  openAIConfigured: boolean;
  sourceGroundingConfigured: boolean;
  agentReady: boolean;
  message: string;
};

export function getAgentStatus(): SpanishAgentStatus {
  const openAIConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());

  return {
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? "SpanishAIAgent",
    openAIConfigured,
    sourceGroundingConfigured: false,
    agentReady: false,
    message:
      "Agent is not ready yet. PDF ingestion, retrieval, and citation enforcement must be implemented before tutor answers are enabled."
  };
}

export async function createNotImplementedAgentResponse(): Promise<SpanishAgentResponse> {
  return {
    answer:
      "SpanishAIAgent is not implemented yet. Future answers will require support from uploaded PDF sources.",
    citations: [],
    unsupportedBySources: true,
    followUpSuggestions: []
  };
}
