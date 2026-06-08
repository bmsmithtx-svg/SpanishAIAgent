"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CurriculumSection } from "@/types";
import { getProgressSummary } from "@/lib/curriculum/progress";
import { useCurriculumProgress } from "@/lib/curriculum/use-curriculum-progress";

type CurriculumStatusPanelProps = {
  sections: CurriculumSection[];
  compact?: boolean;
};

export function CurriculumStatusPanel({ sections, compact = false }: CurriculumStatusPanelProps) {
  const progress = useCurriculumProgress();
  const summary = useMemo(() => getProgressSummary(sections, progress), [sections, progress]);
  const currentLesson = summary.currentLesson;
  const currentWeek = summary.currentWeek;

  return (
    <article className={compact ? "status-panel curriculum-mini-panel" : "placeholder-panel"}>
      <span className="badge green">Daily curriculum</span>
      <h2>{currentWeek ? `Week ${currentWeek.weekNumber}: ${currentWeek.grammarTheme}` : "Roadmap ready"}</h2>
      <p>
        Grammar-first progress is stored locally in this browser. Lessons remain placeholder-only
        until uploaded PDF pages can support the teaching content and citations.
      </p>
      <div className="status-metric-grid">
        <div className="status-metric">
          <span className="status-label">Current lesson</span>
          <span className="status-value">
            {currentLesson ? `Day ${currentLesson.dayNumber}` : "Complete"}
          </span>
        </div>
        <div className="status-metric">
          <span className="status-label">Daily lessons</span>
          <span className="status-value">
            {summary.completedLessons}/{summary.totalLessons}
          </span>
        </div>
        <div className="status-metric">
          <span className="status-label">Assessments passed</span>
          <span className="status-value">
            {summary.passedAssessments}/{summary.totalAssessments}
          </span>
        </div>
      </div>
      <div className="action-row">
        <Link className="primary-button" href={currentLesson ? `/learn/day/${currentLesson.dayNumber}` : "/learn"}>
          Continue study
        </Link>
        <Link className="secondary-button" href="/learn">
          View roadmap
        </Link>
      </div>
    </article>
  );
}
