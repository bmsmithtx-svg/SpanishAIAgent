import { withDatabaseQueryTimeout } from "@/lib/db/query-timeout";
import { getSourceLibraryStats } from "@/lib/sources/source-service";
import {
  CURRICULUM_PAGE_FILTER_VERSION,
  INSTRUCTIONAL_PAGE_SCORE_THRESHOLD,
  buildEmptyClassificationSummary
} from "./page-classifier";
import {
  filteringFromRecord,
  getActiveGeneratedCurriculum,
  normalizeStatus,
  parseJson,
  type FilteringRecordFields
} from "./generated-curriculum-read";
import type {
  CurriculumGenerationRun,
  CurriculumFilteringMetadata,
  CurriculumSourceReference,
  GeneratedCurriculumStatusSummary
} from "@/types";

type RunRecord = FilteringRecordFields & {
  id: string;
  curriculumId: string | null;
  status: string;
  message: string;
  dryRun: boolean;
  usedOpenAI: boolean;
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

async function getLatestCurriculumGenerationRun() {
  return withDatabaseQueryTimeout(async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const run = await prisma.generatedCurriculumRun.findFirst({
      orderBy: {
        startedAt: "desc"
      }
    });

    return run ? serializeRun(run as RunRecord) : null;
  }, null);
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

function buildDefaultFilteringMetadata(): CurriculumFilteringMetadata {
  return {
    enabled: false,
    version: CURRICULUM_PAGE_FILTER_VERSION,
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
