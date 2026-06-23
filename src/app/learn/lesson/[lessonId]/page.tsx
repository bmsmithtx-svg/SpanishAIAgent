import { notFound } from "next/navigation";
import { DailyLessonView } from "@/components/daily-lesson-view";
import { PageHeader } from "@/components/page-header";
import { generateDailyLessonByLessonId } from "@/lib/agent/daily-lesson-generator";
import {
  generatedLessonShellToDailyLesson,
  getGeneratedCurriculumLesson,
  listGeneratedCurriculumLessons
} from "@/lib/curriculum/generated-curriculum-read";

export const dynamic = "force-dynamic";

type LessonIdPageProps = {
  params: Promise<{
    lessonId: string;
  }>;
};

export default async function LessonIdPage({ params }: LessonIdPageProps) {
  const { lessonId: rawLessonId } = await params;
  const lessonId = decodeURIComponent(rawLessonId);
  const shell = await getGeneratedCurriculumLesson(lessonId);

  if (!shell) {
    notFound();
  }

  const { generatedLesson, lesson } = await generateDailyLessonByLessonId(lessonId);

  if (!lesson) {
    notFound();
  }

  const lessons = (await listGeneratedCurriculumLessons()).map(generatedLessonShellToDailyLesson);
  const previousLesson = lessons.find((candidate) => candidate.dayNumber === lesson.dayNumber - 1) ?? null;
  const nextLesson = lessons.find((candidate) => candidate.dayNumber === lesson.dayNumber + 1) ?? null;

  return (
    <div className="page">
      <PageHeader
        eyebrow={`Lesson ${shell.lessonId}`}
        title={lesson.title}
        description="This generated lesson shell points to uploaded PDF page references. Full Spanish teaching content is generated only on demand after retrieval confirms source support."
        badges={[
          { label: `Day ${lesson.dayNumber}`, tone: "teal" },
          { label: `Week ${lesson.weekNumber}`, tone: "gold" },
          { label: generatedLesson.sourceGrounded ? "PDF-grounded" : "Source warning", tone: generatedLesson.sourceGrounded ? "green" : "rose" }
        ]}
      />

      <DailyLessonView
        generatedLesson={generatedLesson}
        lesson={lesson}
        nextLesson={nextLesson}
        previousLesson={previousLesson}
      />
    </div>
  );
}
