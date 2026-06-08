import Link from "next/link";
import { ChatInterface } from "@/components/chat-interface";
import { PageHeader } from "@/components/page-header";
import { getOpenAIModel } from "@/lib/agent/openai-client";
import { getDailyLessonByDayNumber } from "@/lib/curriculum";
import { getSourceLibraryStats } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const stats = await getSourceLibraryStats();
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const currentLesson = getDailyLessonByDayNumber(1);

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
            Ask: Help me with today&apos;s grammar focus
            {currentLesson ? ` (${currentLesson.grammarFocus}).` : "."} The tutor still
            retrieves PDF chunks first and refuses unsupported content.
          </p>
          <Link className="secondary-button inline-action" href={currentLesson ? `/learn/day/${currentLesson.dayNumber}` : "/learn"}>
            Open current lesson
          </Link>
        </article>
        <article className="placeholder-panel helper-card">
          <span className="badge gold">Sentence formation</span>
          <h2>Practice with citations</h2>
          <p>
            Ask: Quiz me on today&apos;s sentence-building practice. The answer must stay grounded
            in retrieved PDF chunks and cite file/page references.
          </p>
          <Link className="secondary-button inline-action" href={currentLesson ? `/learn/day/${currentLesson.dayNumber}#sentence-building` : "/practice"}>
            Open practice
          </Link>
        </article>
        <article className="placeholder-panel helper-card">
          <span className="badge green">Weekly gate</span>
          <h2>Understand citations</h2>
          <p>
            Ask: Explain the source citations for today&apos;s lesson. Chat help does not bypass
            lesson locks, assessment gates, or the PDF-only rule.
          </p>
          <Link className="secondary-button inline-action" href={currentLesson ? `/learn/day/${currentLesson.dayNumber}#source-citations` : "/learn"}>
            Open citations
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
