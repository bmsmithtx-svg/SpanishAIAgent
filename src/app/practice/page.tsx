import { PlaceholderPage } from "@/components/placeholder-page";

export default function PracticePage() {
  return (
    <PlaceholderPage
      eyebrow="Practice mode"
      title="Practice for everyday family communication"
      description="Practice sessions will be built from cited PDF material, with no unsupported prompts or invented examples."
      primaryTitle="Practice engine placeholder"
      primaryCopy="Future drills, review prompts, and conversation exercises will require linked source pages before they appear."
      secondaryTitle="Practice workflow"
      steps={[
        {
          title: "Select source-backed skill",
          copy: "Choose a practice focus only when the library has supporting PDF passages."
        },
        {
          title: "Generate practice items",
          copy: "Create practice from retrieved source pages and attach citations."
        },
        {
          title: "Review with evidence",
          copy: "Show which file and page supported each answer or correction."
        }
      ]}
    />
  );
}
