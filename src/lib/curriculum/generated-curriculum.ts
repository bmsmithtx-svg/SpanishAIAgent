import { prisma } from "@/lib/db/prisma";
import { buildSourceSnippet, formatCitation, getSourceLibraryStats } from "@/lib/sources";
import {
  CURRICULUM_PAGE_FILTER_VERSION,
  INSTRUCTIONAL_PAGE_SCORE_THRESHOLD,
  buildEmptyClassificationSummary,
  classifyCurriculumPage
} from "./page-classifier";
import type {
  CurriculumClassificationSummary,
  CurriculumFilteringMetadata,
  CurriculumGenerationRun,
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
  GeneratedCurriculumStatusSummary,
  GeneratedCurriculumWeek,
  LessonBlock,
  LessonSourceReference,
  WeeklyAssessment,
  WeeklyReviewDay
} from "@/types";

const LESSONS_PER_WEEK = 5;
const PAGES_PER_LESSON = 3;
const CURRICULUM_TITLE = "PDF-derived Spanish curriculum";

const GENERATED_LESSON_BLOCKS: LessonBlock[] = [
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

type CurriculumGenerationOptions = {
  dryRun?: boolean;
};

export type CurriculumGenerationResult = {
  status: CurriculumGenerationStatus;
  message: string;
  dryRun: boolean;
  usedOpenAI: false;
  curriculum: GeneratedCurriculum | null;
  run: CurriculumGenerationRun;
  sourceDocumentCount: number;
  sourcePageCount: number;
  sourceChunkCount: number;
  generatedSectionCount: number;
  generatedWeekCount: number;
  generatedLessonCount: number;
  filtering: CurriculumFilteringMetadata;
};

type SourceChunkForCurriculum = {
  id: string;
  pageId: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  characterCount: number;
};

type SourcePageForCurriculum = {
  id: string;
  documentId: string;
  pageNumber: number;
  text: string;
  characterCount: number;
  chunks: SourceChunkForCurriculum[];
};

type ClassifiedSourcePageForCurriculum = SourcePageForCurriculum & {
  classification: CurriculumPageClassification;
  instructionalScore: number;
  includedInCurriculum: boolean;
  classificationReasons: string[];
};

type ClassifiedSourceDocumentForCurriculum = Omit<SourceDocumentForCurriculum, "pages"> & {
  pages: ClassifiedSourcePageForCurriculum[];
};

type SourceDocumentForCurriculum = {
  id: string;
  fileName: string;
  originalFileName: string;
  pageCount: number;
  pages: SourcePageForCurriculum[];
  _count: {
    pages: number;
    chunks: number;
  };
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

type RunRecord = {
  id: string;
  curriculumId: string | null;
  status: string;
  message: string;
  dryRun: boolean;
  usedOpenAI: boolean;
  sourceDocumentCount: number;
  sourcePageCount: number;
  sourceChunkCount: number;
  generatedSectionCount: number;
  generatedWeekCount: number;
  generatedLessonCount: number;
  filteringEnabled: boolean;
  filteringVersion: string;
  generationMode: string;
  instructionalPageCount: number;
  excludedPageCount: number;
  classificationSummaryJson: string;
  filteringSamplesJson: string;
  sourceCoverageJson: string;
  startedAt: Date;
  completedAt: Date | null;
};

type FilteringRecordFields = {
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

export async function getGeneratedCurriculumStatus(): Promise<GeneratedCurriculumStatusSummary> {
  const stats = await getSourceLibraryStats();

  try {
    const [curriculum, lastRun] = await Promise.all([
      getActiveGeneratedCurriculum(),
      getLatestCurriculumGenerationRun()
    ]);
    const sourcePdfsAvailable = stats.sourceIngestionReady;
    const curriculumMode = curriculum
      ? "pdf_derived"
      : sourcePdfsAvailable
        ? "mixed_fallback"
        : "seed";
    const activeFiltering = curriculum?.filtering ?? lastRun?.filtering ?? buildDefaultFilteringMetadata();

    return {
      sourceDocumentCount: stats.sourceDocumentCount,
      sourcePageCount: stats.sourcePageCount,
      sourceChunkCount: stats.sourceChunkCount,
      sourcePdfsAvailable,
      generatedCurriculumExists: Boolean(curriculum),
      curriculumMode,
      generatedLessonCount: curriculum?.lessonCount ?? 0,
      generatedWeekCount: curriculum?.weekCount ?? 0,
      generatedSectionCount: curriculum?.sectionCount ?? 0,
      curriculumBuiltWithPageFiltering: Boolean(curriculum?.filtering.enabled),
      totalSourcePages: stats.sourcePageCount,
      instructionalPagesIncluded: activeFiltering.pagesIncluded,
      nonInstructionalPagesExcluded: activeFiltering.pagesExcluded,
      lastGenerationMode: activeFiltering.generationMode,
      classificationSummary: activeFiltering.classificationSummary,
      filteringWarnings: activeFiltering.warnings,
      lastGeneratedAt: curriculum?.generatedAt,
      lastRun: lastRun ?? undefined,
      message: buildStatusMessage(curriculumMode, stats.sourceChunkCount, lastRun?.message)
    };
  } catch {
    const defaultFiltering = buildDefaultFilteringMetadata();

    return {
      sourceDocumentCount: stats.sourceDocumentCount,
      sourcePageCount: stats.sourcePageCount,
      sourceChunkCount: stats.sourceChunkCount,
      sourcePdfsAvailable: stats.sourceIngestionReady,
      generatedCurriculumExists: false,
      curriculumMode: "seed",
      generatedLessonCount: 0,
      generatedWeekCount: 0,
      generatedSectionCount: 0,
      curriculumBuiltWithPageFiltering: false,
      totalSourcePages: stats.sourcePageCount,
      instructionalPagesIncluded: 0,
      nonInstructionalPagesExcluded: 0,
      lastGenerationMode: defaultFiltering.generationMode,
      classificationSummary: defaultFiltering.classificationSummary,
      filteringWarnings: defaultFiltering.warnings,
      message:
        "Generated curriculum tables are not ready yet. The fixed 8-week seed curriculum remains active as the safe fallback."
    };
  }
}

export async function getActiveGeneratedCurriculum(): Promise<GeneratedCurriculum | null> {
  try {
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
  } catch {
    return null;
  }
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

function buildInstructionalPageGroups(
  pages: ClassifiedSourcePageForCurriculum[]
): ClassifiedSourcePageForCurriculum[][] {
  const groups: ClassifiedSourcePageForCurriculum[][] = [];
  let current: ClassifiedSourcePageForCurriculum[] = [];

  for (const page of pages) {
    const previous = current[current.length - 1];
    const startsNewBoundary = current.length > 0 && isInstructionalBoundary(page);
    const breaksPageRun = previous ? page.pageNumber > previous.pageNumber + 1 : false;

    if (current.length > 0 && (startsNewBoundary || breaksPageRun)) {
      groups.push(current);
      current = [];
    }

    current.push(page);

    if (current.length >= getMaxPagesForGroup(current)) {
      groups.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}

function getMaxPagesForGroup(pages: ClassifiedSourcePageForCurriculum[]) {
  return pages.some((page) => page.classification === "exercise" || page.classification === "review")
    ? 2
    : PAGES_PER_LESSON;
}

function isInstructionalBoundary(page: ClassifiedSourcePageForCurriculum) {
  const text = normalizeCurriculumText(page.text || page.chunks.map((chunk) => chunk.text).join(" "));
  const start = text.slice(0, 900);

  return /\b(chapter|unit|lesson|section|capitulo|unidad|leccion)\s+\d+/i.test(start);
}

function getPrimaryClassification(pages: ClassifiedSourcePageForCurriculum[]) {
  const priority: CurriculumPageClassification[] = [
    "grammar",
    "vocabulary",
    "exercise",
    "review",
    "culture_or_reading",
    "instructional"
  ];

  return (
    priority.find((classification) => pages.some((page) => page.classification === classification)) ??
    "instructional"
  );
}

function extractInstructionalHeading(pages: ClassifiedSourcePageForCurriculum[]) {
  for (const page of pages) {
    const lines = (page.text || page.chunks.map((chunk) => chunk.text).join("\n"))
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => isUsableHeading(line));
    const preferred = lines.find((line) =>
      /\b(chapter|unit|lesson|section|capitulo|unidad|leccion|grammar|vocabulary|vocabulario|ejercicio|exercise|review|repaso)\b/i.test(line)
    );

    if (preferred) {
      return truncateText(preferred, 90);
    }

    if (lines[0]) {
      return truncateText(lines[0], 90);
    }
  }

  return undefined;
}

function isUsableHeading(line: string) {
  if (line.length < 6 || line.length > 120) {
    return false;
  }

  if (/https?:\/\//i.test(line) || /copyright|creative commons|license|isbn|answer key|contents/i.test(line)) {
    return false;
  }

  if (/^[\d\W]+$/.test(line)) {
    return false;
  }

  return true;
}

function buildLessonShellTitle(
  classification: CurriculumPageClassification,
  heading: string | undefined,
  pageRange: string
) {
  const prefix = {
    grammar: "Grammar",
    vocabulary: "Vocabulary",
    exercise: "Practice",
    review: "Review",
    culture_or_reading: "Culture/reading",
    instructional: "Instructional",
    front_matter: "Instructional",
    table_of_contents: "Instructional",
    license_or_credits: "Instructional",
    answer_key: "Instructional",
    appendix: "Instructional",
    index_or_glossary: "Instructional",
    bibliography: "Instructional",
    unknown: "Instructional"
  }[classification];

  return heading ? `${prefix}: ${heading} (${pageRange})` : `${prefix} lesson from ${pageRange}`;
}

function buildLessonFocus(
  focusType: "grammar" | "vocabulary",
  classification: CurriculumPageClassification,
  heading: string | undefined,
  fileName: string,
  pageRange: string
) {
  const label = focusType === "grammar" ? "grammar" : "vocabulary";
  const classificationText = classification.replace(/_/g, " ");
  const headingText = heading ? `: ${heading}` : "";

  return `PDF-supported ${label} focus from ${fileName}, ${pageRange} (${classificationText})${headingText}`;
}

export async function generatePdfDerivedCurriculum(
  options: CurriculumGenerationOptions = {}
): Promise<CurriculumGenerationResult> {
  const dryRun = Boolean(options.dryRun);
  const startedAt = new Date();
  const documents = await getDocumentsForCurriculum();
  const availableDocuments = documents.filter((document) =>
    document.pages.some((page) => page.chunks.length > 0)
  );
  const classifiedDocuments = classifyDocumentsForCurriculum(availableDocuments);
  const filtering = buildFilteringMetadata(classifiedDocuments);
  const filteredDocuments = classifiedDocuments
    .map((document) => ({
      ...document,
      pages: document.pages.filter((page) => page.includedInCurriculum)
    }))
    .filter((document) => document.pages.length > 0);
  const sourceDocumentCount = availableDocuments.length;
  const sourcePageCount = availableDocuments.reduce(
    (total, document) => total + document.pages.filter((page) => page.chunks.length > 0).length,
    0
  );
  const sourceChunkCount = availableDocuments.reduce(
    (total, document) => total + document._count.chunks,
    0
  );

  if (sourceDocumentCount === 0 || sourcePageCount === 0 || sourceChunkCount === 0) {
    const message =
      "No imported PDF chunks are available yet. The app is staying on the safe 8-week seed fallback; import PDFs before generating a PDF-derived curriculum.";
    const run = await maybePersistRun({
      dryRun,
      startedAt,
      status: "no_sources",
      message,
      sourceDocumentCount,
      sourcePageCount,
      sourceChunkCount,
      generatedSectionCount: 0,
      generatedWeekCount: 0,
      generatedLessonCount: 0,
      filtering,
      sourceCoverage: []
    });

    return buildGenerationResult({
      status: "no_sources",
      message,
      dryRun,
      curriculum: null,
      run,
      sourceDocumentCount,
      sourcePageCount,
      sourceChunkCount,
      generatedSectionCount: 0,
      generatedWeekCount: 0,
      generatedLessonCount: 0,
      filtering
    });
  }

  if (filtering.pagesIncluded === 0) {
    const message =
      "PDF chunks exist, but the page filter did not find instructional pages eligible for curriculum shells. Review classification settings or imported sources.";
    const run = await maybePersistRun({
      dryRun,
      startedAt,
      status: "no_sources",
      message,
      sourceDocumentCount,
      sourcePageCount,
      sourceChunkCount,
      generatedSectionCount: 0,
      generatedWeekCount: 0,
      generatedLessonCount: 0,
      filtering,
      sourceCoverage: []
    });

    return buildGenerationResult({
      status: "no_sources",
      message,
      dryRun,
      curriculum: null,
      run,
      sourceDocumentCount,
      sourcePageCount,
      sourceChunkCount,
      generatedSectionCount: 0,
      generatedWeekCount: 0,
      generatedLessonCount: 0,
      filtering
    });
  }

  const draft = buildCurriculumDraft(filteredDocuments, filtering);
  const message = dryRun
    ? `Dry run only: ${draft.lessonCount} lesson shells would be generated from ${filtering.pagesIncluded} filtered instructional pages. ${filtering.pagesExcluded} non-instructional pages would be excluded. No database writes or OpenAI calls were made.`
    : `Generated ${draft.lessonCount} lesson shells from ${filtering.pagesIncluded} filtered instructional pages. ${filtering.pagesExcluded} non-instructional pages were excluded. Full lesson content remains on-demand and source-cited.`;
  const runDraft = buildRun({
    id: "dry-run",
    curriculumId: dryRun ? undefined : draft.id,
    dryRun,
    startedAt,
    status: "pdf_derived",
    message,
    sourceDocumentCount,
    sourcePageCount,
    sourceChunkCount,
    generatedSectionCount: draft.sectionCount,
    generatedWeekCount: draft.weekCount,
    generatedLessonCount: draft.lessonCount,
    filtering,
    sourceCoverage: draft.sourceCoverage
  });

  if (dryRun) {
    return buildGenerationResult({
      status: "pdf_derived",
      message,
      dryRun,
      curriculum: draft,
      run: runDraft,
      sourceDocumentCount,
      sourcePageCount,
      sourceChunkCount,
      generatedSectionCount: draft.sectionCount,
      generatedWeekCount: draft.weekCount,
      generatedLessonCount: draft.lessonCount,
      filtering
    });
  }

  const { curriculum, run } = await prisma.$transaction(async (tx) => {
    await tx.generatedCurriculum.deleteMany();

    const created = await tx.generatedCurriculum.create({
      data: {
        title: CURRICULUM_TITLE,
        status: "pdf_derived",
        sourceDocumentCount,
        sourcePageCount,
        sourceChunkCount,
        sectionCount: draft.sectionCount,
        weekCount: draft.weekCount,
        lessonCount: draft.lessonCount,
        filteringEnabled: draft.filtering.enabled,
        filteringVersion: draft.filtering.version,
        generationMode: draft.filtering.generationMode,
        instructionalPageCount: draft.filtering.pagesIncluded,
        excludedPageCount: draft.filtering.pagesExcluded,
        classificationSummaryJson: stringifyJson(draft.filtering.classificationSummary),
        filteringSamplesJson: stringifyJson(buildFilteringSamplesPayload(draft.filtering)),
        sourceCoverageJson: stringifyJson(draft.sourceCoverage)
      }
    });
    const sectionIdsByTitle = new Map<string, string>();

    for (const section of draft.sections) {
      const createdSection = await tx.generatedCurriculumSection.create({
        data: {
          curriculumId: created.id,
          sectionIndex: section.sectionIndex,
          title: section.title,
          description: section.description,
          sourceDocumentIdsJson: stringifyJson(section.sourceDocumentIds),
          sourcePageStart: section.sourcePageStart,
          sourcePageEnd: section.sourcePageEnd,
          weekStart: section.weekStart,
          weekEnd: section.weekEnd,
          lessonCount: section.lessonCount,
          sourceReferencesJson: stringifyJson(section.sourceReferences)
        }
      });

      sectionIdsByTitle.set(section.title, createdSection.id);
    }

    for (const lesson of draft.lessons) {
      const sectionId = sectionIdsByTitle.get(lesson.sectionTitle);

      if (!sectionId) {
        continue;
      }

      await tx.generatedCurriculumLesson.create({
        data: {
          curriculumId: created.id,
          sectionId,
          lessonId: lesson.lessonId,
          dayNumber: lesson.dayNumber,
          weekNumber: lesson.weekNumber,
          dayInWeek: lesson.dayInWeek,
          sectionTitle: lesson.sectionTitle,
          title: lesson.title,
          grammarFocus: lesson.grammarFocus,
          vocabularyFocus: lesson.vocabularyFocus,
          estimatedMinutes: lesson.estimatedMinutes,
          sourceDocumentIdsJson: stringifyJson(lesson.sourceDocumentIds),
          sourcePageStart: lesson.sourcePageStart,
          sourcePageEnd: lesson.sourcePageEnd,
          sourceReferencesJson: stringifyJson(lesson.sourceReferences),
          retrievalQuery: lesson.retrievalQuery,
          buildsOnLessonIdsJson: stringifyJson(lesson.buildsOnLessonIds),
          masteryGoalsJson: stringifyJson(lesson.masteryGoals),
          contentGenerated: lesson.contentGenerated,
          generatedContentId: lesson.generatedContentId
        }
      });
    }

    const createdRun = await tx.generatedCurriculumRun.create({
      data: {
        curriculumId: created.id,
        status: "pdf_derived",
        message,
        dryRun: false,
        usedOpenAI: false,
        sourceDocumentCount,
        sourcePageCount,
        sourceChunkCount,
        generatedSectionCount: draft.sectionCount,
        generatedWeekCount: draft.weekCount,
        generatedLessonCount: draft.lessonCount,
        filteringEnabled: draft.filtering.enabled,
        filteringVersion: draft.filtering.version,
        generationMode: draft.filtering.generationMode,
        instructionalPageCount: draft.filtering.pagesIncluded,
        excludedPageCount: draft.filtering.pagesExcluded,
        classificationSummaryJson: stringifyJson(draft.filtering.classificationSummary),
        filteringSamplesJson: stringifyJson(buildFilteringSamplesPayload(draft.filtering)),
        sourceCoverageJson: stringifyJson(draft.sourceCoverage),
        startedAt,
        completedAt: new Date()
      }
    });
    const persisted = await tx.generatedCurriculum.findUniqueOrThrow({
      where: {
        id: created.id
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
      }
    });

    return {
      curriculum: serializeCurriculum(persisted as CurriculumRecord),
      run: serializeRun(createdRun as RunRecord)
    };
  });

  return buildGenerationResult({
    status: "pdf_derived",
    message,
    dryRun,
    curriculum,
    run,
    sourceDocumentCount,
    sourcePageCount,
    sourceChunkCount,
    generatedSectionCount: curriculum.sectionCount,
    generatedWeekCount: curriculum.weekCount,
    generatedLessonCount: curriculum.lessonCount,
    filtering: curriculum.filtering
  });
}

function buildCurriculumDraft(
  documents: ClassifiedSourceDocumentForCurriculum[],
  filtering: CurriculumFilteringMetadata
): GeneratedCurriculum {
  const generatedAt = new Date().toISOString();
  const lessons: GeneratedCurriculumLessonShell[] = [];
  const sections: GeneratedCurriculumSection[] = [];
  const sourceCoverage: CurriculumSourceReference[] = [];
  let previousLessonId: string | null = null;

  documents.forEach((document, documentIndex) => {
    const pages = document.pages.filter((page) => page.chunks.length > 0 && page.includedInCurriculum);
    const sectionLessons: GeneratedCurriculumLessonShell[] = [];
    const sectionTitle = buildSectionTitle(document.originalFileName, documentIndex + 1);
    const sectionStartPage = pages[0]?.pageNumber;
    const sectionEndPage = pages[pages.length - 1]?.pageNumber;
    const pageGroups = buildInstructionalPageGroups(pages);

    if (pages[0]) {
      const firstReference = buildReference(document, pages[0]);

      if (firstReference) {
        sourceCoverage.push(firstReference);
      }
    }

    for (const pageWindow of pageGroups) {
      const firstPage = pageWindow[0];
      const lastPage = pageWindow[pageWindow.length - 1];

      if (!firstPage || !lastPage) {
        continue;
      }

      const dayNumber = lessons.length + 1;
      const weekNumber = Math.ceil(dayNumber / LESSONS_PER_WEEK);
      const dayInWeek = ((dayNumber - 1) % LESSONS_PER_WEEK) + 1;
      const pageRange = formatPageRange(firstPage.pageNumber, lastPage.pageNumber);
      const lessonId = `pdf-${slugify(document.id)}-p${firstPage.pageNumber}-${lastPage.pageNumber}-d${dayNumber}`;
      const heading = extractInstructionalHeading(pageWindow);
      const primaryClassification = getPrimaryClassification(pageWindow);
      const sourceReferences = pageWindow
        .map((page) => buildReference(document, page))
        .filter((reference): reference is CurriculumSourceReference => Boolean(reference));
      const shell: GeneratedCurriculumLessonShell = {
        id: lessonId,
        lessonId,
        dayNumber,
        weekNumber,
        dayInWeek,
        sectionTitle,
        title: buildLessonShellTitle(primaryClassification, heading, pageRange),
        grammarFocus: buildLessonFocus("grammar", primaryClassification, heading, document.originalFileName, pageRange),
        vocabularyFocus: buildLessonFocus("vocabulary", primaryClassification, heading, document.originalFileName, pageRange),
        estimatedMinutes: 20,
        sourceDocumentIds: [document.id],
        sourcePageStart: firstPage.pageNumber,
        sourcePageEnd: lastPage.pageNumber,
        sourceReferences,
        retrievalQuery: [
          document.originalFileName,
          pageRange,
          heading,
          primaryClassification,
          sectionTitle,
          `week ${weekNumber}`,
          `day ${dayNumber}`
        ]
          .join(" ")
          .trim(),
        buildsOnLessonIds: previousLessonId ? [previousLessonId] : [],
        masteryGoals: [
          `Use only the cited PDF source window: ${pageRange}.`,
          "Identify what the source pages can support before practicing.",
          "Prepare a short family-communication practice only after lesson generation confirms citations."
        ],
        contentGenerated: false
      };

      lessons.push(shell);
      sectionLessons.push(shell);
      previousLessonId = lessonId;
    }

    if (sectionLessons.length === 0) {
      return;
    }

    const firstWeek = sectionLessons[0].weekNumber;
    const lastWeek = sectionLessons[sectionLessons.length - 1].weekNumber;
    const sectionWeeks = buildGeneratedWeeks(sectionLessons, sectionTitle);

    sections.push({
      id: `generated-section-${documentIndex + 1}-${slugify(document.originalFileName)}`,
      sectionIndex: documentIndex + 1,
      title: sectionTitle,
      description:
        "Generated from filtered instructional PDF page ranges. Front matter, licenses, answer keys, indexes, and other non-instructional pages are excluded before lesson shells are created.",
      sourceDocumentIds: [document.id],
      sourcePageStart: sectionStartPage,
      sourcePageEnd: sectionEndPage,
      weekStart: firstWeek,
      weekEnd: lastWeek,
      lessonCount: sectionLessons.length,
      sourceReferences: uniqueReferences(sectionLessons.flatMap((lesson) => lesson.sourceReferences)).slice(0, 12),
      weeks: sectionWeeks
    });
  });

  const weekCount = lessons.length > 0 ? Math.ceil(lessons.length / LESSONS_PER_WEEK) : 0;
  const sectionCount = sections.length;

  return {
    id: "draft-pdf-derived-curriculum",
    title: CURRICULUM_TITLE,
    status: "pdf_derived",
    sourceDocumentCount: documents.length,
    sourcePageCount: filtering.pagesScanned,
    sourceChunkCount: documents.reduce((total, document) => total + document._count.chunks, 0),
    sectionCount,
    weekCount,
    lessonCount: lessons.length,
    filtering,
    sourceCoverage: uniqueReferences(sourceCoverage),
    generatedAt,
    updatedAt: generatedAt,
    sections,
    lessons
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

async function getDocumentsForCurriculum(): Promise<SourceDocumentForCurriculum[]> {
  const documents = await prisma.spanishSourceDocument.findMany({
    where: {
      processingStatus: "completed"
    },
    include: {
      pages: {
        include: {
          chunks: {
            orderBy: {
              chunkIndex: "asc"
            }
          }
        },
        orderBy: {
          pageNumber: "asc"
        }
      },
      _count: {
        select: {
          pages: true,
          chunks: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  return documents.map((document) => ({
    id: document.id,
    fileName: document.fileName,
    originalFileName: document.originalFileName,
    pageCount: document.pageCount,
    pages: document.pages.map((page) => ({
      id: page.id,
      documentId: page.documentId,
      pageNumber: page.pageNumber,
      text: page.text,
      characterCount: page.characterCount,
      chunks: page.chunks.map((chunk) => ({
        id: chunk.id,
        pageId: chunk.pageId,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        characterCount: chunk.characterCount
      }))
    })),
    _count: document._count
  }));
}

function classifyDocumentsForCurriculum(
  documents: SourceDocumentForCurriculum[]
): ClassifiedSourceDocumentForCurriculum[] {
  return documents.map((document) => ({
    ...document,
    pages: document.pages.map((page) => {
      const result = classifyCurriculumPage({
        fileName: document.originalFileName,
        pageNumber: page.pageNumber,
        text: page.text,
        chunks: page.chunks
      });

      return {
        ...page,
        classification: result.classification,
        instructionalScore: result.score,
        includedInCurriculum: result.included,
        classificationReasons: result.reasons
      };
    })
  }));
}

function buildFilteringMetadata(
  documents: ClassifiedSourceDocumentForCurriculum[]
): CurriculumFilteringMetadata {
  const classificationSummary = buildEmptyClassificationSummary();
  const includedSamples: CurriculumPageClassificationSample[] = [];
  const excludedSamples: CurriculumPageClassificationSample[] = [];
  let pagesScanned = 0;
  let pagesIncluded = 0;
  let pagesExcluded = 0;

  for (const document of documents) {
    for (const page of document.pages.filter((candidate) => candidate.chunks.length > 0)) {
      const bucket = classificationSummary[page.classification];
      const sample = buildClassificationSample(document, page);

      pagesScanned += 1;
      bucket.total += 1;

      if (page.includedInCurriculum) {
        pagesIncluded += 1;
        bucket.included += 1;

        if (includedSamples.length < 8) {
          includedSamples.push(sample);
        }
      } else {
        pagesExcluded += 1;
        bucket.excluded += 1;

        if (shouldKeepExcludedSample(sample, excludedSamples)) {
          excludedSamples.push(sample);
        }
      }
    }
  }

  return {
    enabled: true,
    version: CURRICULUM_PAGE_FILTER_VERSION,
    generationMode: "filtered_instructional_pages",
    threshold: INSTRUCTIONAL_PAGE_SCORE_THRESHOLD,
    sourceDocumentsScanned: documents.length,
    pagesScanned,
    pagesIncluded,
    pagesExcluded,
    classificationSummary,
    sampleIncludedPages: includedSamples,
    sampleExcludedPages: excludedSamples.slice(0, 12),
    warnings: buildFilteringWarnings(classificationSummary, pagesIncluded, pagesExcluded)
  };
}

function buildClassificationSample(
  document: ClassifiedSourceDocumentForCurriculum,
  page: ClassifiedSourcePageForCurriculum
): CurriculumPageClassificationSample {
  const citationLabel = formatCitation({
    sourceFileName: document.originalFileName,
    pageNumber: page.pageNumber
  });

  return {
    fileName: document.originalFileName,
    documentId: document.id,
    pageId: page.id,
    pageNumber: page.pageNumber,
    classification: page.classification,
    score: page.instructionalScore,
    included: page.includedInCurriculum,
    reasons: page.classificationReasons,
    citationLabel
  };
}

function shouldKeepExcludedSample(
  sample: CurriculumPageClassificationSample,
  existing: CurriculumPageClassificationSample[]
) {
  if (existing.length < 4) {
    return true;
  }

  return !existing.some((candidate) => candidate.classification === sample.classification);
}

function buildFilteringWarnings(
  summary: CurriculumClassificationSummary,
  pagesIncluded: number,
  pagesExcluded: number
) {
  const warnings: string[] = [];

  if (pagesExcluded > 0) {
    warnings.push(`${pagesExcluded} non-instructional page(s) were excluded before shell generation.`);
  }

  for (const classification of [
    "front_matter",
    "table_of_contents",
    "license_or_credits",
    "answer_key",
    "appendix",
    "index_or_glossary",
    "bibliography"
  ] as CurriculumPageClassification[]) {
    const count = summary[classification].excluded;

    if (count > 0) {
      warnings.push(`${count} ${classification.replace(/_/g, " ")} page(s) excluded.`);
    }
  }

  if (pagesIncluded === 0) {
    warnings.push("No instructional pages met the filtering threshold.");
  }

  return warnings.slice(0, 8);
}

function buildFilteringSamplesPayload(filtering: CurriculumFilteringMetadata) {
  return {
    threshold: filtering.threshold,
    sourceDocumentsScanned: filtering.sourceDocumentsScanned,
    pagesScanned: filtering.pagesScanned,
    sampleIncludedPages: filtering.sampleIncludedPages,
    sampleExcludedPages: filtering.sampleExcludedPages,
    warnings: filtering.warnings
  };
}

function buildDefaultFilteringMetadata(): CurriculumFilteringMetadata {
  return {
    enabled: false,
    version: "none",
    generationMode: "unfiltered",
    threshold: INSTRUCTIONAL_PAGE_SCORE_THRESHOLD,
    sourceDocumentsScanned: 0,
    pagesScanned: 0,
    pagesIncluded: 0,
    pagesExcluded: 0,
    classificationSummary: buildEmptyClassificationSummary(),
    sampleIncludedPages: [],
    sampleExcludedPages: [],
    warnings: []
  };
}

function filteringFromRecord(record: FilteringRecordFields): CurriculumFilteringMetadata {
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

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

async function getLatestCurriculumGenerationRun() {
  try {
    const run = await prisma.generatedCurriculumRun.findFirst({
      orderBy: {
        startedAt: "desc"
      }
    });

    return run ? serializeRun(run as RunRecord) : null;
  } catch {
    return null;
  }
}

async function maybePersistRun({
  dryRun,
  startedAt,
  status,
  message,
  sourceDocumentCount,
  sourcePageCount,
  sourceChunkCount,
  generatedSectionCount,
  generatedWeekCount,
  generatedLessonCount,
  filtering,
  sourceCoverage
}: {
  dryRun: boolean;
  startedAt: Date;
  status: CurriculumGenerationStatus;
  message: string;
  sourceDocumentCount: number;
  sourcePageCount: number;
  sourceChunkCount: number;
  generatedSectionCount: number;
  generatedWeekCount: number;
  generatedLessonCount: number;
  filtering: CurriculumFilteringMetadata;
  sourceCoverage: CurriculumSourceReference[];
}) {
  if (dryRun) {
    return buildRun({
      id: "dry-run",
      dryRun,
      startedAt,
      status,
      message,
      sourceDocumentCount,
      sourcePageCount,
      sourceChunkCount,
      generatedSectionCount,
      generatedWeekCount,
      generatedLessonCount,
      filtering,
      sourceCoverage
    });
  }

  const run = await prisma.generatedCurriculumRun.create({
    data: {
      status,
      message,
      dryRun: false,
      usedOpenAI: false,
      sourceDocumentCount,
      sourcePageCount,
      sourceChunkCount,
      generatedSectionCount,
      generatedWeekCount,
      generatedLessonCount,
      filteringEnabled: filtering.enabled,
      filteringVersion: filtering.version,
      generationMode: filtering.generationMode,
      instructionalPageCount: filtering.pagesIncluded,
      excludedPageCount: filtering.pagesExcluded,
      classificationSummaryJson: stringifyJson(filtering.classificationSummary),
      filteringSamplesJson: stringifyJson(buildFilteringSamplesPayload(filtering)),
      sourceCoverageJson: stringifyJson(sourceCoverage),
      startedAt,
      completedAt: new Date()
    }
  });

  return serializeRun(run as RunRecord);
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

function serializeRun(record: RunRecord): CurriculumGenerationRun {
  return {
    id: record.id,
    curriculumId: record.curriculumId ?? undefined,
    status: normalizeStatus(record.status),
    message: record.message,
    dryRun: record.dryRun,
    usedOpenAI: record.usedOpenAI,
    sourceDocumentCount: record.sourceDocumentCount,
    sourcePageCount: record.sourcePageCount,
    sourceChunkCount: record.sourceChunkCount,
    generatedSectionCount: record.generatedSectionCount,
    generatedWeekCount: record.generatedWeekCount,
    generatedLessonCount: record.generatedLessonCount,
    filtering: filteringFromRecord(record),
    sourceCoverage: parseJson<CurriculumSourceReference[]>(record.sourceCoverageJson, []),
    startedAt: record.startedAt.toISOString(),
    completedAt: record.completedAt?.toISOString()
  };
}

function buildReference(
  document: SourceDocumentForCurriculum,
  page: SourcePageForCurriculum
): CurriculumSourceReference | null {
  const firstChunk = page.chunks[0];

  if (!firstChunk) {
    return null;
  }

  const citationLabel = formatCitation({
    sourceFileName: document.originalFileName,
    pageNumber: page.pageNumber
  });

  return {
    fileName: document.originalFileName,
    documentId: document.id,
    pageNumber: page.pageNumber,
    pageId: page.id,
    chunkId: firstChunk.id,
    citationLabel,
    snippet: buildSourceSnippet(firstChunk.text, undefined, 220)
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

function buildGenerationResult({
  status,
  message,
  dryRun,
  curriculum,
  run,
  sourceDocumentCount,
  sourcePageCount,
  sourceChunkCount,
  generatedSectionCount,
  generatedWeekCount,
  generatedLessonCount,
  filtering
}: Omit<CurriculumGenerationResult, "usedOpenAI">): CurriculumGenerationResult {
  return {
    status,
    message,
    dryRun,
    usedOpenAI: false,
    curriculum,
    run,
    sourceDocumentCount,
    sourcePageCount,
    sourceChunkCount,
    generatedSectionCount,
    generatedWeekCount,
    generatedLessonCount,
    filtering
  };
}

function buildRun({
  id,
  curriculumId,
  dryRun,
  startedAt,
  status,
  message,
  sourceDocumentCount,
  sourcePageCount,
  sourceChunkCount,
  generatedSectionCount,
  generatedWeekCount,
  generatedLessonCount,
  filtering,
  sourceCoverage
}: {
  id: string;
  curriculumId?: string;
  dryRun: boolean;
  startedAt: Date;
  status: CurriculumGenerationStatus;
  message: string;
  sourceDocumentCount: number;
  sourcePageCount: number;
  sourceChunkCount: number;
  generatedSectionCount: number;
  generatedWeekCount: number;
  generatedLessonCount: number;
  filtering: CurriculumFilteringMetadata;
  sourceCoverage: CurriculumSourceReference[];
}): CurriculumGenerationRun {
  const completedAt = new Date().toISOString();

  return {
    id,
    curriculumId,
    status,
    message,
    dryRun,
    usedOpenAI: false,
    sourceDocumentCount,
    sourcePageCount,
    sourceChunkCount,
    generatedSectionCount,
    generatedWeekCount,
    generatedLessonCount,
    filtering,
    sourceCoverage,
    startedAt: startedAt.toISOString(),
    completedAt
  };
}

function buildStatusMessage(
  mode: GeneratedCurriculumStatusSummary["curriculumMode"],
  sourceChunkCount: number,
  lastRunMessage?: string
) {
  if (mode === "pdf_derived") {
    return "A PDF-derived curriculum is active. Full lesson content is still generated on demand from cited chunks.";
  }

  if (mode === "mixed_fallback") {
    return lastRunMessage ?? "PDF chunks exist, but no generated curriculum is active yet. The seed roadmap remains available until you build from PDFs.";
  }

  return sourceChunkCount === 0
    ? "No PDFs have been imported yet. The fixed 8-week seed roadmap remains the safe fallback."
    : "The fixed 8-week seed roadmap is active.";
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

function normalizeStatus(value: string): CurriculumGenerationStatus {
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

function buildSectionTitle(fileName: string, index: number) {
  return `Source ${index}: ${fileName}`;
}

function formatPageRange(startPage: number, endPage: number) {
  return startPage === endPage ? `page ${startPage}` : `pages ${startPage}-${endPage}`;
}

function truncateText(value: string, maxLength: number) {
  const trimmed = value.replace(/\s+/g, " ").trim();

  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function normalizeCurriculumText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value);
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "generated-curriculum";
}
