import { NextResponse } from "next/server";
import { getEmbeddingStatus } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getEmbeddingStatus());
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load embedding status."
      },
      { status: 500 }
    );
  }
}
