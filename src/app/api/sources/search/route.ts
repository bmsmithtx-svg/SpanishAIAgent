import { NextResponse } from "next/server";
import { searchSourceChunks } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  if (!query.trim()) {
    return NextResponse.json({
      query,
      results: []
    });
  }

  try {
    return NextResponse.json({
      query,
      results: await searchSourceChunks(query)
    });
  } catch (error) {
    return NextResponse.json(
      {
        query,
        results: [],
        error: error instanceof Error ? error.message : "Unable to search source chunks."
      },
      { status: 500 }
    );
  }
}
