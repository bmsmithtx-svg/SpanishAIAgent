export type SpanishCitation = {
  sourceFileName: string;
  pageNumber: number;
  sectionOrChapter?: string;
  snippet?: string;
};

export type SpanishSourcePage = {
  id: string;
  documentId: string;
  pageNumber: number;
  text: string;
  sectionOrChapter?: string;
  citations: SpanishCitation[];
};

export type SpanishSourceDocument = {
  id: string;
  fileName: string;
  title?: string;
  pageCount: number;
  uploadedAt: string;
  status: "uploaded" | "parsing" | "indexed" | "failed";
  pages: SpanishSourcePage[];
};

export type SpanishLesson = {
  id: string;
  title: string;
  objective: string;
  summaryPlaceholder: string;
  sourceCitations: SpanishCitation[];
  status: "placeholder" | "draft" | "ready";
};

export type SpanishPracticeItem = {
  id: string;
  lessonId?: string;
  prompt: string;
  expectedAnswer?: string;
  feedbackPlaceholder?: string;
  sourceCitations: SpanishCitation[];
  status: "placeholder" | "ready";
};

export type SpanishAgentResponse = {
  answer: string;
  citations: SpanishCitation[];
  unsupportedBySources: boolean;
  followUpSuggestions?: string[];
};

export type LessonBlockKind = "vocabulary" | "grammar" | "sentence-practice" | "challenge";

export type LessonStatus = "locked" | "available" | "in_progress" | "complete";

export type LessonBlock = {
  kind: LessonBlockKind;
  label: string;
  minutes: number;
  placeholder: string;
};

export type LessonSourceReference = {
  fileName: string;
  pageNumber: number;
  documentId?: string;
  pageId?: string;
  chunkId?: string;
  citationLabel?: string;
  preview?: string;
};

export type DailyLesson = {
  id: string;
  sectionId: string;
  weekNumber: number;
  dayNumber: number;
  dayInWeek: number;
  title: string;
  grammarFocus: string;
  vocabularyFocus: string;
  familyCommunicationGoal: string;
  buildsOn: string[];
  masteryGoals: string[];
  estimatedMinutes: 20;
  blocks: LessonBlock[];
  sourceReferences: LessonSourceReference[];
};

export type WeeklyReviewDay = {
  id: string;
  sectionId: string;
  weekNumber: number;
  title: string;
  goals: string[];
  placeholder: string;
};

export type WeeklyAssessment = {
  id: string;
  sectionId: string;
  weekNumber: number;
  title: string;
  masteryRequirements: string[];
  passingThreshold: number;
  sourceReferences: LessonSourceReference[];
};

export type CurriculumWeek = {
  id: string;
  sectionId: string;
  weekNumber: number;
  title: string;
  grammarTheme: string;
  communicationGoal: string;
  lessons: DailyLesson[];
  reviewDay: WeeklyReviewDay;
  assessment: WeeklyAssessment;
};

export type CurriculumSection = {
  id: string;
  title: string;
  description: string;
  weeks: CurriculumWeek[];
};

export type AssessmentMessage = {
  id: string;
  role: "system" | "learner" | "assessor";
  content: string;
  createdAt: string;
};

export type AssessmentAttempt = {
  id: string;
  weekNumber: number;
  startedAt: string;
  completedAt?: string;
  score?: number;
  passed: boolean;
  messages: AssessmentMessage[];
  strengths: string[];
  needsReview: string[];
};

export type CurriculumProgress = {
  completedLessonDayNumbers: number[];
  completedReviewWeekNumbers: number[];
  assessmentAttempts: AssessmentAttempt[];
  updatedAt: string;
};

export type SpanishAgentAssessmentResponse = {
  answer: string;
  weekNumber: number;
  sourceReferences: LessonSourceReference[];
  unsupportedBySources: boolean;
  progressionUnlockAllowed: boolean;
};
