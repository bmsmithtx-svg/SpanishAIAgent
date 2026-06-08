import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getCurriculumSummary, getDailyLessonByDayNumber } from "@/lib/curriculum";
import { getSourceLibraryStats } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function PracticePage() {
  const [stats, summary] = await Promise.all([getSourceLibraryStats(), Promise.resolve(getCurriculumSummary())]);
  const currentLesson = getDailyLessonByDayNumber(1);

  const practiceModes = [
    {
      title: "Today's sentence-building block",
      status: currentLesson ? `Day ${currentLesson.dayNumber}` : "Roadmap",
      copy:
        "Jump straight into the current lesson's sentence-building practice. It displays only PDF-grounded content or a safe missing-source warning.",
      href: currentLesson ? `/learn/day/${currentLesson.dayNumber}#sentence-building` : "/learn"
    },
    {
      title: "Daily lesson review",
      status: `${summary.lessonCount} lessons`,
      copy:
        "Review unlocked daily grammar blocks. Spanish drills stay source-gated unless PDF citations support them.",
      href: "/learn"
    },
    {
      title: "Family conversation rehearsal",
      status: "PDF-gated",
      copy:
        "Future conversation prompts will use retrieved source excerpts for practical family communication.",
      href: "/chat"
    },
    {
      title: "Weekly assessment prep",
      status: `${summary.assessmentCount} gates`,
      copy:
        "Prepare for each weekly gate after the five daily lessons and review day are complete.",
      href: "/learn/week/1/assessment"
    }
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Practice mode"
        title="Practice that follows the daily grammar path"
        description="Practice is now organized around the local lesson roadmap. Real drills, corrections, and conversation prompts still require uploaded PDF support and file/page citations."
        badges={[
          { label: stats.sourceIngestionReady ? "Sources indexed" : "Waiting for PDFs", tone: stats.sourceIngestionReady ? "green" : "gold" },
          { label: "No invented drills", tone: "rose" }
        ]}
      />

      <section className="practice-mode-grid" aria-label="Practice modes">
        {practiceModes.map((mode) => (
          <article className="placeholder-panel" key={mode.title}>
            <span className="badge teal">{mode.status}</span>
            <h2>{mode.title}</h2>
            <p>{mode.copy}</p>
            <Link className="secondary-button inline-action" href={mode.href}>
              Open
            </Link>
          </article>
        ))}
      </section>

      <section className="placeholder-layout section-offset" aria-label="Practice guardrails">
        <article className="placeholder-panel">
          <span className="badge gold">Current behavior</span>
          <h2>Practice is structured, not generated</h2>
          <p>
            The app can now route practice around daily lessons and weekly assessments.
            It does not generate Spanish vocabulary, grammar explanations, examples, or drills
            unless source retrieval can support them from uploaded PDFs.
          </p>
        </article>
        <aside className="placeholder-panel">
          <span className="badge green">Source readiness</span>
          <div className="stack readiness-stack">
            <div className="timeline-item">
              <strong>PDFs imported</strong>
              <span>{stats.sourceDocumentCount}</span>
            </div>
            <div className="timeline-item">
              <strong>Searchable chunks</strong>
              <span>{stats.sourceChunkCount}</span>
            </div>
            <div className="timeline-item">
              <strong>Practice generation</strong>
              <span>{stats.sourceIngestionReady ? "Ready for source retrieval design" : "Needs PDF source chunks"}</span>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
