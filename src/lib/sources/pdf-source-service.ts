import type { SpanishSourceDocument, SpanishSourcePage } from "@/types";

export async function listSpanishSourceDocuments(): Promise<SpanishSourceDocument[]> {
  // Future work: read uploaded PDF metadata from storage or a database.
  return [];
}

export async function retrieveSourcePagesForQuery(
  _query: string
): Promise<SpanishSourcePage[]> {
  void _query;

  /*
   * Future work: retrieve only from uploaded Spanish PDF pages. Downstream
   * lessons, practice items, and agent responses must cite these page records.
   */
  return [];
}
