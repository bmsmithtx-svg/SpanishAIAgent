import { PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  return (
    <div className="page">
      <PageHeader
        eyebrow="Settings"
        title="API and readiness status"
        description="This page shows safe configuration status for future agent work without exposing secrets."
        badges={[
          { label: hasOpenAIKey ? "OpenAI key detected" : "OpenAI key missing", tone: hasOpenAIKey ? "green" : "rose" },
          { label: "Agent not implemented", tone: "gold" }
        ]}
      />

      <section className="placeholder-layout">
        <article className="placeholder-panel">
          <span className="badge teal">Environment</span>
          <h2>Server-side API preparation</h2>
          <p>
            The status API checks whether an OpenAI API key exists and returns only a
            boolean. The key value is never sent to the client.
          </p>
          <div className="stack">
            <span className="code-pill">GET /api/agent/status</span>
            <span className="code-pill">POST /api/agent/chat</span>
          </div>
        </article>

        <aside className="placeholder-panel">
          <span className="badge rose">Readiness</span>
          <div className="stack" style={{ marginTop: 14 }}>
            <div className="timeline-item">
              <strong>OpenAI API key</strong>
              <span>{hasOpenAIKey ? "Configured locally" : "Not configured locally"}</span>
            </div>
            <div className="timeline-item">
              <strong>PDF retrieval</strong>
              <span>Not implemented yet</span>
            </div>
            <div className="timeline-item">
              <strong>Agent answers</strong>
              <span>Disabled until source grounding is available</span>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
