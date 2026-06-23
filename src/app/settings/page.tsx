import { CurriculumStatusPanel } from "@/components/curriculum-status-panel";
import { EmbeddingBackfillPanel } from "@/components/embedding-backfill-panel";
import { PageHeader } from "@/components/page-header";
import { getOpenAIModel } from "@/lib/agent/openai-client";
import {
  generatedCurriculumToSections,
  getActiveGeneratedCurriculum
} from "@/lib/curriculum/generated-curriculum-read";
import { getGeneratedCurriculumStatus } from "@/lib/curriculum/generated-curriculum-status";
import { getCurriculumSections } from "@/lib/curriculum/curriculum-map";
import {
  getEmbeddingBackfillDefaultLimit,
  getEmbeddingBackfillMaxLimit,
  getEmbeddingStatus
} from "@/lib/sources/embedding-service";
import {
  getSourceLibraryStats
} from "@/lib/sources/source-service";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const [stats, embeddingStatus, generatedCurriculum, curriculumStatus] = await Promise.all([
    getSourceLibraryStats(),
    getEmbeddingStatus(),
    getActiveGeneratedCurriculum(),
    getGeneratedCurriculumStatus()
  ]);
  const retrievalReady = stats.sourceChunkCount > 0;
  const chatReady = hasOpenAIKey && retrievalReady;
  const model = getOpenAIModel();
  const backfillDefaultLimit = getEmbeddingBackfillDefaultLimit();
  const backfillMaxLimit = getEmbeddingBackfillMaxLimit();
  const sections = generatedCurriculum
    ? generatedCurriculumToSections(generatedCurriculum)
    : getCurriculumSections();
  const classificationRows = Object.entries(curriculumStatus.classificationSummary)
    .filter(([, bucket]) => bucket.total > 0)
    .sort(([, left], [, right]) => right.total - left.total)
    .slice(0, 6);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Settings"
        title="API and readiness status"
        description="This page shows safe configuration status for future agent work without exposing secrets."
        badges={[
          { label: hasOpenAIKey ? "OpenAI key detected" : "OpenAI key missing", tone: hasOpenAIKey ? "green" : "rose" },
          { label: stats.databaseConnected ? "Database connected" : "Database missing", tone: stats.databaseConnected ? "green" : "rose" },
          { label: embeddingStatus.semanticRetrievalReady ? "Local semantic scoring ready" : "Keyword fallback", tone: embeddingStatus.semanticRetrievalReady ? "green" : "gold" },
          { label: generatedCurriculum ? "PDF-derived curriculum" : "Seed fallback", tone: generatedCurriculum ? "green" : "gold" },
          { label: curriculumStatus.curriculumBuiltWithPageFiltering ? "Page filtering active" : "Page filtering preview", tone: curriculumStatus.curriculumBuiltWithPageFiltering ? "green" : "gold" },
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
            <span className="code-pill">GET /api/curriculum/status</span>
            <span className="code-pill">POST /api/curriculum/generate</span>
            <span className="code-pill">DATABASE_URL=file:../local-sources/spanish-ai-agent.db</span>
            <span className="code-pill">OPENAI_MODEL={model}</span>
          </div>
        </article>

        <aside className="placeholder-panel">
          <span className="badge rose">Readiness</span>
          <div className="stack readiness-stack">
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
              <span>
                {embeddingStatus.semanticRetrievalReady
                  ? "Keyword + local semantic scoring over stored chunk embeddings ready"
                  : retrievalReady
                    ? "Keyword fallback ready"
                    : "Not ready"}
              </span>
            </div>
            <div className="timeline-item">
              <strong>Curriculum</strong>
              <span>{curriculumStatus.message}</span>
            </div>
            <div className="timeline-item">
              <strong>PDF page filter</strong>
              <span>
                {curriculumStatus.totalSourcePages} source pages scanned;{" "}
                {curriculumStatus.instructionalPagesIncluded} instructional pages included;{" "}
                {curriculumStatus.nonInstructionalPagesExcluded} non-instructional pages excluded.
              </span>
            </div>
            <div className="timeline-item">
              <strong>Chat</strong>
              <span>{chatReady ? "Ready for PDF-grounded tutor answers" : "Needs OpenAI key and chunks"}</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="detail-grid section-offset">
        <EmbeddingBackfillPanel
          defaultLimit={backfillDefaultLimit}
          initialStatus={embeddingStatus}
          maxLimit={backfillMaxLimit}
        />
        <aside className="placeholder-panel">
          <span className="badge gold">API credits</span>
          <h2>Backfill in batches</h2>
          <p>
            Use the batch button until missing embeddings reach zero. The chat route
            keeps working with keyword retrieval while embeddings are incomplete.
            Full-library embedding should only be run intentionally in batches.
          </p>
          <div className="stack">
            <span className="code-pill">GET /api/sources/embeddings/status</span>
            <span className="code-pill">POST /api/sources/embeddings/backfill</span>
          </div>
        </aside>
      </section>

      <section className="detail-grid section-offset" aria-label="Curriculum settings">
        <CurriculumStatusPanel sections={sections} />
        <aside className="placeholder-panel">
          <span className="badge teal">Curriculum filtering</span>
          <h2>Local-first curriculum state</h2>
          <p>
            Daily lesson completion, review completion, and placeholder assessment attempts
            are stored in browser localStorage for this MVP. Generated curriculum shells are
            stored in SQLite after a deterministic page filter removes front matter, tables of
            contents, licenses, answer keys, appendices, indexes, and glossaries. Full daily
            lesson content is still generated on demand only after source retrieval.
          </p>
          <div className="stack">
            <span className="code-pill">localStorage curriculum progress</span>
            <span className="code-pill">{curriculumStatus.curriculumMode}</span>
            <span className="code-pill">{curriculumStatus.lastGenerationMode ?? "unfiltered"}</span>
            <span className="code-pill">{curriculumStatus.generatedLessonCount} generated lesson shells</span>
            <span className="code-pill">{curriculumStatus.instructionalPagesIncluded} instructional pages included</span>
            <span className="code-pill">{curriculumStatus.nonInstructionalPagesExcluded} non-instructional pages excluded</span>
            <span className="code-pill">PDF-only lesson content</span>
            {classificationRows.map(([classification, bucket]) => (
              <span className="code-pill" key={classification}>
                {formatClassificationLabel(classification)}: {bucket.included}/{bucket.total} included
              </span>
            ))}
            {curriculumStatus.filteringWarnings.slice(0, 3).map((warning) => (
              <span className="code-pill" key={warning}>{warning}</span>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

function formatClassificationLabel(value: string) {
  return value.replace(/_/g, " ");
}
