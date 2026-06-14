"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
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
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);

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
      setHasSearched(false);
      setSearchMessage("Enter a search term.");
      return;
    }

    setIsSearching(true);
    setSearchMessage("");

    try {
      const response = await fetch(`/api/sources/search?q=${encodeURIComponent(query)}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as { results: SourceSearchResult[] };
      setSearchResults(payload.results ?? []);
      setHasSearched(true);
      setSearchMessage("");
    } catch (error) {
      setSearchResults([]);
      setHasSearched(true);
      setSearchMessage(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="library-workspace">
      <section className="source-toolbar" aria-label="Source library tools">
        <form className="tool-panel" onSubmit={handleUpload}>
          <h2>Upload</h2>
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept="application/pdf,.pdf"
            multiple
          />
          <button className="primary-button" disabled={isUploading} type="submit">
            {isUploading ? "Uploading..." : "Upload PDFs"}
          </button>
          {uploadMessage ? <p className="form-message">{uploadMessage}</p> : null}
        </form>

        <form className="tool-panel" onSubmit={handleSearch}>
          <h2>Search</h2>
          <div className="search-row">
            <input
              className="text-input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search PDFs"
              type="search"
              value={query}
            />
            <button className="secondary-button" disabled={isSearching} type="submit">
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>
          {searchMessage ? <p className="form-message">{searchMessage}</p> : null}
          {hasSearched ? (
            <div className="inline-search-results">
              <span className="result-count">{searchResults.length} results</span>
              {searchResults.length === 0 ? (
                <div className="empty-state compact-empty-state">
                  <strong>No results found</strong>
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
            </div>
          ) : null}
        </form>
      </section>

      <section className="source-section" aria-label="Imported source documents">
        <div className="section-heading-row">
          <div>
            <h2>Sources</h2>
          </div>
          <button className="ghost-button" onClick={refreshDocuments} type="button">
            Refresh
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="empty-state">
            <strong>No PDFs uploaded yet</strong>
          </div>
        ) : (
          <div className="source-list">
            {documents.map((document) => (
              <Link className="source-card" href={`/library/${document.id}`} key={document.id}>
                <div>
                  <span className="badge teal">{document.processingStatus}</span>
                  <h3>{document.originalFileName}</h3>
                  {document.processingError ? <p>{document.processingError}</p> : null}
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
    </div>
  );
}
