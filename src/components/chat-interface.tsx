"use client";

import { FormEvent, useMemo, useState } from "react";

type ChatMode = "ask" | "lesson" | "practice" | "conversation";

type ChatCitation = {
  fileName: string;
  pageNumber: number;
  documentId: string;
  pageId: string;
  chunkId: string;
  snippet: string;
};

type RetrievedSourcePreview = {
  documentId: string;
  pageId: string;
  chunkId: string;
  fileName: string;
  pageNumber: number;
  chunkIndex: number;
  citationLabel: string;
  preview: string;
  relevanceScore: number;
  matchedTerms: string[];
};

type ChatResponse = {
  answer: string;
  citations: ChatCitation[];
  retrievedSources: RetrievedSourcePreview[];
  model: string;
  mode: ChatMode;
  sourceGrounded: boolean;
  error?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: ChatMode;
  citations?: ChatCitation[];
  retrievedSources?: RetrievedSourcePreview[];
  sourceGrounded?: boolean;
  model?: string;
};

type ChatInterfaceProps = {
  initialOpenAIConfigured: boolean;
  initialSourceChunkCount: number;
  initialSourceDocumentCount: number;
  initialModel: string;
};

const modes: Array<{ value: ChatMode; label: string }> = [
  { value: "ask", label: "Ask" },
  { value: "lesson", label: "Lesson" },
  { value: "practice", label: "Practice" },
  { value: "conversation", label: "Conversation" }
];

const examplePrompts = [
  "Teach me today's Spanish lesson from the PDFs.",
  "Explain ser vs estar using only my PDFs.",
  "Give me family conversation practice from the PDFs.",
  "What should I practice speaking aloud today?"
];

export function ChatInterface({
  initialOpenAIConfigured,
  initialSourceChunkCount,
  initialSourceDocumentCount,
  initialModel
}: ChatInterfaceProps) {
  const [mode, setMode] = useState<ChatMode>("ask");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const chatReady = initialOpenAIConfigured && initialSourceChunkCount > 0;
  const latestAnswer = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages]
  );

  async function sendMessage(event?: FormEvent<HTMLFormElement>, overrideMessage?: string) {
    event?.preventDefault();
    const messageText = (overrideMessage ?? input).trim();

    if (!messageText || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageText,
      mode
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: messageText,
          mode,
          maxSources: 6
        })
      });
      const payload = (await response.json()) as ChatResponse;
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: payload.answer,
        mode: payload.mode,
        citations: payload.citations,
        retrievedSources: payload.retrievedSources,
        sourceGrounded: payload.sourceGrounded,
        model: payload.model
      };

      setMessages((current) => [...current, assistantMessage]);

      if (!response.ok && payload.error) {
        setError(payload.error);
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Chat request failed.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="chat-workspace">
      <section className="chat-status-row" aria-label="Tutor readiness">
        <span className={`badge ${chatReady ? "green" : "gold"}`}>
          {chatReady ? "Retrieval-grounded chat ready" : "Chat setup incomplete"}
        </span>
        <span className="badge teal">{initialSourceDocumentCount} PDFs</span>
        <span className="badge teal">{initialSourceChunkCount} chunks</span>
        <span className="badge gold">{initialModel}</span>
      </section>

      {!initialOpenAIConfigured ? (
        <div className="warning-panel">
          <strong>OpenAI key missing</strong>
          <span>Add `OPENAI_API_KEY` to `.env.local` before tutor answers can run.</span>
        </div>
      ) : null}

      {initialSourceChunkCount === 0 ? (
        <div className="warning-panel">
          <strong>No indexed PDF chunks</strong>
          <span>Import PDFs in the library before asking the tutor for Spanish help.</span>
        </div>
      ) : null}

      <section className="chat-panel" aria-label="SpanishAIAgent chat">
        <div className="mode-selector" role="tablist" aria-label="Chat mode">
          {modes.map((item) => (
            <button
              aria-selected={mode === item.value}
              className={`mode-button${mode === item.value ? " active" : ""}`}
              key={item.value}
              onClick={() => setMode(item.value)}
              role="tab"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <strong>Ask questions based only on your uploaded Spanish PDFs.</strong>
            <span>
              SpanishAIAgent retrieves local PDF chunks first, then asks the tutor to answer only
              from those excerpts with file/page citations.
            </span>
          </div>
        ) : (
          <div className="message-list" aria-live="polite">
            {messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                <span className="message-label">
                  {message.role === "user" ? "You" : "SpanishAIAgent"}
                </span>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
        )}

        <form className="chat-form" onSubmit={(event) => sendMessage(event)}>
          <textarea
            className="chat-input"
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask a PDF-grounded Spanish question"
            rows={4}
            value={input}
          />
          <button className="primary-button" disabled={isSending || !input.trim()} type="submit">
            {isSending ? "Retrieving..." : "Send"}
          </button>
        </form>

        <div className="prompt-grid" aria-label="Example prompts">
          {examplePrompts.map((prompt) => (
            <button
              className="prompt-button"
              disabled={isSending}
              key={prompt}
              onClick={() => sendMessage(undefined, prompt)}
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>

        {error ? <p className="form-message">{error}</p> : null}
      </section>

      <section className="chat-evidence-grid" aria-label="Chat evidence">
        <article className="evidence-panel">
          <div className="section-heading-row">
            <div>
              <span className="badge green">Citations</span>
              <h2>Answer sources</h2>
            </div>
            <span className="result-count">{latestAnswer?.citations?.length ?? 0} citations</span>
          </div>

          {!latestAnswer?.citations?.length ? (
            <div className="empty-state">
              <strong>No answer citations yet</strong>
              <span>Citation cards appear after a source-grounded response.</span>
            </div>
          ) : (
            <div className="citation-list">
              {latestAnswer.citations.map((citation) => (
                <a
                  className="citation-card"
                  href={`/library/${citation.documentId}#page-${citation.pageNumber}`}
                  key={citation.chunkId}
                >
                  <strong>
                    {citation.fileName}, page {citation.pageNumber}
                  </strong>
                  <span>{citation.snippet}</span>
                </a>
              ))}
            </div>
          )}
        </article>

        <article className="evidence-panel">
          <div className="section-heading-row">
            <div>
              <span className="badge teal">Retrieved excerpts</span>
              <h2>PDF context</h2>
            </div>
            <span className="result-count">
              {latestAnswer?.sourceGrounded ? "Grounded" : "Waiting"}
            </span>
          </div>

          {!latestAnswer?.retrievedSources?.length ? (
            <div className="empty-state">
              <strong>No retrieved excerpts yet</strong>
              <span>The tutor will show which chunks were used for the latest answer.</span>
            </div>
          ) : (
            <div className="source-preview-list">
              {latestAnswer.retrievedSources.map((source) => (
                <details className="source-preview" key={source.chunkId}>
                  <summary>{source.citationLabel}</summary>
                  <p>{source.preview}</p>
                </details>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
