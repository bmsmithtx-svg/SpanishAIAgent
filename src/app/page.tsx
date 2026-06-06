import { FeatureCard } from "@/components/feature-card";
import { PageHeader } from "@/components/page-header";

const dashboardCards = [
  {
    index: "01",
    title: "Today's Spanish lesson",
    status: "Waiting for PDFs",
    description:
      "A focused daily lesson will appear here after source PDFs are ingested and page-level citations are available.",
    tone: "teal" as const
  },
  {
    index: "02",
    title: "Family conversation practice",
    status: "Planned",
    description:
      "Practice flows will be built for realistic family communication, using only supported PDF passages.",
    tone: "gold" as const
  },
  {
    index: "03",
    title: "Grammar foundation",
    status: "Source-gated",
    description:
      "Grammar explanations will stay locked to uploaded source material and cite the exact file and page.",
    tone: "green" as const
  },
  {
    index: "04",
    title: "Pronunciation practice",
    status: "Placeholder",
    description:
      "Pronunciation guidance will be added only when the PDF library provides source-backed material.",
    tone: "rose" as const
  },
  {
    index: "05",
    title: "PDF source coverage",
    status: "Not indexed",
    description:
      "Coverage metrics will summarize which uploaded PDFs and pages are available for lessons and practice.",
    tone: "teal" as const
  },
  {
    index: "06",
    title: "Future AI tutor status",
    status: "Offline",
    description:
      "The tutor agent route exists as a placeholder and will require source retrieval before answering.",
    tone: "gold" as const
  }
];

export default function DashboardPage() {
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
            This first version sets up the app shell, routes, source-aware types,
            prompt guardrails, and backend placeholders. Real learning content will
            appear only after uploaded PDFs have been parsed into cited source pages.
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
            <span className="status-value">Not connected</span>
          </div>
          <div className="status-metric">
            <span className="status-label">Lesson engine</span>
            <span className="status-value">Placeholder</span>
          </div>
          <div className="status-metric">
            <span className="status-label">Agent chat</span>
            <span className="status-value">Not implemented</span>
          </div>
          <div className="status-metric">
            <span className="status-label">Citation policy</span>
            <span className="status-value">Required</span>
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
