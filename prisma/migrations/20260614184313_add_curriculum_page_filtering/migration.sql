-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GeneratedCurriculum" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "sourceDocumentCount" INTEGER NOT NULL DEFAULT 0,
    "sourcePageCount" INTEGER NOT NULL DEFAULT 0,
    "sourceChunkCount" INTEGER NOT NULL DEFAULT 0,
    "sectionCount" INTEGER NOT NULL DEFAULT 0,
    "weekCount" INTEGER NOT NULL DEFAULT 0,
    "lessonCount" INTEGER NOT NULL DEFAULT 0,
    "filteringEnabled" BOOLEAN NOT NULL DEFAULT false,
    "filteringVersion" TEXT NOT NULL DEFAULT 'none',
    "generationMode" TEXT NOT NULL DEFAULT 'unfiltered',
    "instructionalPageCount" INTEGER NOT NULL DEFAULT 0,
    "excludedPageCount" INTEGER NOT NULL DEFAULT 0,
    "classificationSummaryJson" TEXT NOT NULL DEFAULT '{}',
    "filteringSamplesJson" TEXT NOT NULL DEFAULT '{}',
    "sourceCoverageJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_GeneratedCurriculum" ("createdAt", "generatedAt", "id", "lessonCount", "sectionCount", "sourceChunkCount", "sourceCoverageJson", "sourceDocumentCount", "sourcePageCount", "status", "title", "updatedAt", "weekCount") SELECT "createdAt", "generatedAt", "id", "lessonCount", "sectionCount", "sourceChunkCount", "sourceCoverageJson", "sourceDocumentCount", "sourcePageCount", "status", "title", "updatedAt", "weekCount" FROM "GeneratedCurriculum";
DROP TABLE "GeneratedCurriculum";
ALTER TABLE "new_GeneratedCurriculum" RENAME TO "GeneratedCurriculum";
CREATE INDEX "GeneratedCurriculum_status_idx" ON "GeneratedCurriculum"("status");
CREATE INDEX "GeneratedCurriculum_generatedAt_idx" ON "GeneratedCurriculum"("generatedAt");
CREATE TABLE "new_GeneratedCurriculumRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "curriculumId" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "usedOpenAI" BOOLEAN NOT NULL DEFAULT false,
    "sourceDocumentCount" INTEGER NOT NULL DEFAULT 0,
    "sourcePageCount" INTEGER NOT NULL DEFAULT 0,
    "sourceChunkCount" INTEGER NOT NULL DEFAULT 0,
    "generatedSectionCount" INTEGER NOT NULL DEFAULT 0,
    "generatedWeekCount" INTEGER NOT NULL DEFAULT 0,
    "generatedLessonCount" INTEGER NOT NULL DEFAULT 0,
    "filteringEnabled" BOOLEAN NOT NULL DEFAULT false,
    "filteringVersion" TEXT NOT NULL DEFAULT 'none',
    "generationMode" TEXT NOT NULL DEFAULT 'unfiltered',
    "instructionalPageCount" INTEGER NOT NULL DEFAULT 0,
    "excludedPageCount" INTEGER NOT NULL DEFAULT 0,
    "classificationSummaryJson" TEXT NOT NULL DEFAULT '{}',
    "filteringSamplesJson" TEXT NOT NULL DEFAULT '{}',
    "sourceCoverageJson" TEXT NOT NULL DEFAULT '[]',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "GeneratedCurriculumRun_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "GeneratedCurriculum" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GeneratedCurriculumRun" ("completedAt", "curriculumId", "dryRun", "generatedLessonCount", "generatedSectionCount", "generatedWeekCount", "id", "message", "sourceChunkCount", "sourceCoverageJson", "sourceDocumentCount", "sourcePageCount", "startedAt", "status", "usedOpenAI") SELECT "completedAt", "curriculumId", "dryRun", "generatedLessonCount", "generatedSectionCount", "generatedWeekCount", "id", "message", "sourceChunkCount", "sourceCoverageJson", "sourceDocumentCount", "sourcePageCount", "startedAt", "status", "usedOpenAI" FROM "GeneratedCurriculumRun";
DROP TABLE "GeneratedCurriculumRun";
ALTER TABLE "new_GeneratedCurriculumRun" RENAME TO "GeneratedCurriculumRun";
CREATE INDEX "GeneratedCurriculumRun_curriculumId_idx" ON "GeneratedCurriculumRun"("curriculumId");
CREATE INDEX "GeneratedCurriculumRun_status_idx" ON "GeneratedCurriculumRun"("status");
CREATE INDEX "GeneratedCurriculumRun_startedAt_idx" ON "GeneratedCurriculumRun"("startedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
