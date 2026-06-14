import { NextResponse } from "next/server";
import { getGeneratedCurriculumLesson } from "@/lib/curriculum";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LessonRouteProps = {
  params: Promise<{
    lessonId: string;
  }>;
};

export async function GET(_request: Request, { params }: LessonRouteProps) {
  const { lessonId } = await params;
  const lesson = await getGeneratedCurriculumLesson(decodeURIComponent(lessonId));

  if (!lesson) {
    return NextResponse.json({ error: "Generated curriculum lesson not found." }, { status: 404 });
  }

  return NextResponse.json({ lesson });
}
