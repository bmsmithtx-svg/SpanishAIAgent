"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { DailyLesson } from "@/types";
import type { LessonSourceContext } from "@/lib/curriculum/source-context";
import {
  getLessonStatus,
  getLockedReason,
  markLessonComplete
} from "@/lib/curriculum/progress";
import { useCurriculumProgress } from "@/lib/curriculum/use-curriculum-progress";

type DailyLessonViewProps = {
  lesson: DailyLesson;
  previousLesson: DailyLesson | null;
  nextLesson: DailyLesson | null;
  sourceContext: LessonSourceContext;
};

export function DailyLessonView({
  lesson,
  previousLesson,
  nextLesson,
  sourceContext
}: DailyLessonViewProps) {
  const progress = useCurriculumProgress();
  const lessonStatus = useMemo(() => getLessonStatus(lesson, progress), [lesson, progress]);
  const locked = lessonStatus === "locked";

  function completeLesson() {
    if (!locked) {
      markLessonComplete(progress, lesson.dayNumber);
    }
  }

  return (
    <div className="lesson-detail-layout">
      <section className="placeholder-panel lesson-main-panel">
        <div className="section-heading-row">
          <div>
            <span className="badge teal">Week {lesson.weekNumber}</span>
            <h2>Day {lesson.dayNumber}: {lesson.title}</h2>
          </div>
          <span className={`badge ${locked ? "rose" : lessonStatus === "complete" ? "green" : "gold"}`}>
            {locked ? "Locked" : lessonStatus === "complete" ? "Complete" : "Available"}
          </span>
        </div>
        <p>
          This is a 20-minute placeholder lesson shell. The grammar focus and practice content
          cannot display Spanish examples until retrieved PDF pages support them with citations.
        </p>

        <div className="lesson-meta-grid">
          <div>
            <span>Grammar focus</span>
            <strong>{lesson.grammarFocus}</strong>
          </div>
          <div>
            <span>Vocabulary focus</span>
            <strong>{lesson.vocabularyFocus}</strong>
          </div>
          <div>
            <span>Family goal</span>
            <strong>{lesson.familyCommunicationGoal}</strong>
          </div>
        </div>

        <div className="lesson-block-grid" aria-label="20-minute lesson blocks">
          {lesson.blocks.map((block) => (
            <article className="lesson-block" key={block.kind}>
              <span className="badge gold">{block.minutes} min</span>
              <h3>{block.label}</h3>
              <p>{block.placeholder}</p>
            </article>
          ))}
        </div>
      </section>

      <aside className="lesson-side-stack">
        <article className="placeholder-panel">
          <span className="badge green">Progress gate</span>
          <h2>{locked ? "Complete prerequisites first" : "Ready for local completion"}</h2>
          <p>{locked ? getLockedReason(lesson, progress) : "Mark this shell complete after reviewing the placeholder structure and source status."}</p>
          <button className="primary-button" disabled={locked || lessonStatus === "complete"} onClick={completeLesson} type="button">
            {lessonStatus === "complete" ? "Lesson complete" : "Mark lesson complete"}
          </button>
          <div className="action-row compact-actions">
            {previousLesson ? (
              <Link className="secondary-button" href={`/learn/day/${previousLesson.dayNumber}`}>
                Previous
              </Link>
            ) : null}
            {nextLesson ? (
              <Link className="secondary-button" href={`/learn/day/${nextLesson.dayNumber}`}>
                Next
              </Link>
            ) : (
              <Link className="secondary-button" href="/learn">
                Roadmap
              </Link>
            )}
          </div>
        </article>

        <article className="placeholder-panel">
          <span className="badge teal">Source context</span>
          <h2>PDF citation readiness</h2>
          <p>{sourceContext.message}</p>
          <div className="stack">
            <span className="code-pill">Retrieval: {retrievalLabel(sourceContext.retrievalMode)}</span>
            <span className="code-pill">Sources: {sourceContext.sourceReferences.length}</span>
          </div>
        </article>
      </aside>

      <section className="source-section lesson-source-section" aria-label="Lesson source references">
        <div className="section-heading-row">
          <div>
            <span className="badge rose">PDF-only rule</span>
            <h2>Future content source references</h2>
          </div>
          <span className="result-count">{sourceContext.sourceReferences.length} references</span>
        </div>
        {sourceContext.sourceReferences.length === 0 ? (
          <div className="empty-state">
            <strong>No source references attached yet</strong>
            <span>Lesson explanations, vocabulary, grammar, and practice stay as placeholders.</span>
          </div>
        ) : (
          <div className="citation-list">
            {sourceContext.sourceReferences.map((reference) => (
              <Link
                className="citation-card"
                href={reference.documentId ? `/library/${reference.documentId}#page-${reference.pageNumber}` : "/library"}
                key={`${reference.fileName}-${reference.pageNumber}-${reference.chunkId ?? "page"}`}
              >
                <strong>{reference.citationLabel ?? `${reference.fileName}, page ${reference.pageNumber}`}</strong>
                <span>{reference.preview ?? "Source preview unavailable."}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function retrievalLabel(mode: LessonSourceContext["retrievalMode"]) {
  return {
    hybrid: "local semantic scoring over stored chunk embeddings + keyword",
    keyword: "keyword",
    none: "none"
  }[mode];
}
