import { PlaceholderPage } from "@/components/placeholder-page";

export default function ChatPage() {
  return (
    <PlaceholderPage
      eyebrow="Tutor chat"
      title="Future Spanish tutor agent"
      description="The chat surface is ready for a future server-side tutor, but answering is disabled until PDF retrieval and citations are implemented."
      primaryTitle="Agent responses are not enabled yet"
      primaryCopy="The future tutor must retrieve uploaded PDF pages before answering and must refuse unsupported questions instead of inventing content."
      secondaryTitle="Agent guardrails"
      steps={[
        {
          title: "Retrieve source pages",
          copy: "Find relevant uploaded PDF pages before composing any answer."
        },
        {
          title: "Cite every answer",
          copy: "Attach file names and page numbers to lessons, explanations, examples, and corrections."
        },
        {
          title: "Refuse unsupported content",
          copy: "Say the PDFs do not contain enough information when retrieval cannot support an answer."
        }
      ]}
    />
  );
}
