import { PageHeader } from "@/components/page-header";
import { SourceLibrary } from "@/components/source-library";
import { listSourceDocuments } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const documents = await listSourceDocuments().catch(() => []);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Source library"
        title="PDF source library"
        description="Upload local Spanish PDFs, extract text page by page, inspect source coverage, and search chunks for future retrieval-grounded tutor work."
        badges={[
          { label: "Raw PDFs stay local", tone: "rose" },
          { label: "SQLite source index", tone: "teal" }
        ]}
      />
      <SourceLibrary initialDocuments={documents} />
    </div>
  );
}
