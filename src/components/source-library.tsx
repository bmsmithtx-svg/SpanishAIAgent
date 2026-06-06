"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import type { SourceDocumentListItem, SourceSearchResult } from "@/lib/sources";

type SourceLibraryProps = {
  initialDocuments: SourceDocumentListItem[];
};

type UploadResponse = {
  message: string;
  uploadedCount: number;
  duplicateCount: number;
  failedCount: number;
  results: Array<{
    duplicate: boolean;
    message: string;
    document: SourceDocumentListItem | null;
    error?: string;
  }>;
};

export function SourceLibrary({ initialDocuments }: SourceLibraryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploadMessage, setUploadMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SourceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const completedCount = useMemo(
    () => documents.filter((document) => document.processingStatus === "completed").length,
    [documents]
  );

  async function refreshDocuments() {
    const response = await fetch("/api/sources", {
      cache: "no-store"
    });
    const payload = (await response.json()) as { sources: SourceDocumentListItem[] };
    setDocuments(payload.sources ?? []);
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const files = fileInputRef.current?.files;

    if (!files || files.length === 0) {
      setUploadMessage("Choose at least one PDF before uploading.");
      return;
    }

    const formData = new FormData();

    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    setIsUploading(true);
    setUploadMessage("Uploading and extracting PDFs...");

    try {
      const response = await fetch("/api/sources/upload", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as UploadResponse;

      setUploadMessage(
        `${payload.message} Imported: ${payload.uploadedCount ?? 0}. Duplicates: ${
          payload.duplicateCount ?? 0
        }. Failed: ${payload.failedCount ?? 0}.`
      );
      await refreshDocuments();

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(`/api/sources/search?q=${encodeURIComponent(query)}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as { results: SourceSearchResult[] };
      setSearchResults(payload.results ?? []);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="library-workspace">
      <section className="source-toolbar" aria-label="Source library tools">
        <form className="tool-panel" onSubmit={handleUpload}>
          <div>
            <span className="badge teal">Upload PDFs</span>
            <h2>Add source documents</h2>
            <p>
              Raw PDFs are saved locally under <span className="inline-code">local-sources/pdfs</span>
              and ignored by git. Extraction records are stored in SQLite for development.
            </p>
          </div>
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept="application/pdf,.pdf"
            multiple
          />
          <button className="primary-button" disabled={isUploading} type="submit">
            {isUploading ? "Extracting..." : "Upload and Extract"}
          </button>
          {uploadMessage ? <p className="form-message">{uploadMessage}</p> : null}
        </form>

        <form className="tool-panel" onSubmit={handleSearch}>
          <div>
            <span className="badge gold">Keyword search</span>
            <h2>Search extracted chunks</h2>
            <p>
              Search runs only across extracted PDF chunks. It does not use embeddings or
              AI-generated Spanish content.
            </p>
          </div>
          <div className="search-row">
            <input
              className="text-input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search imported PDF text"
              type="search"
              value={query}
            />
            <button className="secondary-button" disabled={isSearching} type="submit">
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>
        </form>
      </section>

      <section className="source-summary-grid" aria-label="Source library summary">
        <div className="summary-tile">
          <span>Uploaded PDFs</span>
          <strong>{documents.length}</strong>
        </div>
        <div className="summary-tile">
          <span>Completed</span>
          <strong>{completedCount}</strong>
        </div>
        <div className="summary-tile">
          <span>Pages</span>
          <strong>{documents.reduce((total, document) => total + document.pageRecordCount, 0)}</strong>
        </div>
        <div className="summary-tile">
          <span>Chunks</span>
          <strong>{documents.reduce((total, document) => total + document.chunkCount, 0)}</strong>
        </div>
      </section>

      <section className="source-section" aria-label="Imported source documents">
        <div className="section-heading-row">
          <div>
            <span className="badge green">Imported sources</span>
            <h2>PDF source documents</h2>
          </div>
          <button className="ghost-button" onClick={refreshDocuments} type="button">
            Refresh
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="empty-state">
            <strong>No PDFs imported yet</strong>
            <span>Upload a source PDF to create document, page, and chunk records.</span>
          </div>
        ) : (
          <div className="source-list">
            {documents.map((document) => (
              <Link className="source-card" href={`/library/${document.id}`} key={document.id}>
                <div>
                  <span className="badge teal">{document.processingStatus}</span>
                  <h3>{document.originalFileName}</h3>
                  <p>{document.processingError ?? "Extracted text is available for inspection."}</p>
                </div>
                <dl className="source-meta-grid">
                  <div>
                    <dt>Pages</dt>
                    <dd>{document.pageCount}</dd>
                  </div>
                  <div>
                    <dt>Page records</dt>
                    <dd>{document.pageRecordCount}</dd>
                  </div>
                  <div>
                    <dt>Chunks</dt>
                    <dd>{document.chunkCount}</dd>
                  </div>
                  <div>
                    <dt>Extraction</dt>
                    <dd>{document.extractionMethod}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{new Date(document.createdAt).toLocaleDateString()}</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="source-section" aria-label="Search results">
        <div className="section-heading-row">
          <div>
            <span className="badge rose">Search results</span>
            <h2>Matching source chunks</h2>
          </div>
          <span className="result-count">{searchResults.length} results</span>
        </div>

        {searchResults.length === 0 ? (
          <div className="empty-state">
            <strong>No matches shown</strong>
            <span>Run a keyword search after importing PDFs.</span>
          </div>
        ) : (
          <div className="result-list">
            {searchResults.map((result) => (
              <Link
                className="result-card"
                href={`/library/${result.documentId}#page-${result.pageNumber}`}
                key={result.chunkId}
              >
                <span className="badge gold">{result.citationLabel}</span>
                <p>{result.preview}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
