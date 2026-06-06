import { ChatInterface } from "@/components/chat-interface";
import { PageHeader } from "@/components/page-header";
import { getOpenAIModel } from "@/lib/agent/openai-client";
import { getSourceLibraryStats } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const stats = await getSourceLibraryStats();
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  return (
    <div className="page">
      <PageHeader
        eyebrow="Tutor chat"
        title="Retrieval-grounded Spanish tutor"
        description="Ask SpanishAIAgent for help only from your uploaded PDF chunks. The tutor retrieves sources first, refuses unsupported requests, and cites the PDF file name and page number."
        badges={[
          { label: "PDF-only answers", tone: "rose" },
          { label: "Server-side OpenAI", tone: "teal" }
        ]}
      />
      <ChatInterface
        initialModel={getOpenAIModel()}
        initialOpenAIConfigured={hasOpenAIKey}
        initialSourceChunkCount={stats.sourceChunkCount}
        initialSourceDocumentCount={stats.sourceDocumentCount}
      />
    </div>
  );
}
