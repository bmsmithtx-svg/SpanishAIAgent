import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { WeeklyAssessmentView } from "@/components/weekly-assessment-view";
import {
  getAssessmentSourceContext,
  getGeneratedCurriculumWeekByNumber,
  getWeekByNumber,
} from "@/lib/curriculum";

export const dynamic = "force-dynamic";

type AssessmentPageProps = {
  params: Promise<{
    weekNumber: string;
  }>;
};

export default async function AssessmentPage({ params }: AssessmentPageProps) {
  const { weekNumber: rawWeekNumber } = await params;
  const weekNumber = Number(rawWeekNumber);

  if (!Number.isInteger(weekNumber) || weekNumber < 1) {
    notFound();
  }

  const generatedWeek = await getGeneratedCurriculumWeekByNumber(weekNumber);
  const week = generatedWeek ?? getWeekByNumber(weekNumber);
  const assessment = week?.assessment ?? null;

  if (!week || !assessment) {
    notFound();
  }

  const sourceContext = await getAssessmentSourceContext(assessment);

  return (
    <div className="page">
      <PageHeader
        eyebrow={`Week ${weekNumber} assessment`}
        title={assessment.title}
        description="Weekly assessments gate the next week. This first version uses a local placeholder pass/fail flow; future grading must use only uploaded PDF context and cite file/page references."
        badges={[
          { label: `${assessment.passingThreshold}% pass target`, tone: "gold" },
          { label: "Local progress", tone: "teal" },
          { label: "PDF-only assessor", tone: "rose" }
        ]}
      />

      <WeeklyAssessmentView assessment={assessment} sourceContext={sourceContext} week={week} />
    </div>
  );
}
