import { NextResponse } from "next/server";
import { getWeeklyAssessment } from "@/lib/curriculum";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AssessmentGradeRequest = {
  weekNumber?: unknown;
  placeholderResult?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AssessmentGradeRequest;
  const weekNumber = normalizeWeekNumber(body.weekNumber);
  const placeholderResult = normalizePlaceholderResult(body.placeholderResult);

  if (!weekNumber) {
    return NextResponse.json({ error: "A valid weekNumber is required." }, { status: 400 });
  }

  const assessment = getWeeklyAssessment(weekNumber);

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  if (!placeholderResult) {
    return NextResponse.json(
      { error: "placeholderResult must be either pass or fail for this local MVP flow." },
      { status: 400 }
    );
  }

  const passed = placeholderResult === "pass";

  // Future implementation note: grading must be done by a PDF-grounded assessor that cites
  // source file/page references. This placeholder does not call OpenAI, does not inspect
  // outside Spanish knowledge, and exists only to test local progression locking.
  return NextResponse.json({
    weekNumber,
    message: passed
      ? "Placeholder pass recorded locally. The next week can unlock in browser progress."
      : "Placeholder fail recorded locally. Review remains available before another attempt.",
    warning:
      "This is not real assessment grading. Future grading must use only uploaded PDFs and cite file/page references.",
    sourceReferences: assessment.sourceReferences,
    unsupportedBySources: assessment.sourceReferences.length === 0,
    score: passed ? assessment.passingThreshold : Math.max(0, assessment.passingThreshold - 20),
    passed,
    progressionUnlockAllowed: passed,
    strengths: passed
      ? ["Placeholder pass state for local progression testing."]
      : ["Placeholder attempt recorded without unlocking the next week."],
    needsReview: passed
      ? []
      : ["Review the week shell and wait for PDF-grounded assessment content before real grading."]
  });
}

function normalizeWeekNumber(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function normalizePlaceholderResult(value: unknown) {
  return value === "pass" || value === "fail" ? value : null;
}
