import Link from "next/link";
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
      <section className="helper-card-grid" aria-label="Tutor helper paths">
        <article className="placeholder-panel helper-card">
          <span className="badge teal">Today&apos;s grammar</span>
          <h2>Ask from the lesson context</h2>
          <p>
            Use lesson mode for questions about the current grammar focus. The tutor still
            retrieves PDF chunks first and refuses unsupported content.
          </p>
          <Link className="secondary-button inline-action" href="/learn">
            Open roadmap
          </Link>
        </article>
        <article className="placeholder-panel helper-card">
          <span className="badge gold">Sentence formation</span>
          <h2>Practice with citations</h2>
          <p>
            Sentence practice should stay grounded in uploaded PDFs. Use practice mode only
            after source chunks are available for the topic.
          </p>
          <Link className="secondary-button inline-action" href="/practice">
            Open practice
          </Link>
        </article>
        <article className="placeholder-panel helper-card">
          <span className="badge green">Weekly gate</span>
          <h2>Prep for assessment</h2>
          <p>
            Weekly assessments control roadmap progression. Chat help does not bypass lesson
            locks or assessment pass states.
          </p>
          <Link className="secondary-button inline-action" href="/learn/week/1/assessment">
            Open assessment
          </Link>
        </article>
      </section>
      <ChatInterface
        initialModel={getOpenAIModel()}
        initialOpenAIConfigured={hasOpenAIKey}
        initialSourceChunkCount={stats.sourceChunkCount}
        initialSourceDocumentCount={stats.sourceDocumentCount}
      />
    </div>
  );
}
