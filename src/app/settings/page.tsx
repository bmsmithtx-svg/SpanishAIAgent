import { PageHeader } from "@/components/page-header";
import { getOpenAIModel } from "@/lib/agent/openai-client";
import { getSourceLibraryStats } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const stats = await getSourceLibraryStats();
  const retrievalReady = stats.sourceChunkCount > 0;
  const chatReady = hasOpenAIKey && retrievalReady;
  const model = getOpenAIModel();

  return (
    <div className="page">
      <PageHeader
        eyebrow="Settings"
        title="API and readiness status"
        description="This page shows safe configuration status for future agent work without exposing secrets."
        badges={[
          { label: hasOpenAIKey ? "OpenAI key detected" : "OpenAI key missing", tone: hasOpenAIKey ? "green" : "rose" },
          { label: stats.databaseConnected ? "Database connected" : "Database missing", tone: stats.databaseConnected ? "green" : "rose" },
          { label: chatReady ? "Chat ready" : "Chat not ready", tone: chatReady ? "green" : "gold" }
        ]}
      />

      <section className="placeholder-layout">
        <article className="placeholder-panel">
          <span className="badge teal">Environment</span>
          <h2>Server-side API preparation</h2>
          <p>
            The status API checks whether an OpenAI API key exists and returns only a
            boolean. It also reports local source database readiness without exposing
            any secrets or raw PDF files.
          </p>
          <div className="stack">
            <span className="code-pill">GET /api/agent/status</span>
            <span className="code-pill">POST /api/agent/chat</span>
            <span className="code-pill">DATABASE_URL=file:../local-sources/spanish-ai-agent.db</span>
            <span className="code-pill">OPENAI_MODEL={model}</span>
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
              <strong>Source database</strong>
              <span>{stats.databaseConnected ? "Connected" : stats.error ?? "Not connected"}</span>
            </div>
            <div className="timeline-item">
              <strong>Source documents</strong>
              <span>{stats.sourceDocumentCount} PDFs imported</span>
            </div>
            <div className="timeline-item">
              <strong>Extracted pages</strong>
              <span>{stats.sourcePageCount} pages and {stats.sourceChunkCount} chunks indexed</span>
            </div>
            <div className="timeline-item">
              <strong>Source ingestion</strong>
              <span>{stats.sourceIngestionReady ? "Ready for retrieval work" : "Needs imported PDF chunks"}</span>
            </div>
            <div className="timeline-item">
              <strong>Retrieval</strong>
              <span>{retrievalReady ? "Ready with indexed chunks" : "Not ready"}</span>
            </div>
            <div className="timeline-item">
              <strong>Chat</strong>
              <span>{chatReady ? "Ready for PDF-grounded tutor answers" : "Needs OpenAI key and chunks"}</span>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
