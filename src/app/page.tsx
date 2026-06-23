import { LearnerDashboard } from "@/components/learner-dashboard";
import {
  generatedCurriculumToSections,
  getActiveGeneratedCurriculum
} from "@/lib/curriculum/generated-curriculum-read";
import {
  getCurriculumSections,
  getCurriculumSummary
} from "@/lib/curriculum/curriculum-map";
import type { CurriculumSection } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const generatedCurriculum = await getActiveGeneratedCurriculum();
  const sections = generatedCurriculum
    ? generatedCurriculumToSections(generatedCurriculum)
    : getCurriculumSections();
  const totalWeeks = generatedCurriculum?.weekCount ?? getCurriculumSummary().weekCount;

  return (
    <div className="page learner-dashboard-page">
      <LearnerDashboard
        totalWeeks={totalWeeks}
        usesGeneratedCurriculum={Boolean(generatedCurriculum)}
        weeks={buildDashboardWeeks(sections)}
      />
    </div>
  );
}

function buildDashboardWeeks(sections: CurriculumSection[]) {
  const byWeek = new Map<number, {
    weekNumber: number;
    lessons: {
      id: string;
      dayNumber: number;
      dayInWeek: number;
      weekNumber: number;
    }[];
  }>();

  for (const week of sections.flatMap((section) => section.weeks)) {
    const existing = byWeek.get(week.weekNumber) ?? {
      weekNumber: week.weekNumber,
      lessons: []
    };
    const lessonByDay = new Map(existing.lessons.map((lesson) => [lesson.dayNumber, lesson]));

    for (const lesson of week.lessons) {
      lessonByDay.set(lesson.dayNumber, {
        id: lesson.id,
        dayNumber: lesson.dayNumber,
        dayInWeek: lesson.dayInWeek,
        weekNumber: lesson.weekNumber
      });
    }

    byWeek.set(week.weekNumber, {
      weekNumber: week.weekNumber,
      lessons: Array.from(lessonByDay.values()).sort((a, b) => a.dayNumber - b.dayNumber)
    });
  }

  return Array.from(byWeek.values()).sort((a, b) => a.weekNumber - b.weekNumber);
}
