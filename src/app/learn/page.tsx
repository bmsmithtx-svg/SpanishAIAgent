import { CurriculumRoadmap } from "@/components/curriculum-roadmap";
import { PageHeader } from "@/components/page-header";
import {
  generatedCurriculumToSections,
  getActiveGeneratedCurriculum,
  getCurriculumSections,
  getCurriculumSummary,
  getGeneratedCurriculumStatus
} from "@/lib/curriculum";

export const dynamic = "force-dynamic";

export default async function LearnPage() {
  const [generatedCurriculum, statusSummary] = await Promise.all([
    getActiveGeneratedCurriculum(),
    getGeneratedCurriculumStatus()
  ]);
  const sections = generatedCurriculum
    ? generatedCurriculumToSections(generatedCurriculum)
    : getCurriculumSections();
  const summary = getCurriculumSummary();
  const activeLessonCount = generatedCurriculum?.lessonCount ?? summary.lessonCount;
  const activeAssessmentCount = generatedCurriculum?.weekCount ?? summary.assessmentCount;
  const modeLabel = generatedCurriculum ? "PDF-derived curriculum" : "8-week seed fallback";

  return (
    <div className="page">
      <PageHeader
        eyebrow="Lesson roadmap"
        title="Grammar-first daily Spanish roadmap"
        description="The roadmap prefers generated PDF-derived lesson shells when imported textbooks exist. If no PDFs are imported yet, the local 8-week seed fallback stays active and real Spanish teaching content remains placeholder-gated."
        badges={[
          { label: modeLabel, tone: generatedCurriculum ? "green" : "gold" },
          { label: `${activeLessonCount} daily lessons`, tone: "teal" },
          { label: `${activeAssessmentCount} weekly assessments`, tone: "gold" },
          { label: "PDF-only content rule", tone: "rose" }
        ]}
      />

      <CurriculumRoadmap
        generatedCurriculum={generatedCurriculum}
        sections={sections}
        statusSummary={statusSummary}
      />
    </div>
  );
}
