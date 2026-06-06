import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getSourceDocument, listSourcePages } from "@/lib/sources";

export const dynamic = "force-dynamic";

type SourceDocumentPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SourceDocumentPage({ params }: SourceDocumentPageProps) {
  const { id } = await params;
  const [document, pages] = await Promise.all([getSourceDocument(id), listSourcePages(id)]);

  if (!document) {
    notFound();
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Source detail"
        title={document.originalFileName}
        description="Inspect extracted page text and citation labels. The future tutor must cite these page records when it uses this source."
        badges={[
          { label: document.processingStatus, tone: document.processingStatus === "completed" ? "green" : "gold" },
          { label: document.extractionMethod, tone: "teal" }
        ]}
      />

      <section className="detail-grid">
        <article className="placeholder-panel">
          <span className="badge teal">Document metadata</span>
          <dl className="source-meta-grid detail-meta">
            <div>
              <dt>Stored file</dt>
              <dd>{document.fileName}</dd>
            </div>
            <div>
              <dt>Page count</dt>
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
              <dt>Created</dt>
              <dd>{new Date(document.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
          {document.processingError ? <p className="form-message">{document.processingError}</p> : null}
          <Link className="secondary-button inline-action" href="/library">
            Back to library
          </Link>
        </article>

        <aside className="placeholder-panel">
          <span className="badge gold">Citation format</span>
          <h2>File name, page X</h2>
          <p>
            Each extracted page below includes the citation label that future lessons,
            practice, and tutor answers must display when using that page.
          </p>
        </aside>
      </section>

      <section className="source-section" aria-label="Extracted pages">
        <div className="section-heading-row">
          <div>
            <span className="badge green">Extracted pages</span>
            <h2>Page records</h2>
          </div>
          <span className="result-count">{pages.length} pages</span>
        </div>

        {pages.length === 0 ? (
          <div className="empty-state">
            <strong>No extracted pages found</strong>
            <span>This document has no page records yet.</span>
          </div>
        ) : (
          <div className="page-record-list">
            {pages.map((page) => (
              <article className="page-record" id={`page-${page.pageNumber}`} key={page.id}>
                <div className="page-record-header">
                  <div>
                    <span className="badge teal">{page.citationLabel}</span>
                    <h3>Page {page.pageNumber}</h3>
                  </div>
                  <dl className="compact-meta">
                    <div>
                      <dt>Characters</dt>
                      <dd>{page.characterCount}</dd>
                    </div>
                    <div>
                      <dt>Chunks</dt>
                      <dd>{page.chunkCount}</dd>
                    </div>
                    <div>
                      <dt>Extraction</dt>
                      <dd>{page.extractionMethod}</dd>
                    </div>
                  </dl>
                </div>
                <p className="page-preview">
                  {page.text.length > 0
                    ? page.text.slice(0, 900)
                    : "No extractable text was found on this page."}
                  {page.text.length > 900 ? "..." : ""}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
