import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await request.json().catch(() => null);

  /*
   * Future implementation note:
   * The SpanishAIAgent chat route is not active yet. The next step is
   * retrieval-grounded AI chat that searches SpanishSourceChunk records before
   * answering. Future chat must answer only from retrieved PDF chunks and cite
   * source file names and page numbers for lessons, explanations, examples,
   * corrections, and practice feedback.
   */
  return NextResponse.json(
    {
      implemented: false,
      message:
        "SpanishAIAgent chat is not active yet. Next step: retrieval-grounded AI chat over SpanishSourceChunk records, with required PDF file/page citations.",
      citations: []
    },
    { status: 501 }
  );
}
