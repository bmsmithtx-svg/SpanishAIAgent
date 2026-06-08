import type {
  DailyLesson,
  GeneratedChallenge,
  GeneratedDailyLesson,
  GeneratedGrammarExplanation,
  GeneratedLessonBlock,
  GeneratedLessonCitation,
  GeneratedSentencePracticeItem,
  GeneratedVocabularyItem,
  LessonGenerationStatus
} from "@/types";
import { getDailyLessonByDayNumber } from "@/lib/curriculum/curriculum-map";
import { dailyLessonGenerationPrompt } from "@/lib/prompts/daily-lesson-generation-prompt";
import {
  getSourceLibraryStats,
  retrieveSpanishSources,
  type RankedSpanishSource,
  type RetrievalMode
} from "@/lib/sources";
import { createOpenAIClient, getOpenAIModel, hasOpenAIKey } from "./openai-client";

export type DailyLessonGenerationResult = {
  lesson: DailyLesson | null;
  generatedLesson: GeneratedDailyLesson;
};

type RawGeneratedLesson = {
  limitations?: unknown;
  vocabularyWarmup?: RawVocabularyBlock;
  grammarConcept?: RawGrammarBlock;
  sentenceBuilding?: RawSentenceBlock;
  typedSpeakAloudChallenge?: RawChallengeBlock;
};

type RawBlock = {
  title?: unknown;
  objective?: unknown;
  instructions?: unknown;
  citationLabels?: unknown;
  missingSourceWarning?: unknown;
};

type RawVocabularyBlock = RawBlock & {
  items?: unknown;
};

type RawGrammarBlock = RawBlock & {
  explanation?: unknown;
};

type RawSentenceBlock = RawBlock & {
  practiceItems?: unknown;
};

type RawChallengeBlock = RawBlock & {
  challenge?: unknown;
};

type RawVocabularyItem = {
  term?: unknown;
  meaning?: unknown;
  usageNote?: unknown;
  citationLabels?: unknown;
};

type RawGrammarExplanation = {
  summary?: unknown;
  keyPoints?: unknown;
  citationLabels?: unknown;
};

type RawSentencePracticeItem = {
  prompt?: unknown;
  learnerTask?: unknown;
  answerGuidance?: unknown;
  citationLabels?: unknown;
};

type RawChallenge = {
  prompt?: unknown;
  typedResponseInstructions?: unknown;
  speakAloudInstructions?: unknown;
  citationLabels?: unknown;
};

export async function generateDailyLesson(dayNumber: number): Promise<DailyLessonGenerationResult> {
  const lesson = getDailyLessonByDayNumber(dayNumber);

  if (!lesson) {
    return {
      lesson: null,
      generatedLesson: buildMissingLesson(dayNumber, "Lesson metadata was not found.")
    };
  }

  const generatedAt = new Date().toISOString();
  const stats = await getSourceLibraryStats();

  if (!stats.sourceIngestionReady) {
    return {
      lesson,
      generatedLesson: buildSafeLesson({
        lesson,
        generatedAt,
        status: "missing_source",
        retrievalMode: "none",
        citations: [],
        warning:
          stats.databaseConnected === false
            ? "The source database is not available. Add DATABASE_URL and run Prisma migrations before generating PDF-grounded lessons."
            : "No indexed PDF chunks are available yet. Import and extract PDFs before generating lesson content."
      })
    };
  }

  const retrieval = await retrieveSpanishSources(buildLessonRetrievalQuery(lesson), {
    maxSources: 8,
    candidateLimit: 120,
    semanticCandidateLimit: 900,
    maxChunksPerPage: 1
  }).catch(() => null);

  if (!retrieval || retrieval.sources.length === 0) {
    return {
      lesson,
      generatedLesson: buildSafeLesson({
        lesson,
        generatedAt,
        status: "missing_source",
        retrievalMode: retrieval?.retrievalMode ?? "none",
        citations: [],
        warning:
          "Not enough PDF support found for this lesson's grammar and vocabulary focus. Add or embed more relevant PDFs, then regenerate."
      })
    };
  }

  const citations = buildGeneratedLessonCitations(retrieval.sources);

  if (!hasOpenAIKey()) {
    return {
      lesson,
      generatedLesson: buildSafeLesson({
        lesson,
        generatedAt,
        status: "openai_not_configured",
        retrievalMode: retrieval.retrievalMode,
        citations,
        warning:
          "PDF source chunks were found, but OPENAI_API_KEY is not configured. Lesson generation cannot run yet."
      })
    };
  }

  try {
    const client = createOpenAIClient();
    const response = await client.responses.create({
      model: getOpenAIModel(),
      instructions: dailyLessonGenerationPrompt,
      input: buildOpenAIInput(lesson, retrieval.sources),
      max_output_tokens: 1900
    });
    const parsed = parseGeneratedLessonJson(response.output_text ?? "");

    if (!parsed) {
      return {
        lesson,
        generatedLesson: buildSafeLesson({
          lesson,
          generatedAt,
          status: "generation_failed",
          retrievalMode: retrieval.retrievalMode,
          citations,
          warning:
            "OpenAI returned an unstructured lesson response. The app did not display it because it could not verify block citations."
        })
      };
    }

    return {
      lesson,
      generatedLesson: buildGeneratedLesson({
        lesson,
        generatedAt,
        retrievalMode: retrieval.retrievalMode,
        citations,
        raw: parsed
      })
    };
  } catch (error) {
    return {
      lesson,
      generatedLesson: buildSafeLesson({
        lesson,
        generatedAt,
        status: "generation_failed",
        retrievalMode: retrieval.retrievalMode,
        citations,
        warning: "The lesson generator could not complete the OpenAI request.",
        error: error instanceof Error ? error.message : "Unknown lesson generation error."
      })
    };
  }
}

export function buildGeneratedLessonCitations(
  sources: RankedSpanishSource[]
): GeneratedLessonCitation[] {
  const citations = new Map<string, GeneratedLessonCitation>();

  for (const source of sources) {
    citations.set(source.citationLabel, {
      fileName: source.originalFileName,
      pageNumber: source.pageNumber,
      documentId: source.documentId,
      pageId: source.pageId,
      chunkId: source.chunkId,
      citationLabel: source.citationLabel,
      snippet: truncateText(source.preview || source.text, 280)
    });
  }

  return Array.from(citations.values());
}

function buildMissingLesson(dayNumber: number, warning: string): GeneratedDailyLesson {
  const generatedAt = new Date().toISOString();
  const placeholderLesson: DailyLesson = {
    id: `day-${dayNumber}`,
    sectionId: "missing",
    weekNumber: 0,
    dayNumber,
    dayInWeek: 0,
    title: "Lesson not found",
    grammarFocus: "Unavailable",
    vocabularyFocus: "Unavailable",
    familyCommunicationGoal: "Unavailable",
    buildsOn: [],
    masteryGoals: [],
    estimatedMinutes: 20,
    blocks: [],
    sourceReferences: []
  };

  return buildSafeLesson({
    lesson: placeholderLesson,
    generatedAt,
    status: "missing_source",
    retrievalMode: "none",
    citations: [],
    warning
  });
}

function buildSafeLesson({
  lesson,
  generatedAt,
  status,
  retrievalMode,
  citations,
  warning,
  error
}: {
  lesson: DailyLesson;
  generatedAt: string;
  status: LessonGenerationStatus;
  retrievalMode: RetrievalMode;
  citations: GeneratedLessonCitation[];
  warning: string;
  error?: string;
}): GeneratedDailyLesson {
  return {
    dayNumber: lesson.dayNumber,
    weekNumber: lesson.weekNumber,
    title: lesson.title,
    grammarFocus: lesson.grammarFocus,
    vocabularyFocus: lesson.vocabularyFocus,
    generatedAt,
    status,
    retrievalMode,
    semanticRetrievalUsed: retrievalMode === "hybrid",
    sourceGrounded: false,
    citations,
    vocabularyWarmup: buildSafeBlock("Vocabulary warm-up", 5, warning, citations, {
      items: []
    }),
    grammarConcept: buildSafeBlock("Grammar concept", 5, warning, citations, {
      explanation: {
        summary: "Grammar explanation is unavailable until PDF support is found and validated.",
        keyPoints: [],
        citations
      }
    }),
    sentenceBuilding: buildSafeBlock("Sentence-building practice", 7, warning, citations, {
      practiceItems: []
    }),
    typedSpeakAloudChallenge: buildSafeBlock("Typed/speak-aloud challenge", 3, warning, citations, {
      challenge: {
        prompt: "Challenge unavailable until source-grounded lesson content is generated.",
        typedResponseInstructions: "Do not invent a response. Regenerate after adding supporting PDFs.",
        speakAloudInstructions: "No speak-aloud prompt is available without PDF support.",
        citations
      }
    }),
    limitations: [warning],
    missingSourceWarning: warning,
    error
  };
}

function buildSafeBlock<T extends Record<string, unknown>>(
  title: string,
  minutes: number,
  warning: string,
  citations: GeneratedLessonCitation[],
  extra: T
): GeneratedLessonBlock & T {
  return {
    title,
    minutes,
    objective: "Source support required before this block can teach Spanish content.",
    instructions: warning,
    citations,
    missingSourceWarning: warning,
    ...extra
  };
}

function buildGeneratedLesson({
  lesson,
  generatedAt,
  retrievalMode,
  citations,
  raw
}: {
  lesson: DailyLesson;
  generatedAt: string;
  retrievalMode: RetrievalMode;
  citations: GeneratedLessonCitation[];
  raw: RawGeneratedLesson;
}): GeneratedDailyLesson {
  const fallbackCitations = citations.slice(0, 2);
  const vocabularyWarmup = buildVocabularyBlock(raw.vocabularyWarmup, fallbackCitations, citations);
  const grammarConcept = buildGrammarBlock(raw.grammarConcept, fallbackCitations, citations);
  const sentenceBuilding = buildSentenceBlock(raw.sentenceBuilding, fallbackCitations, citations);
  const typedSpeakAloudChallenge = buildChallengeBlock(
    raw.typedSpeakAloudChallenge,
    fallbackCitations,
    citations
  );
  const blockWarnings = [
    vocabularyWarmup.missingSourceWarning,
    grammarConcept.missingSourceWarning,
    sentenceBuilding.missingSourceWarning,
    typedSpeakAloudChallenge.missingSourceWarning
  ].filter((warning): warning is string => Boolean(warning));
  const limitations = [...toStringArray(raw.limitations, 8), ...blockWarnings];

  return {
    dayNumber: lesson.dayNumber,
    weekNumber: lesson.weekNumber,
    title: lesson.title,
    grammarFocus: lesson.grammarFocus,
    vocabularyFocus: lesson.vocabularyFocus,
    generatedAt,
    status: "generated",
    retrievalMode,
    semanticRetrievalUsed: retrievalMode === "hybrid",
    sourceGrounded: citations.length > 0,
    citations,
    vocabularyWarmup,
    grammarConcept,
    sentenceBuilding,
    typedSpeakAloudChallenge,
    limitations
  };
}

function buildVocabularyBlock(
  raw: RawVocabularyBlock | undefined,
  fallbackCitations: GeneratedLessonCitation[],
  allCitations: GeneratedLessonCitation[]
) {
  const blockCitations = citationsFromLabels(raw?.citationLabels, allCitations, fallbackCitations);
  const items = Array.isArray(raw?.items)
    ? raw.items.slice(0, 5).map((item) => buildVocabularyItem(item, allCitations, blockCitations))
    : [];

  return {
    ...buildBaseBlock(raw, "Vocabulary warm-up", 5, blockCitations),
    items
  };
}

function buildGrammarBlock(
  raw: RawGrammarBlock | undefined,
  fallbackCitations: GeneratedLessonCitation[],
  allCitations: GeneratedLessonCitation[]
) {
  const blockCitations = citationsFromLabels(raw?.citationLabels, allCitations, fallbackCitations);
  const explanation = buildGrammarExplanation(raw?.explanation, allCitations, blockCitations);

  return {
    ...buildBaseBlock(raw, "Grammar concept", 5, blockCitations),
    explanation
  };
}

function buildSentenceBlock(
  raw: RawSentenceBlock | undefined,
  fallbackCitations: GeneratedLessonCitation[],
  allCitations: GeneratedLessonCitation[]
) {
  const blockCitations = citationsFromLabels(raw?.citationLabels, allCitations, fallbackCitations);
  const practiceItems = Array.isArray(raw?.practiceItems)
    ? raw.practiceItems
        .slice(0, 6)
        .map((item) => buildSentencePracticeItem(item, allCitations, blockCitations))
    : [];

  return {
    ...buildBaseBlock(raw, "Sentence-building practice", 7, blockCitations),
    practiceItems
  };
}

function buildChallengeBlock(
  raw: RawChallengeBlock | undefined,
  fallbackCitations: GeneratedLessonCitation[],
  allCitations: GeneratedLessonCitation[]
) {
  const blockCitations = citationsFromLabels(raw?.citationLabels, allCitations, fallbackCitations);
  const challenge = buildChallenge(raw?.challenge, allCitations, blockCitations);

  return {
    ...buildBaseBlock(raw, "Typed/speak-aloud challenge", 3, blockCitations),
    challenge
  };
}

function buildBaseBlock(
  raw: RawBlock | undefined,
  fallbackTitle: string,
  minutes: number,
  citations: GeneratedLessonCitation[]
): GeneratedLessonBlock {
  return {
    title: toStringValue(raw?.title, fallbackTitle, 120),
    minutes,
    objective: toStringValue(raw?.objective, "Practice only what the cited PDFs support.", 280),
    instructions: toStringValue(
      raw?.instructions,
      "Use the cited PDF support below and do not add unsupported Spanish content.",
      900
    ),
    citations,
    missingSourceWarning: optionalString(raw?.missingSourceWarning, 400)
  };
}

function buildVocabularyItem(
  value: unknown,
  allCitations: GeneratedLessonCitation[],
  fallbackCitations: GeneratedLessonCitation[]
): GeneratedVocabularyItem {
  const raw = value as RawVocabularyItem;

  return {
    term: toStringValue(raw.term, "Source-supported term unavailable", 120),
    meaning: toStringValue(raw.meaning, "Meaning unavailable from the generated response.", 220),
    usageNote: optionalString(raw.usageNote, 260),
    citations: citationsFromLabels(raw.citationLabels, allCitations, fallbackCitations)
  };
}

function buildGrammarExplanation(
  value: unknown,
  allCitations: GeneratedLessonCitation[],
  fallbackCitations: GeneratedLessonCitation[]
): GeneratedGrammarExplanation {
  const raw = value as RawGrammarExplanation;

  return {
    summary: toStringValue(raw?.summary, "Grammar explanation unavailable from the generated response.", 900),
    keyPoints: toStringArray(raw?.keyPoints, 6),
    citations: citationsFromLabels(raw?.citationLabels, allCitations, fallbackCitations)
  };
}

function buildSentencePracticeItem(
  value: unknown,
  allCitations: GeneratedLessonCitation[],
  fallbackCitations: GeneratedLessonCitation[]
): GeneratedSentencePracticeItem {
  const raw = value as RawSentencePracticeItem;

  return {
    prompt: toStringValue(raw.prompt, "Source-supported sentence prompt unavailable", 360),
    learnerTask: toStringValue(raw.learnerTask, "Type a response only from the supported lesson material.", 420),
    answerGuidance: optionalString(raw.answerGuidance, 520),
    citations: citationsFromLabels(raw.citationLabels, allCitations, fallbackCitations)
  };
}

function buildChallenge(
  value: unknown,
  allCitations: GeneratedLessonCitation[],
  fallbackCitations: GeneratedLessonCitation[]
): GeneratedChallenge {
  const raw = value as RawChallenge;

  return {
    prompt: toStringValue(raw?.prompt, "Source-supported challenge unavailable", 420),
    typedResponseInstructions: toStringValue(
      raw?.typedResponseInstructions,
      "Type a short response only if the cited lesson material supports it.",
      420
    ),
    speakAloudInstructions: toStringValue(
      raw?.speakAloudInstructions,
      "Practice aloud independently using only the cited lesson material.",
      420
    ),
    citations: citationsFromLabels(raw?.citationLabels, allCitations, fallbackCitations)
  };
}

function buildLessonRetrievalQuery(lesson: DailyLesson) {
  return [
    `week ${lesson.weekNumber}`,
    lesson.title,
    lesson.grammarFocus,
    lesson.vocabularyFocus,
    lesson.familyCommunicationGoal,
    ...lesson.buildsOn,
    ...lesson.masteryGoals
  ].join(" ");
}

function buildOpenAIInput(lesson: DailyLesson, sources: RankedSpanishSource[]) {
  const allowedCitations = sources.map((source) => source.citationLabel).join("; ");
  const sourceContext = sources
    .slice(0, 8)
    .map(
      (source, index) =>
        `[Source ${index + 1}]
Citation label: ${source.citationLabel}
File: ${source.originalFileName}
Page: ${source.pageNumber}
Excerpt for grounding only:
${truncateText(source.text, 900)}`
    )
    .join("\n\n---\n\n");

  return `
Lesson metadata:
- Day number: ${lesson.dayNumber}
- Week number: ${lesson.weekNumber}
- Title: ${lesson.title}
- Grammar focus: ${lesson.grammarFocus}
- Vocabulary focus: ${lesson.vocabularyFocus}
- Family communication goal: ${lesson.familyCommunicationGoal}
- Builds on previous lessons: ${lesson.buildsOn.length > 0 ? lesson.buildsOn.join(", ") : "none"}
- Mastery goals: ${lesson.masteryGoals.join("; ")}

Allowed citation labels:
${allowedCitations}

PDF excerpts available for this lesson:
${sourceContext}

Generate the lesson only if the excerpts support it. Use exactly the JSON shape from the system instructions.
`.trim();
}

function parseGeneratedLessonJson(outputText: string): RawGeneratedLesson | null {
  const trimmed = outputText.trim();
  const jsonText = extractJsonObject(trimmed);

  if (!jsonText) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText) as RawGeneratedLesson;

    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function extractJsonObject(value: string) {
  if (value.startsWith("{") && value.endsWith("}")) {
    return value;
  }

  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  return start >= 0 && end > start ? value.slice(start, end + 1) : null;
}

function citationsFromLabels(
  labels: unknown,
  allCitations: GeneratedLessonCitation[],
  fallbackCitations: GeneratedLessonCitation[]
) {
  const citationByLabel = new Map(allCitations.map((citation) => [citation.citationLabel, citation]));
  const matched = toStringArray(labels, 8)
    .map((label) => citationByLabel.get(label))
    .filter((citation): citation is GeneratedLessonCitation => Boolean(citation));

  return matched.length > 0 ? matched : fallbackCitations;
}

function toStringArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => truncateText(item, 420));
}

function toStringValue(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? truncateText(value, maxLength) : fallback;
}

function optionalString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? truncateText(value, maxLength) : undefined;
}

function truncateText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trim()}...` : normalized;
}
