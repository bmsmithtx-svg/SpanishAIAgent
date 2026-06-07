"use client";

import { useState } from "react";
import type { EmbeddingBackfillResult, EmbeddingStatus } from "@/lib/sources";

type EmbeddingBackfillPanelProps = {
  initialStatus: EmbeddingStatus;
};

export function EmbeddingBackfillPanel({ initialStatus }: EmbeddingBackfillPanelProps) {
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  async function runBackfill() {
    setIsRunning(true);
    setMessage("Embedding the next batch of chunks...");

    try {
      const response = await fetch("/api/sources/embeddings/backfill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          limit: 25,
          batchSize: 8
        })
      });
      const payload = (await response.json()) as EmbeddingBackfillResult & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Embedding backfill failed.");
      }

      setStatus(payload);
      setMessage(
        `Attempted ${payload.attemptedCount} chunks. Embedded ${payload.successfulCount}; failed ${payload.failedCount}; ${payload.remainingCount ?? payload.missingEmbeddings} remaining.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Embedding backfill failed.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <article className="placeholder-panel">
      <span className="badge teal">Semantic retrieval</span>
      <h2>Embedding status</h2>
      <p>
        Embeddings improve retrieval when your wording does not exactly match the PDF
        text. Backfilling uses OpenAI API credits.
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
          <dt>Model</dt>
          <dd>{status.embeddingModel}</dd>
        </div>
        <div>
          <dt>Dimensions</dt>
          <dd>{status.embeddingDimensions}</dd>
        </div>
      </dl>

      <button
        className="primary-button inline-action"
        disabled={isRunning || status.missingEmbeddings === 0}
        onClick={runBackfill}
        type="button"
      >
        {isRunning ? "Backfilling..." : "Backfill Next Batch"}
      </button>
      {message ? <p className="form-message">{message}</p> : null}
    </article>
  );
}
