import { NextResponse } from "next/server";
import { getSourceDocument, listSourcePages } from "@/lib/sources";

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

    return NextResponse.json({
      source,
      pages: await listSourcePages(id)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load source pages."
      },
      { status: 500 }
    );
  }
}
