import { NextResponse } from "next/server";
import { generatePdfDerivedCurriculum } from "@/lib/curriculum";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GenerateBody = {
  dryRun?: unknown;
};

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const result = await generatePdfDerivedCurriculum({
    dryRun: Boolean(body.dryRun)
  });

  return NextResponse.json({
    ...result,
    warning:
      "Curriculum generation creates lesson shells only. It does not call OpenAI, does not generate full lesson content, and does not copy raw PDF text."
  });
}

async function readJsonBody(request: Request): Promise<GenerateBody> {
  try {
    return (await request.json()) as GenerateBody;
  } catch {
    return {};
  }
}
