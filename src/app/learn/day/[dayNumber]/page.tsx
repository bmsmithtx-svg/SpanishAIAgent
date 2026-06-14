import { notFound } from "next/navigation";
import { DailyLessonView } from "@/components/daily-lesson-view";
import { PageHeader } from "@/components/page-header";
import { generateDailyLesson } from "@/lib/agent/daily-lesson-generator";
import {
  generatedLessonShellToDailyLesson,
  getAllDailyLessons,
  listGeneratedCurriculumLessons
} from "@/lib/curriculum";

export const dynamic = "force-dynamic";

type LessonPageProps = {
  params: Promise<{
    dayNumber: string;
  }>;
};

export default async function LessonPage({ params }: LessonPageProps) {
  const { dayNumber: rawDayNumber } = await params;
  const dayNumber = Number(rawDayNumber);

  if (!Number.isInteger(dayNumber) || dayNumber < 1) {
    notFound();
  }

  const { generatedLesson, lesson } = await generateDailyLesson(dayNumber);

  if (!lesson) {
    notFound();
  }

  const generatedShells = await listGeneratedCurriculumLessons();
  const lessons = generatedShells.length > 0
    ? generatedShells.map(generatedLessonShellToDailyLesson)
    : getAllDailyLessons();
  const previousLesson = lessons.find((candidate) => candidate.dayNumber === dayNumber - 1) ?? null;
  const nextLesson = lessons.find((candidate) => candidate.dayNumber === dayNumber + 1) ?? null;

  return (
    <div className="page">
      <PageHeader
        eyebrow={`Day ${lesson.dayNumber}`}
        title={lesson.title}
        description="This daily lesson follows the 20-minute grammar-first format. Real Spanish examples, explanations, vocabulary, and practice are shown only when retrieved PDF chunks support the content with file/page citations."
        badges={[
          { label: `Week ${lesson.weekNumber}`, tone: "teal" },
          { label: "20 minutes", tone: "gold" },
          { label: generatedLesson.sourceGrounded ? "PDF-grounded" : "Source warning", tone: generatedLesson.sourceGrounded ? "green" : "rose" }
        ]}
      />

      <DailyLessonView
        lesson={lesson}
        generatedLesson={generatedLesson}
        nextLesson={nextLesson}
        previousLesson={previousLesson}
      />
    </div>
  );
}
