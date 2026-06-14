import { NextResponse } from "next/server";
import { listGeneratedCurriculumLessons } from "@/lib/curriculum";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const lessons = await listGeneratedCurriculumLessons();

  return NextResponse.json({
    count: lessons.length,
    lessons
  });
}
