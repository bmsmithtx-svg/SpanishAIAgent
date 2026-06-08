"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  DailyLesson,
  GeneratedDailyLesson,
  GeneratedLessonBlock,
  GeneratedLessonCitation
} from "@/types";
import { getLessonStatus, getLockedReason, markLessonComplete } from "@/lib/curriculum/progress";
import { useCurriculumProgress } from "@/lib/curriculum/use-curriculum-progress";

type DailyLessonViewProps = {
  lesson: DailyLesson;
  previousLesson: DailyLesson | null;
  nextLesson: DailyLesson | null;
  generatedLesson: GeneratedDailyLesson;
};

type LessonApiResponse = {
  generatedLesson?: GeneratedDailyLesson;
  lessonContent?: GeneratedDailyLesson;
  error?: string;
};

export function DailyLessonView({
  lesson,
  previousLesson,
  nextLesson,
  generatedLesson
}: DailyLessonViewProps) {
  const progress = useCurriculumProgress();
  const [lessonContent, setLessonContent] = useState(generatedLesson);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState("");
  const lessonStatus = useMemo(() => getLessonStatus(lesson, progress), [lesson, progress]);
  const locked = lessonStatus === "locked";
  const hasGeneratedContent = lessonContent.status === "generated" && lessonContent.sourceGrounded;

  function completeLesson() {
    if (!locked) {
      markLessonComplete(progress, lesson.dayNumber);
    }
  }

  async function regenerateLesson() {
    if (isRegenerating) {
      return;
    }

    setIsRegenerating(true);
    setGenerationMessage("");

    try {
      const response = await fetch(`/api/lessons/day/${lesson.dayNumber}/regenerate`, {
        method: "POST"
      });
      const payload = (await response.json()) as LessonApiResponse;
      const nextLessonContent = payload.generatedLesson ?? payload.lessonContent;

      if (!response.ok || !nextLessonContent) {
        throw new Error(payload.error ?? "Lesson regeneration failed.");
      }

      setLessonContent(nextLessonContent);
      setGenerationMessage(
        nextLessonContent.status === "generated"
          ? "Lesson regenerated from current PDF sources."
          : nextLessonContent.missingSourceWarning ?? "Lesson regenerated into a safe warning state."
      );
    } catch (error) {
      setGenerationMessage(error instanceof Error ? error.message : "Lesson regeneration failed.");
    } finally {
      setIsRegenerating(false);
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
          <span className={`badge ${hasGeneratedContent ? "green" : "gold"}`}>
            {hasGeneratedContent ? "PDF-grounded lesson" : statusLabel(lessonContent.status)}
          </span>
        </div>
        <p>
          This 20-minute lesson is generated only from retrieved PDF chunks. If a block does
          not have enough support, the app shows a warning instead of inventing Spanish content.
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

        <div className="chat-status-row" aria-label="Lesson generation status">
          <span className={`badge ${hasGeneratedContent ? "green" : "rose"}`}>
            {lessonContent.sourceGrounded ? "Source grounded" : "Needs PDF support"}
          </span>
          <span className="badge teal">Retrieval: {retrievalLabel(lessonContent.retrievalMode)}</span>
          <span className="badge gold">
            Local semantic scoring over stored chunk embeddings:{" "}
            {lessonContent.semanticRetrievalUsed ? "yes" : "no"}
          </span>
        </div>

        {lessonContent.missingSourceWarning ? (
          <div className="warning-panel lesson-warning">
            <strong>Not enough PDF support found</strong>
            <span>{lessonContent.missingSourceWarning}</span>
          </div>
        ) : null}
      </section>

      <aside className="lesson-side-stack">
        <article className="placeholder-panel">
          <span className="badge green">Progress gate</span>
          <h2>{locked ? "Complete prerequisites first" : "Ready for local completion"}</h2>
          <p>
            {locked
              ? getLockedReason(lesson, progress)
              : "Mark this lesson complete after reviewing the generated blocks and citations."}
          </p>
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
          <span className="badge teal">Lesson generation</span>
          <h2>Current PDF source pass</h2>
          <p>
            Generated {formatDateTime(lessonContent.generatedAt)}. Regeneration reruns retrieval
            and uses OpenAI only after PDF chunks are found.
          </p>
          <button className="secondary-button" disabled={isRegenerating} onClick={regenerateLesson} type="button">
            {isRegenerating ? "Regenerating..." : "Regenerate lesson"}
          </button>
          {generationMessage ? <p className="form-message">{generationMessage}</p> : null}
        </article>
      </aside>

      <section className="generated-lesson-grid lesson-source-section" aria-label="Generated lesson blocks">
        <VocabularyBlock block={lessonContent.vocabularyWarmup} />
        <GrammarBlock block={lessonContent.grammarConcept} />
        <SentenceBlock block={lessonContent.sentenceBuilding} />
        <ChallengeBlock block={lessonContent.typedSpeakAloudChallenge} />
      </section>

      <section className="source-section lesson-source-section" id="source-citations" aria-label="Lesson source references">
        <div className="section-heading-row">
          <div>
            <span className="badge rose">PDF-only rule</span>
            <h2>Source citations</h2>
          </div>
          <span className="result-count">{lessonContent.citations.length} references</span>
        </div>
        {lessonContent.citations.length === 0 ? (
          <div className="empty-state">
            <strong>No source references attached</strong>
            <span>Lesson content stays in a safe warning state until PDF chunks support it.</span>
          </div>
        ) : (
          <div className="citation-list">
            {lessonContent.citations.map((citation) => (
              <CitationCard citation={citation} key={citation.chunkId ?? citation.citationLabel} />
            ))}
          </div>
        )}
      </section>

      {lessonContent.limitations.length > 0 ? (
        <section className="source-section lesson-source-section" aria-label="Lesson limitations">
          <div className="section-heading-row">
            <div>
              <span className="badge gold">Limitations</span>
              <h2>Source support notes</h2>
            </div>
          </div>
          <ul className="lesson-content-list">
            {lessonContent.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function VocabularyBlock({ block }: { block: GeneratedDailyLesson["vocabularyWarmup"] }) {
  return (
    <article className="generated-lesson-block" id="vocabulary-warmup">
      <LessonBlockHeader block={block} />
      {block.items.length === 0 ? (
        <MissingBlockWarning warning={block.missingSourceWarning} />
      ) : (
        <div className="lesson-content-list">
          {block.items.map((item) => (
            <div className="lesson-content-item" key={`${item.term}-${item.meaning}`}>
              <strong>{item.term}</strong>
              <span>{item.meaning}</span>
              {item.usageNote ? <p>{item.usageNote}</p> : null}
              <CitationPills citations={item.citations} />
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function GrammarBlock({ block }: { block: GeneratedDailyLesson["grammarConcept"] }) {
  return (
    <article className="generated-lesson-block" id="grammar-concept">
      <LessonBlockHeader block={block} />
      <p>{block.explanation.summary}</p>
      {block.explanation.keyPoints.length > 0 ? (
        <ul className="lesson-content-list">
          {block.explanation.keyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ) : (
        <MissingBlockWarning warning={block.missingSourceWarning} />
      )}
      <CitationPills citations={block.explanation.citations} />
    </article>
  );
}

function SentenceBlock({ block }: { block: GeneratedDailyLesson["sentenceBuilding"] }) {
  return (
    <article className="generated-lesson-block" id="sentence-building">
      <LessonBlockHeader block={block} />
      {block.practiceItems.length === 0 ? (
        <MissingBlockWarning warning={block.missingSourceWarning} />
      ) : (
        <div className="lesson-content-list">
          {block.practiceItems.map((item) => (
            <div className="lesson-content-item" key={`${item.prompt}-${item.learnerTask}`}>
              <strong>{item.prompt}</strong>
              <span>{item.learnerTask}</span>
              {item.answerGuidance ? <p>{item.answerGuidance}</p> : null}
              <CitationPills citations={item.citations} />
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function ChallengeBlock({ block }: { block: GeneratedDailyLesson["typedSpeakAloudChallenge"] }) {
  return (
    <article className="generated-lesson-block" id="typed-speak-aloud-challenge">
      <LessonBlockHeader block={block} />
      <div className="lesson-content-item">
        <strong>{block.challenge.prompt}</strong>
        <span>{block.challenge.typedResponseInstructions}</span>
        <p>{block.challenge.speakAloudInstructions}</p>
        <CitationPills citations={block.challenge.citations} />
      </div>
    </article>
  );
}

function LessonBlockHeader({ block }: { block: GeneratedLessonBlock }) {
  return (
    <div className="generated-block-header">
      <div>
        <span className="badge gold">{block.minutes} min</span>
        <h3>{block.title}</h3>
      </div>
      <CitationPills citations={block.citations} />
      <p>{block.objective}</p>
      <p>{block.instructions}</p>
      {block.missingSourceWarning ? <p className="form-message">{block.missingSourceWarning}</p> : null}
    </div>
  );
}

function CitationPills({ citations }: { citations: GeneratedLessonCitation[] }) {
  if (citations.length === 0) {
    return null;
  }

  return (
    <div className="citation-pill-row">
      {citations.map((citation) => (
        <Link
          className="citation-pill"
          href={`/library/${citation.documentId}#page-${citation.pageNumber}`}
          key={citation.chunkId ?? citation.citationLabel}
        >
          {citation.citationLabel}
        </Link>
      ))}
    </div>
  );
}

function CitationCard({ citation }: { citation: GeneratedLessonCitation }) {
  return (
    <Link className="citation-card" href={`/library/${citation.documentId}#page-${citation.pageNumber}`}>
      <strong>{citation.citationLabel}</strong>
      <span>{citation.snippet}</span>
    </Link>
  );
}

function MissingBlockWarning({ warning }: { warning?: string }) {
  return (
    <div className="empty-state">
      <strong>Block not generated</strong>
      <span>{warning ?? "The retrieved PDFs did not provide enough support for this block."}</span>
    </div>
  );
}

function retrievalLabel(mode: GeneratedDailyLesson["retrievalMode"]) {
  return {
    hybrid: "keyword + local semantic scoring over stored chunk embeddings",
    keyword: "keyword",
    none: "none"
  }[mode];
}

function statusLabel(status: GeneratedDailyLesson["status"]) {
  return {
    generated: "Generated",
    missing_source: "Missing source support",
    openai_not_configured: "OpenAI key missing",
    generation_failed: "Generation failed"
  }[status];
}

function formatDateTime(value: string) {
  if (!value) {
    return "just now";
  }

  return new Date(value).toLocaleString();
}
