import { PlaceholderPage } from "@/components/placeholder-page";

export default function LibraryPage() {
  return (
    <PlaceholderPage
      eyebrow="Source library"
      title="PDF source library"
      description="This page will manage uploaded Spanish PDFs, page extraction, indexing status, and citation coverage."
      primaryTitle="Source records will live here"
      primaryCopy="Future ingestion will convert uploaded PDFs into document and page records that the lesson engine and tutor can retrieve safely."
      secondaryTitle="Library pipeline"
      steps={[
        {
          title: "Upload PDFs",
          copy: "Add source files without turning them into lessons until parsing is complete."
        },
        {
          title: "Extract pages",
          copy: "Track file names, page numbers, optional sections, and source snippets."
        },
        {
          title: "Index for retrieval",
          copy: "Make cited source pages available to lessons, practice, and tutor responses."
        }
      ]}
    />
  );
}
