import { PlaceholderPage } from "@/components/placeholder-page";

export default function LearnPage() {
  return (
    <PlaceholderPage
      eyebrow="Lesson roadmap"
      title="PDF-grounded lesson roadmap"
      description="Roadmap modules will be generated only after the app can trace each lesson back to uploaded PDF pages."
      primaryTitle="Lessons are intentionally gated"
      primaryCopy="The learning path will stay empty until source pages have been indexed and can support each lesson objective with citations."
      secondaryTitle="Roadmap stages"
      steps={[
        {
          title: "Source audit",
          copy: "Confirm which uploaded pages can support beginner-friendly learning goals."
        },
        {
          title: "Lesson grouping",
          copy: "Organize supported material into daily study blocks with citation coverage."
        },
        {
          title: "Progress tracking",
          copy: "Record completed source-backed lessons and identify review areas."
        }
      ]}
    />
  );
}
