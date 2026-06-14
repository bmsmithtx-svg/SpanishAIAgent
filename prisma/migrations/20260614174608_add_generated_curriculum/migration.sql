-- CreateTable
CREATE TABLE "GeneratedCurriculum" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "sourceDocumentCount" INTEGER NOT NULL DEFAULT 0,
    "sourcePageCount" INTEGER NOT NULL DEFAULT 0,
    "sourceChunkCount" INTEGER NOT NULL DEFAULT 0,
    "sectionCount" INTEGER NOT NULL DEFAULT 0,
    "weekCount" INTEGER NOT NULL DEFAULT 0,
    "lessonCount" INTEGER NOT NULL DEFAULT 0,
    "sourceCoverageJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GeneratedCurriculumSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "curriculumId" TEXT NOT NULL,
    "sectionIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sourceDocumentIdsJson" TEXT NOT NULL DEFAULT '[]',
    "sourcePageStart" INTEGER,
    "sourcePageEnd" INTEGER,
    "weekStart" INTEGER NOT NULL DEFAULT 1,
    "weekEnd" INTEGER NOT NULL DEFAULT 1,
    "lessonCount" INTEGER NOT NULL DEFAULT 0,
    "sourceReferencesJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GeneratedCurriculumSection_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "GeneratedCurriculum" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratedCurriculumLesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "curriculumId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "dayInWeek" INTEGER NOT NULL,
    "sectionTitle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "grammarFocus" TEXT NOT NULL,
    "vocabularyFocus" TEXT NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 20,
    "sourceDocumentIdsJson" TEXT NOT NULL DEFAULT '[]',
    "sourcePageStart" INTEGER,
    "sourcePageEnd" INTEGER,
    "sourceReferencesJson" TEXT NOT NULL DEFAULT '[]',
    "retrievalQuery" TEXT NOT NULL,
    "buildsOnLessonIdsJson" TEXT NOT NULL DEFAULT '[]',
    "masteryGoalsJson" TEXT NOT NULL DEFAULT '[]',
    "contentGenerated" BOOLEAN NOT NULL DEFAULT false,
    "generatedContentId" TEXT,
    "generatedContentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GeneratedCurriculumLesson_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "GeneratedCurriculum" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GeneratedCurriculumLesson_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "GeneratedCurriculumSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeneratedCurriculumRun" (
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
    "sourceCoverageJson" TEXT NOT NULL DEFAULT '[]',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "GeneratedCurriculumRun_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "GeneratedCurriculum" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GeneratedCurriculum_status_idx" ON "GeneratedCurriculum"("status");

-- CreateIndex
CREATE INDEX "GeneratedCurriculum_generatedAt_idx" ON "GeneratedCurriculum"("generatedAt");

-- CreateIndex
CREATE INDEX "GeneratedCurriculumSection_curriculumId_idx" ON "GeneratedCurriculumSection"("curriculumId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedCurriculumSection_curriculumId_sectionIndex_key" ON "GeneratedCurriculumSection"("curriculumId", "sectionIndex");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedCurriculumLesson_lessonId_key" ON "GeneratedCurriculumLesson"("lessonId");

-- CreateIndex
CREATE INDEX "GeneratedCurriculumLesson_curriculumId_idx" ON "GeneratedCurriculumLesson"("curriculumId");

-- CreateIndex
CREATE INDEX "GeneratedCurriculumLesson_sectionId_idx" ON "GeneratedCurriculumLesson"("sectionId");

-- CreateIndex
CREATE INDEX "GeneratedCurriculumLesson_weekNumber_idx" ON "GeneratedCurriculumLesson"("weekNumber");

-- CreateIndex
CREATE INDEX "GeneratedCurriculumLesson_dayNumber_idx" ON "GeneratedCurriculumLesson"("dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedCurriculumLesson_curriculumId_dayNumber_key" ON "GeneratedCurriculumLesson"("curriculumId", "dayNumber");

-- CreateIndex
CREATE INDEX "GeneratedCurriculumRun_curriculumId_idx" ON "GeneratedCurriculumRun"("curriculumId");

-- CreateIndex
CREATE INDEX "GeneratedCurriculumRun_status_idx" ON "GeneratedCurriculumRun"("status");

-- CreateIndex
CREATE INDEX "GeneratedCurriculumRun_startedAt_idx" ON "GeneratedCurriculumRun"("startedAt");
