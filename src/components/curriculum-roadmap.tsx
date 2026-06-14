"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  CurriculumGenerationStatus,
  CurriculumSection,
  GeneratedCurriculum,
  GeneratedCurriculumStatusSummary,
  LessonStatus
} from "@/types";
import {
  getAssessmentLockedReason,
  getAssessmentStatus,
  getLessonStatus,
  getProgressSummary,
  getReviewStatus,
  markReviewComplete
} from "@/lib/curriculum/progress";
import { useCurriculumProgress } from "@/lib/curriculum/use-curriculum-progress";

type CurriculumRoadmapProps = {
  sections: CurriculumSection[];
  generatedCurriculum: GeneratedCurriculum | null;
  statusSummary: GeneratedCurriculumStatusSummary;
};

type GenerationApiResponse = {
  status?: CurriculumGenerationStatus;
  message?: string;
  dryRun?: boolean;
  generatedLessonCount?: number;
  generatedWeekCount?: number;
  warning?: string;
  error?: string;
};

export function CurriculumRoadmap({
  sections,
  generatedCurriculum,
  statusSummary
}: CurriculumRoadmapProps) {
  const progress = useCurriculumProgress();
  const [generationMessage, setGenerationMessage] = useState(statusSummary.message);
  const [isGenerating, setIsGenerating] = useState(false);
  const summary = useMemo(() => getProgressSummary(sections, progress), [sections, progress]);
  const isPdfDerived = statusSummary.curriculumMode === "pdf_derived";

  function completeReview(weekNumber: number) {
    markReviewComplete(progress, weekNumber);
  }

  async function runGenerator(dryRun: boolean) {
    if (isGenerating) {
      return;
    }

    setIsGenerating(true);
    setGenerationMessage("");

    try {
      const response = await fetch("/api/curriculum/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ dryRun })
      });
      const payload = (await response.json()) as GenerationApiResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Curriculum generation failed.");
      }

      setGenerationMessage(
        payload.message ??
          (dryRun ? "Dry run completed without writes." : "Generated curriculum shell build completed.")
      );

      if (!dryRun && payload.status === "pdf_derived") {
        window.location.reload();
      }
    } catch (error) {
      setGenerationMessage(error instanceof Error ? error.message : "Curriculum generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="curriculum-workspace">
      <section className="curriculum-control-panel" aria-label="Curriculum generation status">
        <div>
          <span className={`badge ${isPdfDerived ? "green" : "gold"}`}>{modeLabel(statusSummary.curriculumMode)}</span>
          <h2>{isPdfDerived ? "PDF-derived roadmap active" : "Seed fallback roadmap active"}</h2>
          <p>{generationMessage}</p>
        </div>
        <div className="curriculum-control-actions">
          <button
            className="secondary-button"
            disabled={isGenerating}
            onClick={() => runGenerator(true)}
            type="button"
          >
            Dry run shell plan
          </button>
          <button
            className="primary-button"
            disabled={isGenerating || !statusSummary.sourcePdfsAvailable}
            onClick={() => runGenerator(false)}
            type="button"
          >
            {generatedCurriculum ? "Rebuild PDF shells" : "Build from PDFs"}
          </button>
        </div>
        <div className="curriculum-control-note">
          <span>Shell builder only</span>
          <strong>No OpenAI call and no full lesson generation.</strong>
          <span>Full daily lesson content is generated later, one lesson at a time, with citations.</span>
        </div>
      </section>

      <section className="curriculum-summary-grid" aria-label="Curriculum progress summary">
        <article className="summary-tile">
          <span>Current week</span>
          <strong>{summary.currentWeek ? `Week ${summary.currentWeek.weekNumber}` : "Complete"}</strong>
        </article>
        <article className="summary-tile">
          <span>Daily lessons</span>
          <strong>
            {summary.completedLessons}/{summary.totalLessons}
          </strong>
        </article>
        <article className="summary-tile">
          <span>Reviews</span>
          <strong>
            {summary.completedReviews}/{summary.totalReviews}
          </strong>
        </article>
        <article className="summary-tile">
          <span>Mode</span>
          <strong>{isPdfDerived ? "PDF" : "Seed"}</strong>
        </article>
        <article className="summary-tile">
          <span>Assessments</span>
          <strong>
            {summary.passedAssessments}/{summary.totalAssessments}
          </strong>
        </article>
      </section>

      <section className="placeholder-layout" aria-label="Curriculum format">
        <article className="placeholder-panel">
          <span className="badge teal">20-minute lesson shape</span>
          <h2>{isPdfDerived ? "Generated shells, content on demand" : "Grammar first, source grounded later"}</h2>
          <p>
            Each daily lesson is structured as five minutes of vocabulary, five minutes of
            grammar, seven minutes of sentence practice, and a three-minute challenge.
            Spanish content appears only after retrieved PDF chunks support it with citations.
          </p>
          <div className="lesson-time-grid">
            <span>5 min vocab</span>
            <span>5 min grammar</span>
            <span>7 min sentences</span>
            <span>3 min challenge</span>
          </div>
        </article>

        <aside className="placeholder-panel">
          <span className="badge gold">Locking rule</span>
          <h2>Pass to continue</h2>
          <p>
            The next week unlocks only after the current week&apos;s five daily lessons, review
            day, and weekly assessment have been completed. Progress is stored locally in
            this browser until a database progress model is added.
          </p>
        </aside>
      </section>

      {sections.map((section) => (
        <section className="source-section" aria-label={section.title} key={section.id}>
          <div className="section-heading-row">
            <div>
              <span className="badge green">{section.title}</span>
              <h2>{section.description}</h2>
            </div>
            {summary.currentLesson ? (
              <Link className="primary-button" href={`/learn/day/${summary.currentLesson.dayNumber}`}>
                Continue day {summary.currentLesson.dayNumber}
              </Link>
            ) : null}
          </div>

          <div className="week-grid">
            {section.weeks.map((week) => {
              const reviewStatus = getReviewStatus(week, progress);
              const assessmentStatus = getAssessmentStatus(week, progress);

              return (
                <article className="week-card" key={week.id}>
                  <div className="week-card-header">
                    <div>
                      <span className="badge teal">Week {week.weekNumber}</span>
                      <h3>{week.title}</h3>
                    </div>
                    <span className={`badge ${statusTone(assessmentStatus)}`}>
                      {assessmentStatus === "complete" ? "Passed" : statusLabel(assessmentStatus)}
                    </span>
                  </div>
                  <p>{week.communicationGoal}</p>

                  <div className="lesson-list" aria-label={`Week ${week.weekNumber} daily lessons`}>
                    {week.lessons.map((lesson) => {
                      const lessonStatus = getLessonStatus(lesson, progress);

                      return lessonStatus === "locked" ? (
                        <div className="lesson-row locked" key={lesson.id}>
                          <span>Day {lesson.dayNumber}</span>
                          <strong>{lesson.title}</strong>
                          <em>Locked</em>
                        </div>
                      ) : (
                        <Link
                          className={`lesson-row ${lessonStatus}`}
                          href={`/learn/day/${lesson.dayNumber}`}
                          key={lesson.id}
                        >
                          <span>Day {lesson.dayNumber}</span>
                          <strong>{lesson.title}</strong>
                          <em>{statusLabel(lessonStatus)}</em>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="week-actions">
                    <div className={`lesson-row ${reviewStatus}`}>
                      <span>Review</span>
                      <strong>{week.reviewDay.title}</strong>
                      {reviewStatus === "available" ? (
                        <button className="secondary-button small-action" onClick={() => completeReview(week.weekNumber)} type="button">
                          Mark done
                        </button>
                      ) : (
                        <em>{statusLabel(reviewStatus)}</em>
                      )}
                    </div>

                    {assessmentStatus === "locked" ? (
                      <div className="lesson-row locked">
                        <span>Assess</span>
                        <strong>{week.assessment.title}</strong>
                        <em>{getAssessmentLockedReason(week, progress)}</em>
                      </div>
                    ) : (
                      <Link
                        className={`lesson-row ${assessmentStatus}`}
                        href={`/learn/week/${week.weekNumber}/assessment`}
                      >
                        <span>Assess</span>
                        <strong>{week.assessment.title}</strong>
                        <em>{assessmentStatus === "complete" ? "Passed" : statusLabel(assessmentStatus)}</em>
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function modeLabel(mode: GeneratedCurriculumStatusSummary["curriculumMode"]) {
  return {
    seed: "Seed fallback",
    pdf_derived: "PDF-derived",
    mixed_fallback: "PDFs ready, seed active"
  }[mode];
}

function statusLabel(status: LessonStatus) {
  return {
    locked: "Locked",
    available: "Available",
    in_progress: "In progress",
    complete: "Complete"
  }[status];
}

function statusTone(status: LessonStatus) {
  return {
    locked: "rose",
    available: "gold",
    in_progress: "teal",
    complete: "green"
  }[status];
}
