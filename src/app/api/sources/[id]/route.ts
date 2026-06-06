import { NextResponse } from "next/server";
import { getSourceDocument } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const { id } = await context.params;

  try {
    const source = await getSourceDocument(id);

    if (!source) {
      return NextResponse.json({ error: "Source document not found." }, { status: 404 });
    }

    return NextResponse.json({ source });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load source document."
      },
      { status: 500 }
    );
  }
}
