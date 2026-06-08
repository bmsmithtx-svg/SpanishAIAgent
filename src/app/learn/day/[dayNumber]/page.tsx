import { notFound } from "next/navigation";
import { DailyLessonView } from "@/components/daily-lesson-view";
import { PageHeader } from "@/components/page-header";
import {
  getAllDailyLessons,
  getDailyLessonByDayNumber,
  getLessonSourceContext
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

  const lesson = getDailyLessonByDayNumber(dayNumber);

  if (!lesson) {
    notFound();
  }

  const lessons = getAllDailyLessons();
  const previousLesson = lessons.find((candidate) => candidate.dayNumber === dayNumber - 1) ?? null;
  const nextLesson = lessons.find((candidate) => candidate.dayNumber === dayNumber + 1) ?? null;
  const sourceContext = await getLessonSourceContext(lesson);

  return (
    <div className="page">
      <PageHeader
        eyebrow={`Day ${lesson.dayNumber}`}
        title={lesson.title}
        description="This daily lesson shell follows the 20-minute grammar-first format. Spanish examples, explanations, vocabulary, and practice remain placeholders until uploaded PDFs support the exact content with file/page citations."
        badges={[
          { label: `Week ${lesson.weekNumber}`, tone: "teal" },
          { label: "20 minutes", tone: "gold" },
          { label: "Source-gated", tone: "rose" }
        ]}
      />

      <DailyLessonView
        lesson={lesson}
        nextLesson={nextLesson}
        previousLesson={previousLesson}
        sourceContext={sourceContext}
      />
    </div>
  );
}
