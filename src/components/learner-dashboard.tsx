"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CurriculumProgress, CurriculumWeek, DailyLesson } from "@/types";
import {
  getAssessmentStatus,
  getLessonStatus,
  hasPassedAssessment,
  isLessonComplete,
  isReviewComplete
} from "@/lib/curriculum/progress";
import { useCurriculumProgress } from "@/lib/curriculum/use-curriculum-progress";

type LearnerDashboardProps = {
  totalWeeks: number;
  usesGeneratedCurriculum: boolean;
  weeks: DashboardWeek[];
};

export type DashboardLesson = Pick<DailyLesson, "id" | "dayNumber" | "dayInWeek" | "weekNumber">;

export type DashboardWeek = {
  weekNumber: number;
  lessons: DashboardLesson[];
};

type DashboardAction =
  | {
      kind: "lesson";
      href: string;
      label: "Continue Next Lesson";
    }
  | {
      kind: "assessment";
      href: string;
      label: "Start Weekly Assessment";
    }
  | {
      kind: "none";
      href: "/learn";
      label: "View full roadmap";
      message: string;
    };

export function LearnerDashboard({
  totalWeeks,
  usesGeneratedCurriculum,
  weeks
}: LearnerDashboardProps) {
  const progress = useCurriculumProgress();
  const dashboard = useMemo(
    () => buildDashboardState(weeks, progress, usesGeneratedCurriculum, totalWeeks),
    [progress, totalWeeks, usesGeneratedCurriculum, weeks]
  );

  return (
    <section className="learner-dashboard" aria-label="Learning progress">
      <div className="learner-meter-block">
        <span className="learner-meter-value">
          {dashboard.completedDays}/{dashboard.totalDays} days completed
        </span>
        <ProgressBar value={dashboard.completedDays} max={dashboard.totalDays} />
      </div>

      <div className="learner-meter-block">
        <span className="learner-meter-value">
          Week {dashboard.currentWeekNumber} out of {dashboard.totalWeeks}
        </span>
        <ProgressBar value={dashboard.currentWeekNumber} max={dashboard.totalWeeks} />
      </div>

      <div className="learner-dashboard-actions">
        {dashboard.action.kind === "none" ? (
          <p className="learner-dashboard-message">{dashboard.action.message}</p>
        ) : null}
        <Link
          className={dashboard.action.kind === "none" ? "secondary-button" : "primary-button"}
          href={dashboard.action.href}
        >
          {dashboard.action.label}
        </Link>
        {dashboard.action.kind !== "none" ? (
          <Link className="learner-roadmap-link" href="/learn">
            View full roadmap
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div
      aria-label={`${value} of ${max}`}
      aria-valuemax={max}
      aria-valuemin={0}
      aria-valuenow={Math.min(value, max)}
      className="learner-progress-track"
      role="progressbar"
    >
      <span className="learner-progress-fill" style={{ width: `${percentage}%` }} />
    </div>
  );
}

function buildDashboardState(
  weeks: DashboardWeek[],
  progress: CurriculumProgress,
  usesGeneratedCurriculum: boolean,
  totalWeekCount: number
) {
  const currentWeek = getCurrentWeek(weeks, progress);
  const totalWeeks = Math.max(totalWeekCount, weeks.length, 1);
  const currentWeekNumber = currentWeek?.weekNumber ?? totalWeeks;
  const totalDays = currentWeek ? currentWeek.lessons.length + 2 : 0;
  const completedDays = currentWeek ? getCompletedDaysInWeek(currentWeek, progress) : 0;

  return {
    completedDays,
    totalDays,
    currentWeekNumber,
    totalWeeks: totalWeeks || 1,
    action: getDashboardAction(weeks, progress, usesGeneratedCurriculum)
  };
}

function getCurrentWeek(
  weeks: DashboardWeek[],
  progress: CurriculumProgress
) {
  if (weeks.length === 0) {
    return null;
  }

  return weeks.find((week) => !hasPassedAssessment(progress, week.weekNumber)) ?? weeks[weeks.length - 1];
}

function getCompletedDaysInWeek(
  week: DashboardWeek,
  progress: CurriculumProgress
) {
  const completedLessons = week.lessons.filter((lesson) =>
    isLessonComplete(progress, lesson.dayNumber)
  ).length;
  const reviewCompleted = isReviewComplete(progress, week.weekNumber) ? 1 : 0;
  const assessmentCompleted = hasPassedAssessment(progress, week.weekNumber) ? 1 : 0;

  return completedLessons + reviewCompleted + assessmentCompleted;
}

function getDashboardAction(
  weeks: DashboardWeek[],
  progress: CurriculumProgress,
  usesGeneratedCurriculum: boolean
): DashboardAction {
  const nextLesson = getNextAvailableLesson(weeks, progress);

  if (nextLesson) {
    return {
      kind: "lesson",
      href: usesGeneratedCurriculum
        ? `/learn/lesson/${encodeURIComponent(nextLesson.id)}`
        : `/learn/day/${nextLesson.dayNumber}`,
      label: "Continue Next Lesson"
    };
  }

  const assessmentWeek = weeks.find((week) => {
    const status = getAssessmentStatus(toProgressWeek(week), progress);

    return status === "available" || status === "in_progress";
  });

  if (assessmentWeek) {
    return {
      kind: "assessment",
      href: `/learn/week/${assessmentWeek.weekNumber}/assessment`,
      label: "Start Weekly Assessment"
    };
  }

  return {
    kind: "none",
    href: "/learn",
    label: "View full roadmap",
    message: weeks.length > 0
      ? "Open the roadmap to continue."
      : "No lessons are available yet."
  };
}

function getNextAvailableLesson(
  weeks: DashboardWeek[],
  progress: CurriculumProgress
): DailyLesson | null {
  const lessons = weeks
    .flatMap((week) => week.lessons)
    .sort((a, b) => a.dayNumber - b.dayNumber);
  const lesson = lessons.find((candidate) =>
    getLessonStatus(candidate as DailyLesson, progress) === "available"
  );

  return lesson ? (lesson as DailyLesson) : null;
}

function toProgressWeek(week: DashboardWeek): CurriculumWeek {
  return {
    id: `dashboard-week-${week.weekNumber}`,
    sectionId: "dashboard",
    weekNumber: week.weekNumber,
    title: "",
    grammarTheme: "",
    communicationGoal: "",
    lessons: week.lessons as DailyLesson[],
    reviewDay: {
      id: `dashboard-week-${week.weekNumber}-review`,
      sectionId: "dashboard",
      weekNumber: week.weekNumber,
      title: "",
      goals: [],
      placeholder: ""
    },
    assessment: {
      id: `dashboard-week-${week.weekNumber}-assessment`,
      sectionId: "dashboard",
      weekNumber: week.weekNumber,
      title: "",
      masteryRequirements: [],
      passingThreshold: 80,
      sourceReferences: []
    }
  };
}
