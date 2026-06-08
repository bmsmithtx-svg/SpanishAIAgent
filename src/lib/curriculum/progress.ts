import type {
  AssessmentAttempt,
  CurriculumProgress,
  CurriculumSection,
  CurriculumWeek,
  DailyLesson,
  LessonStatus
} from "@/types";

export const CURRICULUM_PROGRESS_STORAGE_KEY = "spanish-ai-agent:curriculum-progress:v1";
export const CURRICULUM_PROGRESS_CHANGED_EVENT = "spanish-ai-agent:curriculum-progress-changed";

export type ProgressSummary = {
  completedLessons: number;
  totalLessons: number;
  passedAssessments: number;
  totalAssessments: number;
  completedReviews: number;
  totalReviews: number;
  currentLesson: DailyLesson | null;
  currentWeek: CurriculumWeek | null;
};

export function createInitialCurriculumProgress(): CurriculumProgress {
  return {
    completedLessonDayNumbers: [],
    completedReviewWeekNumbers: [],
    assessmentAttempts: [],
    updatedAt: ""
  };
}

export function loadCurriculumProgress(): CurriculumProgress {
  if (typeof window === "undefined") {
    return createInitialCurriculumProgress();
  }

  const stored = window.localStorage.getItem(CURRICULUM_PROGRESS_STORAGE_KEY);

  if (!stored) {
    return createInitialCurriculumProgress();
  }

  try {
    return normalizeProgress(JSON.parse(stored));
  } catch {
    return createInitialCurriculumProgress();
  }
}

export function saveCurriculumProgress(progress: CurriculumProgress) {
  const normalized = normalizeProgress({
    ...progress,
    updatedAt: new Date().toISOString()
  });

  if (typeof window !== "undefined") {
    window.localStorage.setItem(CURRICULUM_PROGRESS_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event(CURRICULUM_PROGRESS_CHANGED_EVENT));
  }

  return normalized;
}

export function clearCurriculumProgress() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(CURRICULUM_PROGRESS_STORAGE_KEY);
    window.dispatchEvent(new Event(CURRICULUM_PROGRESS_CHANGED_EVENT));
  }

  return createInitialCurriculumProgress();
}

export function markLessonComplete(progress: CurriculumProgress, dayNumber: number) {
  return saveCurriculumProgress({
    ...progress,
    completedLessonDayNumbers: addUniqueNumber(progress.completedLessonDayNumbers, dayNumber)
  });
}

export function markReviewComplete(progress: CurriculumProgress, weekNumber: number) {
  return saveCurriculumProgress({
    ...progress,
    completedReviewWeekNumbers: addUniqueNumber(progress.completedReviewWeekNumbers, weekNumber)
  });
}

export function recordAssessmentAttempt(
  progress: CurriculumProgress,
  attempt: AssessmentAttempt
) {
  const attempts = [
    ...progress.assessmentAttempts.filter((storedAttempt) => storedAttempt.id !== attempt.id),
    attempt
  ];

  return saveCurriculumProgress({
    ...progress,
    assessmentAttempts: attempts
  });
}

export function getLessonStatus(lesson: DailyLesson, progress: CurriculumProgress): LessonStatus {
  if (isLessonComplete(progress, lesson.dayNumber)) {
    return "complete";
  }

  if (!isWeekUnlocked(lesson.weekNumber, progress)) {
    return "locked";
  }

  if (lesson.dayInWeek === 1) {
    return "available";
  }

  return isLessonComplete(progress, lesson.dayNumber - 1) ? "available" : "locked";
}

export function getReviewStatus(week: CurriculumWeek, progress: CurriculumProgress): LessonStatus {
  if (isReviewComplete(progress, week.weekNumber)) {
    return "complete";
  }

  if (!isWeekUnlocked(week.weekNumber, progress)) {
    return "locked";
  }

  return areWeekLessonsComplete(week, progress) ? "available" : "locked";
}

export function getAssessmentStatus(week: CurriculumWeek, progress: CurriculumProgress): LessonStatus {
  if (hasPassedAssessment(progress, week.weekNumber)) {
    return "complete";
  }

  if (!isReviewComplete(progress, week.weekNumber)) {
    return "locked";
  }

  return getLatestAssessmentAttempt(progress, week.weekNumber) ? "in_progress" : "available";
}

export function isLessonComplete(progress: CurriculumProgress, dayNumber: number) {
  return progress.completedLessonDayNumbers.includes(dayNumber);
}

export function isReviewComplete(progress: CurriculumProgress, weekNumber: number) {
  return progress.completedReviewWeekNumbers.includes(weekNumber);
}

export function hasPassedAssessment(progress: CurriculumProgress, weekNumber: number) {
  return progress.assessmentAttempts.some(
    (attempt) => attempt.weekNumber === weekNumber && attempt.passed
  );
}

export function isWeekUnlocked(weekNumber: number, progress: CurriculumProgress) {
  return weekNumber === 1 || hasPassedAssessment(progress, weekNumber - 1);
}

export function areWeekLessonsComplete(week: CurriculumWeek, progress: CurriculumProgress) {
  return week.lessons.every((lesson) => isLessonComplete(progress, lesson.dayNumber));
}

export function getLatestAssessmentAttempt(progress: CurriculumProgress, weekNumber: number) {
  return [...progress.assessmentAttempts]
    .filter((attempt) => attempt.weekNumber === weekNumber)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;
}

export function getProgressSummary(
  sections: CurriculumSection[],
  progress: CurriculumProgress
): ProgressSummary {
  const weeks = sections.flatMap((section) => section.weeks);
  const lessons = weeks.flatMap((week) => week.lessons);
  const currentLesson = getCurrentLesson(sections, progress);
  const currentWeek = currentLesson
    ? weeks.find((week) => week.weekNumber === currentLesson.weekNumber) ?? null
    : weeks.find((week) => !hasPassedAssessment(progress, week.weekNumber)) ?? null;

  return {
    completedLessons: lessons.filter((lesson) => isLessonComplete(progress, lesson.dayNumber)).length,
    totalLessons: lessons.length,
    passedAssessments: weeks.filter((week) => hasPassedAssessment(progress, week.weekNumber)).length,
    totalAssessments: weeks.length,
    completedReviews: weeks.filter((week) => isReviewComplete(progress, week.weekNumber)).length,
    totalReviews: weeks.length,
    currentLesson,
    currentWeek
  };
}

export function getCurrentLesson(sections: CurriculumSection[], progress: CurriculumProgress) {
  const lessons = sections.flatMap((section) => section.weeks.flatMap((week) => week.lessons));

  return (
    lessons.find((lesson) => getLessonStatus(lesson, progress) === "available") ??
    lessons.find((lesson) => getLessonStatus(lesson, progress) === "in_progress") ??
    lessons[lessons.length - 1] ??
    null
  );
}

export function getLockedReason(lesson: DailyLesson, progress: CurriculumProgress) {
  if (!isWeekUnlocked(lesson.weekNumber, progress)) {
    return `Pass week ${lesson.weekNumber - 1} assessment before starting this week.`;
  }

  if (lesson.dayInWeek > 1 && !isLessonComplete(progress, lesson.dayNumber - 1)) {
    return `Complete day ${lesson.dayNumber - 1} first.`;
  }

  return "This lesson is available.";
}

export function getAssessmentLockedReason(week: CurriculumWeek, progress: CurriculumProgress) {
  if (!isWeekUnlocked(week.weekNumber, progress)) {
    return `Pass week ${week.weekNumber - 1} assessment before opening week ${week.weekNumber}.`;
  }

  if (!areWeekLessonsComplete(week, progress)) {
    return "Complete all five daily lessons for this week first.";
  }

  if (!isReviewComplete(progress, week.weekNumber)) {
    return "Complete the weekly review before starting the assessment.";
  }

  return "Assessment is available.";
}

function normalizeProgress(value: unknown): CurriculumProgress {
  if (!value || typeof value !== "object") {
    return createInitialCurriculumProgress();
  }

  const candidate = value as Partial<CurriculumProgress>;

  return {
    completedLessonDayNumbers: normalizeNumberList(candidate.completedLessonDayNumbers),
    completedReviewWeekNumbers: normalizeNumberList(candidate.completedReviewWeekNumbers),
    assessmentAttempts: Array.isArray(candidate.assessmentAttempts)
      ? candidate.assessmentAttempts.filter(isAssessmentAttempt)
      : [],
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString()
  };
}

function normalizeNumberList(value: unknown) {
  return Array.from(
    new Set(
      Array.isArray(value)
        ? value.filter((item): item is number => Number.isInteger(item) && item > 0)
        : []
    )
  ).sort((a, b) => a - b);
}

function addUniqueNumber(values: number[], value: number) {
  return Array.from(new Set([...values, value])).sort((a, b) => a - b);
}

function isAssessmentAttempt(value: unknown): value is AssessmentAttempt {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AssessmentAttempt>;

  return (
    typeof candidate.id === "string" &&
    Number.isInteger(candidate.weekNumber) &&
    typeof candidate.startedAt === "string" &&
    typeof candidate.passed === "boolean" &&
    Array.isArray(candidate.messages) &&
    Array.isArray(candidate.strengths) &&
    Array.isArray(candidate.needsReview)
  );
}
