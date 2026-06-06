import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await request.json().catch(() => null);

  /*
   * Future implementation note:
   * The SpanishAIAgent chat route must retrieve from uploaded PDF pages before
   * answering. It must answer only when the PDFs support the response and must
   * cite source file names and page numbers for lessons, explanations, examples,
   * corrections, and practice feedback.
   */
  return NextResponse.json(
    {
      implemented: false,
      message:
        "SpanishAIAgent chat is not implemented yet. Future responses will be grounded only in uploaded PDF sources and will cite file/page references.",
      citations: []
    },
    { status: 501 }
  );
}
