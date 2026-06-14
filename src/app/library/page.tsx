import { SourceLibrary } from "@/components/source-library";
import { listSourceDocuments } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const documents = await listSourceDocuments().catch(() => []);

  return (
    <div className="page">
      <SourceLibrary initialDocuments={documents} />
    </div>
  );
}
