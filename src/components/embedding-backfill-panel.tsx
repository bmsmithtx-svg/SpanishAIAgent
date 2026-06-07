"use client";

import { useState } from "react";
import type {
  EmbeddingBackfillResult,
  EmbeddingBackfillSampleChunk,
  EmbeddingStatus
} from "@/lib/sources";

type EmbeddingBackfillPanelProps = {
  defaultLimit: number;
  initialStatus: EmbeddingStatus;
  maxLimit: number;
};

type BackfillAction = "dryRun" | "backfill";

export function EmbeddingBackfillPanel({
  defaultLimit,
  initialStatus,
  maxLimit
}: EmbeddingBackfillPanelProps) {
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState("");
  const [activeAction, setActiveAction] = useState<BackfillAction | null>(null);
  const [sampleChunks, setSampleChunks] = useState<EmbeddingBackfillSampleChunk[]>([]);
  const isRunning = activeAction !== null;

  async function runBackfill(dryRun: boolean) {
    const action: BackfillAction = dryRun ? "dryRun" : "backfill";
    setActiveAction(action);
    setMessage(
      dryRun
        ? `Previewing the next ${defaultLimit} chunks without calling OpenAI...`
        : `Embedding a test batch of ${defaultLimit} chunks...`
    );

    try {
      const response = await fetch("/api/sources/embeddings/backfill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          limit: defaultLimit,
          batchSize: Math.min(defaultLimit, 8),
          dryRun
        })
      });
      const payload = (await response.json()) as EmbeddingBackfillResult & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Embedding backfill failed.");
      }

      setStatus(payload);
      setSampleChunks(payload.sampleChunks ?? []);
      setMessage(
        dryRun
          ? `Dry run found ${payload.wouldEmbedCount} chunks for the next batch. No OpenAI call was made and the database was not changed. ${payload.remainingCount} chunks remain.`
          : `Attempted ${payload.attemptedCount} chunks. Embedded ${payload.successfulCount}; failed ${payload.failedCount}; ${payload.remainingCount} remaining. ${payload.warningMessage}`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Embedding backfill failed.");
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <article className="placeholder-panel">
      <span className="badge teal">Local semantic scoring</span>
      <h2>Embedding status</h2>
      <p>
        Embeddings improve retrieval when your wording does not exactly match the PDF
        text. Backfilling uses OpenAI API credits. Full-library embedding should only
        be run intentionally in batches.
      </p>

      <dl className="source-meta-grid detail-meta">
        <div>
          <dt>Total chunks</dt>
          <dd>{status.totalChunks}</dd>
        </div>
        <div>
          <dt>Embedded</dt>
          <dd>{status.embeddedChunks}</dd>
        </div>
        <div>
          <dt>Missing</dt>
          <dd>{status.missingEmbeddings}</dd>
        </div>
        <div>
          <dt>Failed</dt>
          <dd>{status.failedEmbeddings}</dd>
        </div>
        <div>
          <dt>Default batch</dt>
          <dd>{defaultLimit}</dd>
        </div>
        <div>
          <dt>Hard max</dt>
          <dd>{maxLimit}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{status.embeddingModel}</dd>
        </div>
        <div>
          <dt>Dimensions</dt>
          <dd>{status.embeddingDimensions}</dd>
        </div>
      </dl>

      <div className="action-row">
        <button
          className="ghost-button inline-action"
          disabled={isRunning || status.missingEmbeddings === 0}
          onClick={() => runBackfill(true)}
          type="button"
        >
          {activeAction === "dryRun" ? "Previewing..." : `Preview ${defaultLimit}-Chunk Batch`}
        </button>
        <button
          className="primary-button inline-action"
          disabled={isRunning || status.missingEmbeddings === 0}
          onClick={() => runBackfill(false)}
          type="button"
        >
          {activeAction === "backfill" ? "Backfilling..." : `Embed Test Batch (${defaultLimit})`}
        </button>
      </div>

      {message ? <p className="form-message">{message}</p> : null}

      {sampleChunks.length > 0 ? (
        <div className="sample-list" aria-label="Dry run sample chunks">
          {sampleChunks.map((chunk) => (
            <span className="code-pill" key={chunk.chunkId}>
              {chunk.citationLabel} / chunk {chunk.chunkIndex}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
