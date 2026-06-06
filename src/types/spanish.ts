export type SpanishCitation = {
  sourceFileName: string;
  pageNumber: number;
  sectionOrChapter?: string;
  snippet?: string;
};

export type SpanishSourcePage = {
  id: string;
  documentId: string;
  pageNumber: number;
  text: string;
  sectionOrChapter?: string;
  citations: SpanishCitation[];
};

export type SpanishSourceDocument = {
  id: string;
  fileName: string;
  title?: string;
  pageCount: number;
  uploadedAt: string;
  status: "uploaded" | "parsing" | "indexed" | "failed";
  pages: SpanishSourcePage[];
};

export type SpanishLesson = {
  id: string;
  title: string;
  objective: string;
  summaryPlaceholder: string;
  sourceCitations: SpanishCitation[];
  status: "placeholder" | "draft" | "ready";
};

export type SpanishPracticeItem = {
  id: string;
  lessonId?: string;
  prompt: string;
  expectedAnswer?: string;
  feedbackPlaceholder?: string;
  sourceCitations: SpanishCitation[];
  status: "placeholder" | "ready";
};

export type SpanishAgentResponse = {
  answer: string;
  citations: SpanishCitation[];
  unsupportedBySources: boolean;
  followUpSuggestions?: string[];
};
