import { prisma } from "@/lib/db/prisma";
import { buildSourceSnippet, formatCitation, getSourceLibraryStats } from "@/lib/sources";
import type {
  CurriculumGenerationRun,
  CurriculumGenerationStatus,
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
const PAGES_PER_LESSON = 2;
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
  sourceCoverageJson: string;
  startedAt: Date;
  completedAt: Date | null;
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
      lastGeneratedAt: curriculum?.generatedAt,
      lastRun: lastRun ?? undefined,
      message: buildStatusMessage(curriculumMode, stats.sourceChunkCount, lastRun?.message)
    };
  } catch {
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

export async function generatePdfDerivedCurriculum(
  options: CurriculumGenerationOptions = {}
): Promise<CurriculumGenerationResult> {
  const dryRun = Boolean(options.dryRun);
  const startedAt = new Date();
  const documents = await getDocumentsForCurriculum();
  const availableDocuments = documents.filter((document) =>
    document.pages.some((page) => page.chunks.length > 0)
  );
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
      generatedLessonCount: 0
    });
  }

  const draft = buildCurriculumDraft(availableDocuments);
  const message = dryRun
    ? `Dry run only: ${draft.lessonCount} lesson shells would be generated from ${sourceDocumentCount} imported PDF document(s). No database writes or OpenAI calls were made.`
    : `Generated ${draft.lessonCount} lesson shells from imported PDF pages. Full lesson content remains on-demand and source-cited.`;
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
      generatedLessonCount: draft.lessonCount
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
    generatedLessonCount: curriculum.lessonCount
  });
}

function buildCurriculumDraft(documents: SourceDocumentForCurriculum[]): GeneratedCurriculum {
  const generatedAt = new Date().toISOString();
  const lessons: GeneratedCurriculumLessonShell[] = [];
  const sections: GeneratedCurriculumSection[] = [];
  const sourceCoverage: CurriculumSourceReference[] = [];
  let previousLessonId: string | null = null;

  documents.forEach((document, documentIndex) => {
    const pages = document.pages.filter((page) => page.chunks.length > 0);
    const sectionLessons: GeneratedCurriculumLessonShell[] = [];
    const sectionTitle = buildSectionTitle(document.originalFileName, documentIndex + 1);
    const sectionStartPage = pages[0]?.pageNumber;
    const sectionEndPage = pages[pages.length - 1]?.pageNumber;

    if (pages[0]) {
      const firstReference = buildReference(document, pages[0]);

      if (firstReference) {
        sourceCoverage.push(firstReference);
      }
    }

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += PAGES_PER_LESSON) {
      const pageWindow = pages.slice(pageIndex, pageIndex + PAGES_PER_LESSON);
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
        title: `Source-supported lesson from ${pageRange}`,
        grammarFocus: `PDF-supported grammar focus from ${document.originalFileName}, ${pageRange}`,
        vocabularyFocus: `Everyday vocabulary supported by ${document.originalFileName}, ${pageRange}`,
        estimatedMinutes: 20,
        sourceDocumentIds: [document.id],
        sourcePageStart: firstPage.pageNumber,
        sourcePageEnd: lastPage.pageNumber,
        sourceReferences,
        retrievalQuery: [document.originalFileName, pageRange, sectionTitle, `week ${weekNumber}`, `day ${dayNumber}`]
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
        "Generated from imported PDF page ranges. Lesson shells point to citations; full lesson content is generated later on demand.",
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
    sourcePageCount: documents.reduce((total, document) => total + document.pages.length, 0),
    sourceChunkCount: documents.reduce((total, document) => total + document._count.chunks, 0),
    sectionCount,
    weekCount,
    lessonCount: lessons.length,
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
  generatedLessonCount
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
    generatedLessonCount
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
