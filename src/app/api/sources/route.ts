import { NextResponse } from "next/server";
import { listSourceDocuments } from "@/lib/sources/source-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({
      sources: await listSourceDocuments()
    });
  } catch (error) {
    return NextResponse.json(
      {
        sources: [],
        error: error instanceof Error ? error.message : "Unable to list source documents."
      },
      { status: 500 }
    );
  }
}
