import { CurriculumRoadmap } from "@/components/curriculum-roadmap";
import { PageHeader } from "@/components/page-header";
import { getCurriculumSections, getCurriculumSummary } from "@/lib/curriculum";

export default function LearnPage() {
  const sections = getCurriculumSections();
  const summary = getCurriculumSummary();

  return (
    <div className="page">
      <PageHeader
        eyebrow="Lesson roadmap"
        title="Grammar-first daily Spanish roadmap"
        description="A local-first eight-week study structure is ready for everyday family communication. Real Spanish teaching content remains placeholder-gated until uploaded PDFs provide source-backed vocabulary, grammar, examples, and citations."
        badges={[
          { label: `${summary.lessonCount} daily lessons`, tone: "teal" },
          { label: `${summary.assessmentCount} weekly assessments`, tone: "gold" },
          { label: "PDF-only content rule", tone: "rose" }
        ]}
      />

      <CurriculumRoadmap sections={sections} />
    </div>
  );
}
