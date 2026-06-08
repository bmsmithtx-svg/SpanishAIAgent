"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type {
  AssessmentAttempt,
  AssessmentMessage,
  CurriculumWeek,
  WeeklyAssessment
} from "@/types";
import type { LessonSourceContext } from "@/lib/curriculum/source-context";
import {
  getAssessmentLockedReason,
  getAssessmentStatus,
  getLatestAssessmentAttempt,
  recordAssessmentAttempt
} from "@/lib/curriculum/progress";
import { useCurriculumProgress } from "@/lib/curriculum/use-curriculum-progress";

type WeeklyAssessmentViewProps = {
  week: CurriculumWeek;
  assessment: WeeklyAssessment;
  sourceContext: LessonSourceContext;
};

type AssessmentApiResponse = {
  message?: string;
  messages?: AssessmentMessage[];
  assessorMessage?: AssessmentMessage;
  sourceReferences?: LessonSourceContext["sourceReferences"];
  score?: number;
  passed?: boolean;
  strengths?: string[];
  needsReview?: string[];
  progressionUnlockAllowed?: boolean;
  warning?: string;
  error?: string;
};

export function WeeklyAssessmentView({ week, assessment, sourceContext }: WeeklyAssessmentViewProps) {
  const progress = useCurriculumProgress();
  const [messages, setMessages] = useState<AssessmentMessage[]>([]);
  const [input, setInput] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const assessmentStatus = useMemo(
    () => getAssessmentStatus(week, progress),
    [progress, week]
  );
  const latestAttempt = useMemo(
    () => getLatestAssessmentAttempt(progress, assessment.weekNumber),
    [assessment.weekNumber, progress]
  );
  const displayedMessages = messages.length > 0 ? messages : latestAttempt?.messages ?? [];
  const locked = assessmentStatus === "locked";
  const passed = assessmentStatus === "complete";

  async function startAssessment() {
    if (locked || isWorking) {
      return;
    }

    setIsWorking(true);
    setStatusMessage("");

    try {
      const payload = await postAssessmentApi("/api/assessment/start", {
        weekNumber: assessment.weekNumber
      });
      setMessages(payload.messages ?? []);
      setStatusMessage(payload.warning ?? payload.message ?? "Assessment placeholder started.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to start assessment.");
    } finally {
      setIsWorking(false);
    }
  }

  async function sendAssessmentMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const learnerText = input.trim();

    if (!learnerText || locked || isWorking) {
      return;
    }

    const learnerMessage: AssessmentMessage = {
      id: crypto.randomUUID(),
      role: "learner",
      content: learnerText,
      createdAt: new Date().toISOString()
    };
    const nextMessages = [...displayedMessages, learnerMessage];
    setMessages(nextMessages);
    setInput("");
    setIsWorking(true);
    setStatusMessage("");

    try {
      const payload = await postAssessmentApi("/api/assessment/message", {
        weekNumber: assessment.weekNumber,
        messages: nextMessages
      });
      setMessages(payload.assessorMessage ? [...nextMessages, payload.assessorMessage] : nextMessages);
      setStatusMessage(payload.warning ?? payload.message ?? "Assessment message recorded.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to record assessment message.");
    } finally {
      setIsWorking(false);
    }
  }

  async function recordPlaceholderGrade(result: "pass" | "fail") {
    if (locked || isWorking) {
      return;
    }

    setIsWorking(true);
    setStatusMessage("");

    try {
      const payload = await postAssessmentApi("/api/assessment/grade", {
        weekNumber: assessment.weekNumber,
        messages: displayedMessages,
        placeholderResult: result
      });
      const attempt: AssessmentAttempt = {
        id: crypto.randomUUID(),
        weekNumber: assessment.weekNumber,
        startedAt: displayedMessages[0]?.createdAt ?? new Date().toISOString(),
        completedAt: new Date().toISOString(),
        score: payload.score,
        passed: Boolean(payload.passed),
        messages: displayedMessages,
        strengths: payload.strengths ?? [],
        needsReview: payload.needsReview ?? []
      };
      recordAssessmentAttempt(progress, attempt);
      setStatusMessage(payload.message ?? "Placeholder assessment result recorded locally.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to record assessment result.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="assessment-layout">
      <section className="placeholder-panel">
        <div className="section-heading-row">
          <div>
            <span className="badge teal">Week {assessment.weekNumber}</span>
            <h2>{assessment.title}</h2>
          </div>
          <span className={`badge ${passed ? "green" : locked ? "rose" : "gold"}`}>
            {passed ? "Passed" : locked ? "Locked" : "Available"}
          </span>
        </div>
        <p>
          Weekly assessments are placeholders until a PDF-grounded assessor is connected.
          A passing local result unlocks the next week; a failed result leaves this week open
          for more review.
        </p>
        <div className="rubric-grid" aria-label="Mastery requirements">
          {assessment.masteryRequirements.map((requirement) => (
            <div key={requirement}>
              <span>Mastery requirement</span>
              <strong>{requirement}</strong>
            </div>
          ))}
        </div>
      </section>

      <aside className="placeholder-panel">
        <span className="badge green">Unlock state</span>
        <h2>{locked ? "Assessment locked" : passed ? "Week passed" : "Ready to start"}</h2>
        <p>{locked ? getAssessmentLockedReason(week, progress) : "This placeholder flow is available for local progress testing."}</p>
        {latestAttempt ? (
          <div className="timeline-item">
            <strong>Latest result</strong>
            <span>
              {latestAttempt.passed ? "Passed" : "Needs review"}
              {typeof latestAttempt.score === "number" ? ` with ${latestAttempt.score}%` : ""}
            </span>
          </div>
        ) : null}
        <div className="action-row compact-actions">
          <button className="primary-button" disabled={locked || isWorking} onClick={startAssessment} type="button">
            {displayedMessages.length > 0 ? "Restart placeholder" : "Start placeholder"}
          </button>
          <Link className="secondary-button" href="/learn">
            Roadmap
          </Link>
        </div>
      </aside>

      <section className="assessment-chat-panel" aria-label="Assessment placeholder conversation">
        <div className="section-heading-row">
          <div>
            <span className="badge rose">PDF-only assessment</span>
            <h2>Source-gated conversation</h2>
          </div>
          <span className="result-count">{displayedMessages.length} messages</span>
        </div>

        {displayedMessages.length === 0 ? (
          <div className="empty-state">
            <strong>No assessment messages yet</strong>
            <span>Start the placeholder assessment after the week is unlocked.</span>
          </div>
        ) : (
          <div className="message-list assessment-messages" aria-live="polite">
            {displayedMessages.map((message) => (
              <article className={`message ${message.role === "learner" ? "user" : "assistant"}`} key={message.id}>
                <span className="message-label">
                  {message.role === "learner" ? "You" : message.role === "system" ? "Assessment" : "SpanishAIAgent"}
                </span>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
        )}

        <form className="chat-form" onSubmit={sendAssessmentMessage}>
          <textarea
            className="chat-input"
            disabled={locked}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type a placeholder assessment response"
            rows={4}
            value={input}
          />
          <button className="primary-button" disabled={locked || isWorking || !input.trim()} type="submit">
            Send placeholder answer
          </button>
        </form>

        <div className="assessment-grade-actions">
          <button className="secondary-button" disabled={locked || isWorking} onClick={() => recordPlaceholderGrade("fail")} type="button">
            Record placeholder fail
          </button>
          <button className="primary-button" disabled={locked || isWorking} onClick={() => recordPlaceholderGrade("pass")} type="button">
            Record placeholder pass
          </button>
        </div>
        {statusMessage ? <p className="form-message">{statusMessage}</p> : null}
      </section>

      <section className="source-section assessment-source-section" aria-label="Assessment source references">
        <div className="section-heading-row">
          <div>
            <span className="badge teal">Source context</span>
            <h2>Future assessment citations</h2>
          </div>
          <span className="result-count">{sourceContext.sourceReferences.length} references</span>
        </div>
        <p>{sourceContext.message}</p>
        {sourceContext.sourceReferences.length === 0 ? (
          <div className="empty-state">
            <strong>No assessment sources attached yet</strong>
            <span>Questions and grading criteria stay as placeholders until retrieved pages support them.</span>
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

async function postAssessmentApi(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as AssessmentApiResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "Assessment request failed.");
  }

  return payload;
}
