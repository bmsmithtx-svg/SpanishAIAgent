import { NextResponse } from "next/server";
import { getWeeklyAssessment } from "@/lib/curriculum";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AssessmentMessageRequest = {
  weekNumber?: unknown;
  messages?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AssessmentMessageRequest;
  const weekNumber = normalizeWeekNumber(body.weekNumber);

  if (!weekNumber) {
    return NextResponse.json({ error: "A valid weekNumber is required." }, { status: 400 });
  }

  const assessment = getWeeklyAssessment(weekNumber);

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  // Future implementation note: this route should call the OpenAI-powered assessor only
  // after retrieving uploaded PDF context. It must not invent Spanish prompts or feedback,
  // and every educational claim must cite source file/page references.
  return NextResponse.json({
    weekNumber,
    message: "Assessment placeholder response recorded.",
    warning:
      "The assessor is not implemented yet. No OpenAI request was made and no PDF-grounded feedback was generated.",
    sourceReferences: assessment.sourceReferences,
    unsupportedBySources: assessment.sourceReferences.length === 0,
    progressionUnlockAllowed: false,
    assessorMessage: {
      id: `week-${weekNumber}-assessment-placeholder-${Date.now()}`,
      role: "assessor",
      content:
        "Placeholder response recorded. Future feedback will be generated only from uploaded PDF source context with file/page citations.",
      createdAt: new Date().toISOString()
    }
  });
}

function normalizeWeekNumber(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}
