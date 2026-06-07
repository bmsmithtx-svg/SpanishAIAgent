import { NextResponse } from "next/server";
import { backfillChunkEmbeddings } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BackfillRequest = {
  limit?: unknown;
  batchSize?: unknown;
  dryRun?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as BackfillRequest;

  try {
    const result = await backfillChunkEmbeddings({
      limit: normalizeNumber(body.limit),
      batchSize: normalizeNumber(body.batchSize),
      dryRun: body.dryRun === true
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Embedding backfill failed."
      },
      { status: 500 }
    );
  }
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
