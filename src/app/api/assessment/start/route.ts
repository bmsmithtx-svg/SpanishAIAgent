import { NextResponse } from "next/server";
import { getWeeklyAssessment } from "@/lib/curriculum/curriculum-map";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AssessmentStartRequest = {
  weekNumber?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AssessmentStartRequest;
  const weekNumber = normalizeWeekNumber(body.weekNumber);

  if (!weekNumber) {
    return NextResponse.json({ error: "A valid weekNumber is required." }, { status: 400 });
  }

  const assessment = getWeeklyAssessment(weekNumber);

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  // Future implementation note: the assessor must retrieve uploaded PDF context first,
  // answer only from that context, and cite source file/page references for every prompt,
  // correction, explanation, and grade rationale. This placeholder does not call OpenAI.
  return NextResponse.json({
    weekNumber,
    message: "Assessment placeholder started.",
    warning:
      "No OpenAI grading is connected yet. Future assessment prompts must come only from uploaded PDFs and cite file/page references.",
    sourceReferences: assessment.sourceReferences,
    unsupportedBySources: assessment.sourceReferences.length === 0,
    progressionUnlockAllowed: false,
    messages: [
      {
        id: `week-${weekNumber}-assessment-start`,
        role: "system",
        content:
          "Placeholder assessment started. Real prompts will appear only after PDF source context supports this week's mastery requirements.",
        createdAt: new Date().toISOString()
      }
    ]
  });
}

function normalizeWeekNumber(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}
