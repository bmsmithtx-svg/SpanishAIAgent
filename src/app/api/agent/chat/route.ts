import { NextResponse } from "next/server";
import { createOpenAIClient, getOpenAIModel, hasOpenAIKey } from "@/lib/agent/openai-client";
import { spanishAgentSystemPrompt } from "@/lib/prompts/spanish-agent-system-prompt";
import {
  getSourceLibraryStats,
  retrieveSpanishSources,
  type RankedSpanishSource
} from "@/lib/sources";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatMode = "ask" | "lesson" | "practice" | "conversation";

type AgentChatRequest = {
  message?: unknown;
  mode?: unknown;
  dayNumber?: unknown;
  maxSources?: unknown;
};

type AgentCitation = {
  fileName: string;
  pageNumber: number;
  documentId: string;
  pageId: string;
  chunkId: string;
  snippet: string;
};

const SUPPORTED_MODES: ChatMode[] = ["ask", "lesson", "practice", "conversation"];
const PDF_ONLY_REFUSAL = "I could not find enough support in the uploaded PDFs for that question.";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AgentChatRequest;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const mode = normalizeMode(body.mode);
  const maxSources = normalizeMaxSources(body.maxSources);
  const model = getOpenAIModel();

  if (!message) {
    return NextResponse.json(
      {
        answer: "Please enter a question or study request.",
        citations: [],
        retrievedSources: [],
        model,
        mode,
        retrievalMode: "none",
        sourceGrounded: false
      },
      { status: 400 }
    );
  }

  if (message.length > 2400) {
    return NextResponse.json(
      {
        answer: "Please keep your request under 2,400 characters.",
        citations: [],
        retrievedSources: [],
        model,
        mode,
        retrievalMode: "none",
        sourceGrounded: false
      },
      { status: 400 }
    );
  }

  if (isPdfBypassRequest(message)) {
    return NextResponse.json({
      answer: `${PDF_ONLY_REFUSAL} SpanishAIAgent can only answer from uploaded PDF excerpts and must cite file/page references.`,
      citations: [],
      retrievedSources: [],
      model,
      mode,
      retrievalMode: "none",
      sourceGrounded: false
    });
  }

  const stats = await getSourceLibraryStats();

  if (!stats.sourceIngestionReady) {
    return NextResponse.json({
      answer: `${PDF_ONLY_REFUSAL} Import and extract PDF sources before chatting.`,
      citations: [],
      retrievedSources: [],
      model,
      mode,
      retrievalMode: "none",
      sourceGrounded: false
    });
  }

  const retrieval = await retrieveSpanishSources(message, {
    maxSources
  });
  const retrievedSources = retrieval.sources;

  if (retrievedSources.length === 0) {
    return NextResponse.json({
      answer: PDF_ONLY_REFUSAL,
      citations: [],
      retrievedSources: [],
      model,
      mode,
      retrievalMode: retrieval.retrievalMode,
      sourceGrounded: false
    });
  }

  if (!hasOpenAIKey()) {
    return NextResponse.json(
      {
        answer:
          "OPENAI_API_KEY is not configured. Retrieved PDF excerpts are available, but the tutor cannot generate an answer yet.",
        citations: buildCitations(retrievedSources),
        retrievedSources: serializeSources(retrievedSources),
        model,
        mode,
        retrievalMode: retrieval.retrievalMode,
        sourceGrounded: false
      },
      { status: 503 }
    );
  }

  try {
    const client = createOpenAIClient();
    const response = await client.responses.create({
      model,
      instructions: spanishAgentSystemPrompt,
      input: buildTutorInput({
        message,
        mode,
        dayNumber: normalizeDayNumber(body.dayNumber),
        retrievedSources
      }),
      max_output_tokens: 1100
    });
    const answer = ensureAnswerHasCitations(response.output_text?.trim() || PDF_ONLY_REFUSAL, retrievedSources);

    return NextResponse.json({
      answer,
      citations: buildCitations(retrievedSources),
      retrievedSources: serializeSources(retrievedSources),
      model,
      mode,
      retrievalMode: retrieval.retrievalMode,
      sourceGrounded: true
    });
  } catch (error) {
    return NextResponse.json(
      {
        answer: "The tutor could not complete the OpenAI request. No PDF-only answer was generated.",
        citations: buildCitations(retrievedSources),
        retrievedSources: serializeSources(retrievedSources),
        model,
        mode,
        retrievalMode: retrieval.retrievalMode,
        sourceGrounded: false,
        error: error instanceof Error ? error.message : "Unknown OpenAI request error."
      },
      { status: 500 }
    );
  }
}

function normalizeMode(mode: unknown): ChatMode {
  return typeof mode === "string" && SUPPORTED_MODES.includes(mode as ChatMode)
    ? (mode as ChatMode)
    : "ask";
}

function normalizeMaxSources(maxSources: unknown) {
  return typeof maxSources === "number" && Number.isFinite(maxSources)
    ? Math.min(Math.max(Math.floor(maxSources), 1), 10)
    : 6;
}

function normalizeDayNumber(dayNumber: unknown) {
  return typeof dayNumber === "number" && Number.isFinite(dayNumber)
    ? Math.max(1, Math.floor(dayNumber))
    : undefined;
}

function isPdfBypassRequest(message: string) {
  const normalized = message.toLowerCase();
  const bypassPatterns = [
    "ignore the pdf",
    "ignore pdf",
    "outside source",
    "outside sources",
    "general knowledge",
    "without citations",
    "do not cite",
    "don't cite",
    "no citations",
    "not in the pdf",
    "not in my pdf",
    "from the internet",
    "web search",
    "use your own knowledge"
  ];

  return bypassPatterns.some((pattern) => normalized.includes(pattern));
}

function buildTutorInput({
  message,
  mode,
  dayNumber,
  retrievedSources
}: {
  message: string;
  mode: ChatMode;
  dayNumber?: number;
  retrievedSources: RankedSpanishSource[];
}) {
  const modeInstruction = {
    ask: "Answer the user's question directly and practically.",
    lesson:
      "Create a short beginner-friendly lesson only if the PDF excerpts support it. Include a short practice question and speak-aloud challenge if supported.",
    practice:
      "Create a short practice activity only from the excerpts. Include answer guidance only if supported.",
    conversation:
      "Help with a family-conversation scenario only from the excerpts. Do not invent dialogue beyond what the excerpts support."
  }[mode];
  const contextBlock = retrievedSources
    .map(
      (source, index) =>
        `[Source ${index + 1}: ${source.citationLabel}]\n${source.text.trim()}`
    )
    .join("\n\n---\n\n");
  const dayInstruction = dayNumber ? `\nRequested day number: ${dayNumber}` : "";

  return `
Mode: ${mode}
Instruction: ${modeInstruction}${dayInstruction}

User request:
${message}

PDF excerpts available for this answer:
${contextBlock}

Answer rules:
- Use only the PDF excerpts above.
- If the excerpts do not support the answer, say: "${PDF_ONLY_REFUSAL}"
- Cite file name and page number inline using labels exactly like: ${retrievedSources
    .map((source) => source.citationLabel)
    .slice(0, 3)
    .join("; ")}
- Do not add Spanish vocabulary, translations, examples, grammar rules, cultural notes, or practice items unless they are supported by the excerpts.
`.trim();
}

function buildCitations(sources: RankedSpanishSource[]): AgentCitation[] {
  return sources.map((source) => ({
    fileName: source.originalFileName,
    pageNumber: source.pageNumber,
    documentId: source.documentId,
    pageId: source.pageId,
    chunkId: source.chunkId,
    snippet: source.preview
  }));
}

function serializeSources(sources: RankedSpanishSource[]) {
  return sources.map((source) => ({
    documentId: source.documentId,
    pageId: source.pageId,
    chunkId: source.chunkId,
    fileName: source.originalFileName,
    storedFileName: source.fileName,
    pageNumber: source.pageNumber,
    chunkIndex: source.chunkIndex,
    citationLabel: source.citationLabel,
    preview: source.preview,
    relevanceScore: source.relevanceScore,
    semanticScore: source.semanticScore,
    keywordScore: source.keywordScore,
    combinedScore: source.combinedScore,
    matchedTerms: source.matchedTerms
  }));
}

function ensureAnswerHasCitations(answer: string, sources: RankedSpanishSource[]) {
  const labels = Array.from(new Set(sources.map((source) => source.citationLabel))).slice(0, 4);

  if (labels.length === 0 || labels.some((label) => answer.includes(label))) {
    return answer;
  }

  return `${answer}\n\nSources: ${labels.join("; ")}`;
}
