import type {
  CurriculumClassificationSummary,
  CurriculumPageClassification
} from "@/types";

export const CURRICULUM_PAGE_FILTER_VERSION = "rule-based-v1";
export const INSTRUCTIONAL_PAGE_SCORE_THRESHOLD = 45;

export const CURRICULUM_PAGE_CLASSIFICATIONS: CurriculumPageClassification[] = [
  "instructional",
  "review",
  "exercise",
  "vocabulary",
  "grammar",
  "culture_or_reading",
  "front_matter",
  "table_of_contents",
  "license_or_credits",
  "answer_key",
  "appendix",
  "index_or_glossary",
  "bibliography",
  "unknown"
];

const ELIGIBLE_CLASSIFICATIONS = new Set<CurriculumPageClassification>([
  "instructional",
  "review",
  "exercise",
  "vocabulary",
  "grammar",
  "culture_or_reading"
]);

type ClassifierChunkInput = {
  text: string;
};

export type CurriculumPageClassifierInput = {
  fileName: string;
  pageNumber: number;
  text: string;
  chunks: ClassifierChunkInput[];
};

export type CurriculumPageClassifierResult = {
  classification: CurriculumPageClassification;
  score: number;
  included: boolean;
  reasons: string[];
};

type SignalCounts = {
  grammar: number;
  vocabulary: number;
  exercise: number;
  review: number;
  culture: number;
  chapter: number;
  spanishEnglish: number;
};

const GRAMMAR_TERMS = [
  "grammar",
  "gramatica",
  "verb",
  "verbs",
  "verbo",
  "verbos",
  "noun",
  "nouns",
  "sustantivo",
  "article",
  "articles",
  "articulo",
  "adjective",
  "adjectives",
  "adjetivo",
  "pronoun",
  "pronouns",
  "pronombre",
  "present tense",
  "presente",
  "preterite",
  "preterito",
  "imperfect",
  "imperfecto",
  "ser",
  "estar",
  "tener",
  "hay",
  "question words",
  "interrogative",
  "interrogativo",
  "conjugation",
  "conjugacion",
  "sentence structure",
  "oracion",
  "oraciones"
];

const VOCABULARY_TERMS = [
  "vocabulary",
  "vocabulario",
  "word list",
  "palabras",
  "expresiones",
  "phrases",
  "frases",
  "meaning",
  "significado"
];

const EXERCISE_TERMS = [
  "exercise",
  "exercises",
  "ejercicio",
  "ejercicios",
  "practice",
  "practica",
  "actividad",
  "actividades",
  "complete the",
  "fill in",
  "write the",
  "answer the",
  "choose the",
  "translate",
  "traduce"
];

const REVIEW_TERMS = [
  "review",
  "repaso",
  "summary",
  "resumen",
  "checkpoint",
  "self-check",
  "auto-prueba",
  "assessment",
  "evaluacion"
];

const CULTURE_TERMS = [
  "culture",
  "cultura",
  "reading",
  "lectura",
  "dialogue",
  "dialogo",
  "conversacion",
  "conversation",
  "contexto",
  "en contexto",
  "comunicacion"
];

const CHAPTER_TERMS = [
  "chapter",
  "capitulo",
  "unit",
  "unidad",
  "lesson",
  "leccion",
  "section",
  "seccion"
];

export function classifyCurriculumPage(
  input: CurriculumPageClassifierInput
): CurriculumPageClassifierResult {
  const rawText = [input.text, ...input.chunks.map((chunk) => chunk.text)].join("\n");
  const normalized = normalizeText(rawText);
  const compact = normalized.replace(/\s+/g, " ").trim();
  const reasons: string[] = [];

  if (compact.length < 80) {
    return buildResult("unknown", 0, ["near-empty page"]);
  }

  const signals = countLearningSignals(compact);
  const learningScore = calculateLearningScore(signals, compact.length);
  const nonInstructional = classifyNonInstructional(compact, input.pageNumber, learningScore);

  if (nonInstructional) {
    reasons.push(...nonInstructional.reasons);
    reasons.push(`learning signal score ${learningScore}`);

    return buildResult(nonInstructional.classification, Math.min(nonInstructional.score, learningScore), reasons);
  }

  let classification: CurriculumPageClassification = "instructional";

  if (signals.grammar >= 2) {
    classification = "grammar";
    reasons.push("grammar terms detected");
  } else if (signals.vocabulary >= 2) {
    classification = "vocabulary";
    reasons.push("vocabulary terms detected");
  } else if (signals.exercise >= 2) {
    classification = "exercise";
    reasons.push("practice/exercise terms detected");
  } else if (signals.review >= 1) {
    classification = "review";
    reasons.push("review terms detected");
  } else if (signals.culture >= 2) {
    classification = "culture_or_reading";
    reasons.push("culture or reading terms detected");
  } else if (signals.chapter >= 1 || signals.spanishEnglish >= 1) {
    classification = "instructional";
    reasons.push("chapter/unit or Spanish-English learning signal detected");
  } else {
    classification = "unknown";
    reasons.push("no strong learning signal detected");
  }

  const score = Math.min(100, learningScore);

  return buildResult(classification, score, reasons);
}

export function buildEmptyClassificationSummary(): CurriculumClassificationSummary {
  return CURRICULUM_PAGE_CLASSIFICATIONS.reduce((summary, classification) => {
    summary[classification] = {
      total: 0,
      included: 0,
      excluded: 0
    };

    return summary;
  }, {} as CurriculumClassificationSummary);
}

export function validatePageClassifierFixtures() {
  const fixtures = [
    {
      name: "license page",
      expectedIncluded: false,
      input: "Copyright 2020. This work is licensed under a Creative Commons Attribution license. ISBN and publisher information."
    },
    {
      name: "answer key page",
      expectedIncluded: false,
      input: "Answer Key. Answers to exercises from chapter 1. Exercise 1: 1. b 2. c 3. a."
    },
    {
      name: "grammar instruction page",
      expectedIncluded: true,
      input: "Unidad 2 Grammar: present tense verbs. Conjugation examples for ser, estar, and tener. Practice activities follow."
    },
    {
      name: "vocabulary practice page",
      expectedIncluded: true,
      input: "Vocabulario: family words and useful phrases. Practice writing sentences and answer the questions in Spanish."
    }
  ];

  const cases = fixtures.map((fixture) => {
    const result = classifyCurriculumPage({
      fileName: "fixture.pdf",
      pageNumber: 12,
      text: fixture.input,
      chunks: []
    });

    return {
      name: fixture.name,
      expectedIncluded: fixture.expectedIncluded,
      actualIncluded: result.included,
      classification: result.classification,
      score: result.score,
      passed: result.included === fixture.expectedIncluded
    };
  });

  return {
    passed: cases.every((fixture) => fixture.passed),
    cases
  };
}

function buildResult(
  classification: CurriculumPageClassification,
  score: number,
  reasons: string[]
): CurriculumPageClassifierResult {
  const roundedScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    classification,
    score: roundedScore,
    included: ELIGIBLE_CLASSIFICATIONS.has(classification) && roundedScore >= INSTRUCTIONAL_PAGE_SCORE_THRESHOLD,
    reasons: reasons.slice(0, 5)
  };
}

function classifyNonInstructional(
  text: string,
  pageNumber: number,
  learningScore: number
): { classification: CurriculumPageClassification; score: number; reasons: string[] } | null {
  const earlyPage = pageNumber <= 20;
  const firstBlock = text.slice(0, 1200);

  if (hasTableOfContentsShape(firstBlock)) {
    return {
      classification: "table_of_contents",
      score: 8,
      reasons: ["table of contents pattern detected"]
    };
  }

  if (
    earlyPage &&
    matchesAny(firstBlock, [
      "about the book",
      "about the author",
      "about this book",
      "written by",
      "audiobook",
      "book summary",
      "essential grammars are available",
      "dedication",
      "preface",
      "foreword"
    ])
  ) {
    return {
      classification: "front_matter",
      score: 16,
      reasons: ["early front-matter wording detected"]
    };
  }

  if (matchesAny(firstBlock, ["answer key", "answers to exercises", "solutions", "clave de respuestas", "respuestas"])) {
    return {
      classification: "answer_key",
      score: 12,
      reasons: ["answer key pattern detected"]
    };
  }

  if (matchesAny(firstBlock, ["bibliography", "references", "works cited", "referencias"])) {
    return {
      classification: "bibliography",
      score: 8,
      reasons: ["bibliography/reference pattern detected"]
    };
  }

  if (matchesAny(firstBlock, ["glossary", "glossary of grammar terms", "index", "indice alfabetico"])) {
    return {
      classification: "index_or_glossary",
      score: 18,
      reasons: ["index/glossary heading detected"]
    };
  }

  if (matchesAny(firstBlock, ["appendix", "appendices", "apendice", "incorporated oer", "additional contributors"])) {
    return {
      classification: "appendix",
      score: 15,
      reasons: ["appendix pattern detected"]
    };
  }

  if (
    matchesAny(firstBlock, [
      "copyright",
      "creative commons",
      "licensed under",
      "cc by",
      "all rights reserved",
      "isbn",
      "publisher",
      "credits",
      "acknowledgments",
      "acknowledgements"
    ]) && learningScore < 65
  ) {
    return {
      classification: "license_or_credits",
      score: 10,
      reasons: ["license/copyright/credits pattern detected"]
    };
  }

  if (
    earlyPage &&
    learningScore < 55 &&
    (isLikelyTitlePage(text) || matchesAny(firstBlock, ["preface", "foreword", "about the book", "about the author", "dedication"]))
  ) {
    return {
      classification: "front_matter",
      score: 18,
      reasons: ["front-matter pattern detected"]
    };
  }

  return null;
}

function calculateLearningScore(signals: SignalCounts, textLength: number) {
  return (
    Math.min(textLength / 90, 18) +
    signals.grammar * 7 +
    signals.vocabulary * 8 +
    signals.exercise * 7 +
    signals.review * 6 +
    signals.culture * 5 +
    signals.chapter * 8 +
    signals.spanishEnglish * 8
  );
}

function countLearningSignals(text: string): SignalCounts {
  return {
    grammar: countTerms(text, GRAMMAR_TERMS),
    vocabulary: countTerms(text, VOCABULARY_TERMS),
    exercise: countTerms(text, EXERCISE_TERMS),
    review: countTerms(text, REVIEW_TERMS),
    culture: countTerms(text, CULTURE_TERMS),
    chapter: countTerms(text, CHAPTER_TERMS) + countRegex(text, /\b(chapter|unit|lesson|section)\s+\d+/g),
    spanishEnglish: countRegex(text, /\b(spanish|espanol)\b/g) + countRegex(text, /\b(english|ingles)\b/g)
  };
}

function countTerms(text: string, terms: string[]) {
  return terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
}

function countRegex(text: string, regex: RegExp) {
  return [...text.matchAll(regex)].length;
}

function hasTableOfContentsShape(text: string) {
  const tableHeading = matchesAny(text, [
    "table of contents",
    "contents",
    "content list",
    "summary content list",
    "content s",
    "indice",
    "indice general"
  ]);
  const chapterListings =
    countRegex(text, /\bchapter\s+\d+\s*[:.]/g) +
    countRegex(text, /\b(unit|unidad|capitulo|lesson|leccion)\s+\d+\s*[:.]/g);

  if (!tableHeading && chapterListings < 6) {
    return false;
  }

  const listedPageNumbers = countRegex(text, /\b(chapter|unit|unidad|capitulo|lesson|leccion)\b.{0,90}\b\d{1,3}\b/g);
  const dottedEntries = countRegex(text, /\.{3,}\s*\d{1,3}/g);

  return listedPageNumbers + dottedEntries >= 2 || chapterListings >= 3 || text.length < 1600;
}

function isLikelyTitlePage(text: string) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return text.length < 500 && lines.length <= 8;
}

function matchesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
