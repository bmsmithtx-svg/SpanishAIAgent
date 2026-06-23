import { withDatabaseQueryTimeout } from "@/lib/db/query-timeout";
import {
  CURRICULUM_PAGE_FILTER_VERSION,
  INSTRUCTIONAL_PAGE_SCORE_THRESHOLD,
  buildEmptyClassificationSummary
} from "./page-classifier";
import type {
  CurriculumClassificationSummary,
  CurriculumFilteringMetadata,
  CurriculumGenerationStatus,
  CurriculumPageClassification,
  CurriculumPageClassificationSample,
  CurriculumSection,
  CurriculumSourceReference,
  CurriculumWeek,
  DailyLesson,
  GeneratedCurriculum,
  GeneratedCurriculumLessonShell,
  GeneratedCurriculumSection,
  GeneratedCurriculumWeek,
  LessonBlock,
  LessonSourceReference,
  WeeklyAssessment,
  WeeklyReviewDay
} from "@/types";

export const GENERATED_LESSON_BLOCKS: LessonBlock[] = [
  {
    kind: "vocabulary",
    label: "Vocabulary",
    minutes: 5,
    placeholder:
      "Vocabulary is generated on demand only after this lesson retrieves cited PDF chunks."
  },
  {
    kind: "grammar",
    label: "Grammar",
    minutes: 5,
    placeholder:
      "Grammar explanation is generated on demand only from the lesson's cited PDF pages."
  },
  {
    kind: "sentence-practice",
    label: "Sentence practice",
    minutes: 7,
    placeholder:
      "Sentence practice appears only when source chunks support the exact teaching content."
  },
  {
    kind: "challenge",
    label: "Challenge",
    minutes: 3,
    placeholder:
      "The challenge is generated from retrieved PDF support and keeps citations attached."
  }
];

export type FilteringRecordFields = {
  sourceDocumentCount: number;
  sourcePageCount: number;
  filteringEnabled: boolean;
  filteringVersion: string;
  generationMode: string;
  instructionalPageCount: number;
  excludedPageCount: number;
  classificationSummaryJson: string;
  filteringSamplesJson: string;
};

type CurriculumRecord = {
  id: string;
  title: string;
  status: string;
  sourceDocumentCount: number;
  sourcePageCount: number;
  sourceChunkCount: number;
  sectionCount: number;
  weekCount: number;
  lessonCount: number;
  filteringEnabled: boolean;
  filteringVersion: string;
  generationMode: string;
  instructionalPageCount: number;
  excludedPageCount: number;
  classificationSummaryJson: string;
  filteringSamplesJson: string;
  sourceCoverageJson: string;
  generatedAt: Date;
  updatedAt: Date;
  sections: SectionRecord[];
  lessons: LessonRecord[];
};

type SectionRecord = {
  id: string;
  sectionIndex: number;
  title: string;
  description: string;
  sourceDocumentIdsJson: string;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  weekStart: number;
  weekEnd: number;
  lessonCount: number;
  sourceReferencesJson: string;
};

type LessonRecord = {
  id: string;
  lessonId: string;
  dayNumber: number;
  weekNumber: number;
  dayInWeek: number;
  sectionTitle: string;
  title: string;
  grammarFocus: string;
  vocabularyFocus: string;
  estimatedMinutes: number;
  sourceDocumentIdsJson: string;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  sourceReferencesJson: string;
  retrievalQuery: string;
  buildsOnLessonIdsJson: string;
  masteryGoalsJson: string;
  contentGenerated: boolean;
  generatedContentId: string | null;
};

export async function getActiveGeneratedCurriculum(): Promise<GeneratedCurriculum | null> {
  return withDatabaseQueryTimeout(async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const record = await prisma.generatedCurriculum.findFirst({
      where: {
        status: "pdf_derived"
      },
      include: {
        sections: {
          orderBy: {
            sectionIndex: "asc"
          }
        },
        lessons: {
          orderBy: {
            dayNumber: "asc"
          }
        }
      },
      orderBy: {
        generatedAt: "desc"
      }
    });

    return record ? serializeCurriculum(record as CurriculumRecord) : null;
  }, null);
}

export async function listGeneratedCurriculumLessons() {
  const curriculum = await getActiveGeneratedCurriculum();

  return curriculum?.lessons ?? [];
}

export async function getGeneratedCurriculumLesson(lessonId: string) {
  const curriculum = await getActiveGeneratedCurriculum();

  return curriculum?.lessons.find((lesson) => lesson.lessonId === lessonId) ?? null;
}

export async function getGeneratedCurriculumLessonByDayNumber(dayNumber: number) {
  const curriculum = await getActiveGeneratedCurriculum();

  return curriculum?.lessons.find((lesson) => lesson.dayNumber === dayNumber) ?? null;
}

export async function getGeneratedCurriculumWeekByNumber(weekNumber: number) {
  const curriculum = await getActiveGeneratedCurriculum();
  const generatedWeek = curriculum?.sections
    .flatMap((section) => section.weeks)
    .find((week) => week.weekNumber === weekNumber);

  return generatedWeek ? generatedWeekToCurriculumWeek(generatedWeek) : null;
}

export function generatedCurriculumToSections(curriculum: GeneratedCurriculum): CurriculumSection[] {
  return curriculum.sections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    weeks: section.weeks.map(generatedWeekToCurriculumWeek)
  }));
}

export function generatedLessonShellToDailyLesson(shell: GeneratedCurriculumLessonShell): DailyLesson {
  return {
    id: shell.lessonId,
    sectionId: slugify(shell.sectionTitle),
    weekNumber: shell.weekNumber,
    dayNumber: shell.dayNumber,
    dayInWeek: shell.dayInWeek,
    title: shell.title,
    grammarFocus: shell.grammarFocus,
    vocabularyFocus: shell.vocabularyFocus,
    familyCommunicationGoal:
      "Practice useful family communication only from the cited PDF source window.",
    buildsOn: shell.buildsOnLessonIds,
    masteryGoals: shell.masteryGoals,
    estimatedMinutes: 20,
    blocks: GENERATED_LESSON_BLOCKS,
    sourceReferences: shell.sourceReferences.map(toLessonSourceReference)
  };
}

export function filteringFromRecord(record: FilteringRecordFields): CurriculumFilteringMetadata {
  const samplesPayload = parseJson<{
    threshold?: number;
    sourceDocumentsScanned?: number;
    pagesScanned?: number;
    sampleIncludedPages?: CurriculumPageClassificationSample[];
    sampleExcludedPages?: CurriculumPageClassificationSample[];
    warnings?: string[];
  }>(record.filteringSamplesJson, {});
  const enabled = Boolean(record.filteringEnabled);

  return {
    enabled,
    version: record.filteringVersion || (enabled ? CURRICULUM_PAGE_FILTER_VERSION : "none"),
    generationMode:
      record.generationMode === "filtered_instructional_pages"
        ? "filtered_instructional_pages"
        : "unfiltered",
    threshold: numberOr(samplesPayload.threshold, INSTRUCTIONAL_PAGE_SCORE_THRESHOLD),
    sourceDocumentsScanned: numberOr(samplesPayload.sourceDocumentsScanned, record.sourceDocumentCount),
    pagesScanned: numberOr(samplesPayload.pagesScanned, record.sourcePageCount),
    pagesIncluded: record.instructionalPageCount,
    pagesExcluded: record.excludedPageCount,
    classificationSummary: parseClassificationSummary(record.classificationSummaryJson),
    sampleIncludedPages: Array.isArray(samplesPayload.sampleIncludedPages)
      ? samplesPayload.sampleIncludedPages
      : [],
    sampleExcludedPages: Array.isArray(samplesPayload.sampleExcludedPages)
      ? samplesPayload.sampleExcludedPages
      : [],
    warnings: Array.isArray(samplesPayload.warnings) ? samplesPayload.warnings : []
  };
}

export function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function normalizeStatus(value: string): CurriculumGenerationStatus {
  const statuses: CurriculumGenerationStatus[] = [
    "seed",
    "pdf_derived",
    "mixed_fallback",
    "no_sources",
    "generating",
    "failed"
  ];

  return statuses.includes(value as CurriculumGenerationStatus)
    ? (value as CurriculumGenerationStatus)
    : "failed";
}

function serializeCurriculum(record: CurriculumRecord): GeneratedCurriculum {
  const lessons = record.lessons.map(serializeLesson);
  const weeksBySection = new Map<string, GeneratedCurriculumWeek[]>();
  const filtering = filteringFromRecord(record);

  for (const section of record.sections) {
    const sectionLessons = lessons.filter((lesson) => lesson.sectionTitle === section.title);

    weeksBySection.set(section.title, buildGeneratedWeeks(sectionLessons, section.title));
  }

  return {
    id: record.id,
    title: record.title,
    status: normalizeStatus(record.status),
    sourceDocumentCount: record.sourceDocumentCount,
    sourcePageCount: record.sourcePageCount,
    sourceChunkCount: record.sourceChunkCount,
    sectionCount: record.sectionCount,
    weekCount: record.weekCount,
    lessonCount: record.lessonCount,
    filtering,
    sourceCoverage: parseJson<CurriculumSourceReference[]>(record.sourceCoverageJson, []),
    generatedAt: record.generatedAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    sections: record.sections.map((section) => serializeSection(section, weeksBySection.get(section.title) ?? [])),
    lessons
  };
}

function serializeSection(
  section: SectionRecord,
  weeks: GeneratedCurriculumWeek[]
): GeneratedCurriculumSection {
  return {
    id: section.id,
    sectionIndex: section.sectionIndex,
    title: section.title,
    description: section.description,
    sourceDocumentIds: parseJson<string[]>(section.sourceDocumentIdsJson, []),
    sourcePageStart: section.sourcePageStart ?? undefined,
    sourcePageEnd: section.sourcePageEnd ?? undefined,
    weekStart: section.weekStart,
    weekEnd: section.weekEnd,
    lessonCount: section.lessonCount,
    sourceReferences: parseJson<CurriculumSourceReference[]>(section.sourceReferencesJson, []),
    weeks
  };
}

function serializeLesson(record: LessonRecord): GeneratedCurriculumLessonShell {
  return {
    id: record.id,
    lessonId: record.lessonId,
    dayNumber: record.dayNumber,
    weekNumber: record.weekNumber,
    dayInWeek: record.dayInWeek,
    sectionTitle: record.sectionTitle,
    title: record.title,
    grammarFocus: record.grammarFocus,
    vocabularyFocus: record.vocabularyFocus,
    estimatedMinutes: 20,
    sourceDocumentIds: parseJson<string[]>(record.sourceDocumentIdsJson, []),
    sourcePageStart: record.sourcePageStart ?? undefined,
    sourcePageEnd: record.sourcePageEnd ?? undefined,
    sourceReferences: parseJson<CurriculumSourceReference[]>(record.sourceReferencesJson, []),
    retrievalQuery: record.retrievalQuery,
    buildsOnLessonIds: parseJson<string[]>(record.buildsOnLessonIdsJson, []),
    masteryGoals: parseJson<string[]>(record.masteryGoalsJson, []),
    contentGenerated: record.contentGenerated,
    generatedContentId: record.generatedContentId ?? undefined
  };
}

function buildGeneratedWeeks(
  lessons: GeneratedCurriculumLessonShell[],
  sectionTitle: string
): GeneratedCurriculumWeek[] {
  const byWeek = new Map<number, GeneratedCurriculumLessonShell[]>();

  for (const lesson of lessons) {
    byWeek.set(lesson.weekNumber, [...(byWeek.get(lesson.weekNumber) ?? []), lesson]);
  }

  return Array.from(byWeek.entries()).map(([weekNumber, weekLessons]) => ({
    weekNumber,
    title: `Week ${weekNumber}: ${sectionTitle}`,
    sectionTitle,
    lessons: weekLessons,
    reviewTitle: `Week ${weekNumber} PDF-source review`,
    assessmentTitle: `Week ${weekNumber} PDF-source assessment`,
    sourceReferences: uniqueReferences(weekLessons.flatMap((lesson) => lesson.sourceReferences)).slice(0, 10)
  }));
}

function generatedWeekToCurriculumWeek(week: GeneratedCurriculumWeek): CurriculumWeek {
  const lessons = week.lessons.map(generatedLessonShellToDailyLesson);
  const sourceReferences = uniqueReferences(week.sourceReferences).map(toLessonSourceReference);
  const sectionId = slugify(week.sectionTitle);

  return {
    id: `generated-week-${week.weekNumber}`,
    sectionId,
    weekNumber: week.weekNumber,
    title: week.title,
    grammarTheme: week.sectionTitle,
    communicationGoal:
      "Practice only what the cited PDF lesson shells can support for family conversation.",
    lessons,
    reviewDay: buildGeneratedReviewDay(sectionId, week),
    assessment: buildGeneratedAssessment(sectionId, week, sourceReferences)
  };
}

function buildGeneratedReviewDay(
  sectionId: string,
  week: GeneratedCurriculumWeek
): WeeklyReviewDay {
  return {
    id: `generated-week-${week.weekNumber}-review`,
    sectionId,
    weekNumber: week.weekNumber,
    title: week.reviewTitle,
    goals: [
      "Review the cited page ranges for this week before assessment.",
      "Identify any source gaps instead of filling them with outside Spanish knowledge.",
      "Prepare questions that can be answered from uploaded PDF citations."
    ],
    placeholder:
      "Review prompts are generated only after the weekly PDF source windows are retrieved and cited."
  };
}

function buildGeneratedAssessment(
  sectionId: string,
  week: GeneratedCurriculumWeek,
  sourceReferences: LessonSourceReference[]
): WeeklyAssessment {
  const lessonGoals = week.lessons.flatMap((lesson) => lesson.masteryGoals).slice(0, 6);

  return {
    id: `generated-week-${week.weekNumber}-assessment`,
    sectionId,
    weekNumber: week.weekNumber,
    title: week.assessmentTitle,
    masteryRequirements:
      lessonGoals.length > 0
        ? lessonGoals
        : ["Show readiness using only the cited PDF source windows from this week."],
    passingThreshold: 80,
    sourceReferences
  };
}

function toLessonSourceReference(reference: CurriculumSourceReference): LessonSourceReference {
  return {
    fileName: reference.fileName,
    pageNumber: reference.pageNumber,
    documentId: reference.documentId,
    pageId: reference.pageId,
    chunkId: reference.chunkId,
    citationLabel: reference.citationLabel,
    preview: reference.snippet
  };
}

function parseClassificationSummary(value: string): CurriculumClassificationSummary {
  const parsed = parseJson<Partial<CurriculumClassificationSummary>>(value, {});
  const summary = buildEmptyClassificationSummary();

  for (const classification of Object.keys(summary) as CurriculumPageClassification[]) {
    const bucket = parsed[classification];

    if (!bucket) {
      continue;
    }

    summary[classification] = {
      total: numberOr(bucket.total, 0),
      included: numberOr(bucket.included, 0),
      excluded: numberOr(bucket.excluded, 0)
    };
  }

  return summary;
}

function uniqueReferences(references: CurriculumSourceReference[]) {
  const byPage = new Map<string, CurriculumSourceReference>();

  for (const reference of references) {
    byPage.set(`${reference.documentId}:${reference.pageNumber}`, reference);
  }

  return Array.from(byPage.values()).sort((a, b) => {
    if (a.fileName !== b.fileName) {
      return a.fileName.localeCompare(b.fileName);
    }

    return a.pageNumber - b.pageNumber;
  });
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "generated-curriculum";
}
