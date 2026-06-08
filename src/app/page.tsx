import { CurriculumStatusPanel } from "@/components/curriculum-status-panel";
import { FeatureCard } from "@/components/feature-card";
import { PageHeader } from "@/components/page-header";
import { getCurriculumSections, getCurriculumSummary, getDailyLessonByDayNumber } from "@/lib/curriculum";
import { getEmbeddingStatus, getSourceLibraryStats } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, embeddingStatus] = await Promise.all([
    getSourceLibraryStats(),
    getEmbeddingStatus()
  ]);
  const sections = getCurriculumSections();
  const curriculumSummary = getCurriculumSummary();
  const currentLesson = getDailyLessonByDayNumber(1);
  const lessonRetrievalStatus = embeddingStatus.semanticRetrievalReady
    ? "local semantic scoring over stored chunk embeddings ready"
    : stats.sourceChunkCount > 0
      ? "keyword retrieval ready"
      : "needs source chunks";
  const dashboardCards = [
    {
      index: "01",
      title: "Current lesson",
      status: stats.sourceIngestionReady ? "PDF sources ready" : "Needs PDFs",
      description: currentLesson
        ? `Day ${currentLesson.dayNumber}: ${currentLesson.grammarFocus}. Retrieval status: ${lessonRetrievalStatus}.`
        : "Daily lesson metadata is not available yet.",
      tone: stats.sourceIngestionReady ? ("green" as const) : ("gold" as const),
      href: currentLesson ? `/learn/day/${currentLesson.dayNumber}` : "/learn",
      actionLabel: "Open current lesson"
    },
    {
      index: "02",
      title: "Family conversation practice",
      status: "Roadmap-linked",
      description:
        "Practice now points back to the daily grammar path and will use only supported PDF passages when generated.",
      tone: "gold" as const
    },
    {
      index: "03",
      title: "Grammar foundation",
      status: `${curriculumSummary.weekCount} weeks`,
      description:
        `${curriculumSummary.lessonCount} daily lesson shells are organized into a grammar-first sequence with weekly gates.`,
      tone: "green" as const
    },
    {
      index: "04",
      title: "Pronunciation practice",
      status: "Source-gated",
      description:
        "Pronunciation guidance will be added only when the PDF library provides source-backed material.",
      tone: "rose" as const
    },
    {
      index: "05",
      title: "PDF source coverage",
      status: `${stats.sourceDocumentCount} PDFs`,
      description: `${stats.sourcePageCount} extracted pages and ${stats.sourceChunkCount} searchable chunks are currently indexed.`,
      tone: "teal" as const
    },
    {
      index: "06",
      title: "Future AI tutor status",
      status: stats.sourceIngestionReady ? "Sources ready" : "Offline",
      description:
        "The tutor remains disabled until retrieval-grounded chat is connected to indexed PDF chunks.",
      tone: "gold" as const
    }
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="SpanishAIAgent"
        title="Everyday Spanish learning, grounded in your PDFs."
        description="SpanishAIAgent is being built for practical communication with Mexican family. The future tutor will teach only from uploaded Spanish PDFs and cite the source file name and page number for each lesson, explanation, example, and answer."
        badges={[
          { label: "Dark study workspace", tone: "teal" },
          { label: "No outside curriculum", tone: "rose" }
        ]}
      />

      <section className="dashboard-hero" aria-label="Project purpose and status">
        <article className="hero-panel">
          <span className="badge gold">Foundation mode</span>
          <h2>Built for real conversations, with strict source grounding.</h2>
          <p>
            This version now includes local PDF ingestion, page extraction, chunking,
            source search, and citation labels. Real learning content still appears
            only after uploaded PDFs have been parsed into cited source records.
          </p>
          <ul className="rule-list">
            <li>Practical everyday Spanish learning is the product focus.</li>
            <li>Family communication is the guiding use case.</li>
            <li>Uploaded PDFs are the only allowed educational source.</li>
            <li>Future tutor answers must cite PDF file names and page numbers.</li>
          </ul>
        </article>

        <aside className="status-panel" aria-label="Current readiness">
          <div className="status-metric">
            <span className="status-label">PDF ingestion</span>
            <span className="status-value">{stats.sourceIngestionReady ? "Ready" : "Needs sources"}</span>
          </div>
          <div className="status-metric">
            <span className="status-label">Uploaded PDFs</span>
            <span className="status-value">{stats.sourceDocumentCount}</span>
          </div>
          <div className="status-metric">
            <span className="status-label">Extracted pages</span>
            <span className="status-value">{stats.sourcePageCount}</span>
          </div>
          <div className="status-metric">
            <span className="status-label">Source chunks</span>
            <span className="status-value">{stats.sourceChunkCount}</span>
          </div>
          <div className="status-metric">
            <span className="status-label">Database</span>
            <span className="status-value">{stats.databaseConnected ? "Connected" : "Not connected"}</span>
          </div>
        </aside>
      </section>

      <section className="placeholder-layout section-offset" aria-label="Daily curriculum status">
        <CurriculumStatusPanel sections={sections} />
        <aside className="placeholder-panel">
          <span className="badge gold">Grammar-first plan</span>
          <h2>Daily study now has a shape</h2>
          <p>
            The app now tracks a local eight-week lesson sequence: five daily lessons,
            a review day, and a weekly assessment gate. It still avoids unsupported Spanish
            curriculum until the PDF library supplies source context.
          </p>
          <div className="stack">
            <span className="code-pill">{curriculumSummary.lessonCount} daily lessons</span>
            <span className="code-pill">{curriculumSummary.assessmentCount} assessments</span>
            <span className="code-pill">localStorage progress</span>
          </div>
        </aside>
      </section>

      <section className="card-grid" aria-label="Dashboard learning cards">
        {dashboardCards.map((card) => (
          <FeatureCard key={card.title} {...card} />
        ))}
      </section>
    </div>
  );
}
