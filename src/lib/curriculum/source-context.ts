import type { DailyLesson, LessonSourceReference, WeeklyAssessment } from "@/types";
import {
  retrieveSpanishSources,
  type RankedSpanishSource,
  type RetrievalMode
} from "@/lib/sources/retrieval";

export type LessonSourceContext = {
  query: string;
  retrievalMode: RetrievalMode;
  semanticCandidateCount: number;
  keywordCandidateCount: number;
  sourceReferences: LessonSourceReference[];
  sources: RankedSpanishSource[];
  message: string;
};

export async function getLessonSourceContext(lesson: DailyLesson): Promise<LessonSourceContext> {
  return getSourceContext({
    query: buildLessonQuery(lesson),
    emptyMessage:
      "No cited PDF source context is attached to this lesson yet. Lesson content must remain placeholder-only until retrieval finds supporting pages."
  });
}

export async function getAssessmentSourceContext(
  assessment: WeeklyAssessment
): Promise<LessonSourceContext> {
  if (assessment.sourceReferences.length > 0) {
    return {
      query: assessment.masteryRequirements.join(" "),
      retrievalMode: "keyword",
      semanticCandidateCount: 0,
      keywordCandidateCount: assessment.sourceReferences.length,
      sourceReferences: assessment.sourceReferences,
      sources: [],
      message:
        "This generated assessment is attached to PDF source references. Future grading must cite only these uploaded file/page windows."
    };
  }

  return getSourceContext({
    query: assessment.masteryRequirements.join(" "),
    emptyMessage:
      "No cited PDF source context is attached to this assessment yet. Assessment prompts must remain placeholders until PDF pages support them."
  });
}

async function getSourceContext({
  query,
  emptyMessage
}: {
  query: string;
  emptyMessage: string;
}): Promise<LessonSourceContext> {
  try {
    const retrieval = await retrieveSpanishSources(query, {
      maxSources: 5,
      candidateLimit: 50,
      semanticCandidateLimit: 400,
      maxChunksPerPage: 1
    });
    const sourceReferences = retrieval.sources.map(toLessonSourceReference);

    return {
      query,
      retrievalMode: retrieval.retrievalMode,
      semanticCandidateCount: retrieval.semanticCandidateCount,
      keywordCandidateCount: retrieval.keywordCandidateCount,
      sourceReferences,
      sources: retrieval.sources,
      message:
        sourceReferences.length > 0
          ? "PDF source context found. Future lesson content can cite these file/page references after generation is connected."
          : emptyMessage
    };
  } catch {
    return {
      query,
      retrievalMode: "none",
      semanticCandidateCount: 0,
      keywordCandidateCount: 0,
      sourceReferences: [],
      sources: [],
      message: `${emptyMessage} Source retrieval is currently unavailable, so the page is failing closed into placeholder mode.`
    };
  }
}

function buildLessonQuery(lesson: DailyLesson) {
  return [
    lesson.title,
    lesson.grammarFocus,
    lesson.vocabularyFocus,
    lesson.familyCommunicationGoal,
    ...lesson.masteryGoals
  ].join(" ");
}

function toLessonSourceReference(source: RankedSpanishSource): LessonSourceReference {
  return {
    fileName: source.originalFileName,
    pageNumber: source.pageNumber,
    documentId: source.documentId,
    pageId: source.pageId,
    chunkId: source.chunkId,
    citationLabel: source.citationLabel,
    preview: source.preview
  };
}
