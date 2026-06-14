import { NextResponse } from "next/server";
import { generateDailyLesson } from "@/lib/agent/daily-lesson-generator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LessonApiRouteProps = {
  params: Promise<{
    dayNumber: string;
  }>;
};

export async function GET(_request: Request, { params }: LessonApiRouteProps) {
  const { dayNumber: rawDayNumber } = await params;
  const dayNumber = normalizeDayNumber(rawDayNumber);

  if (!dayNumber) {
    return NextResponse.json({ error: "A valid dayNumber is required." }, { status: 400 });
  }

  const result = await generateDailyLesson(dayNumber);

  if (!result.lesson) {
    return NextResponse.json({ error: "Daily lesson not found." }, { status: 404 });
  }

  return NextResponse.json({
    lesson: result.lesson,
    generatedLesson: result.generatedLesson,
    lessonContent: result.generatedLesson
  });
}

function normalizeDayNumber(value: string) {
  const dayNumber = Number(value);

  return Number.isInteger(dayNumber) && dayNumber > 0 ? dayNumber : null;
}
