import { createOpenAIClient } from "@/lib/agent/openai-client";

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
export const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

export function getEmbeddingModel() {
  return process.env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
}

export function getEmbeddingDimensions() {
  const parsed = Number.parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_EMBEDDING_DIMENSIONS;
  }

  return parsed;
}

export async function embedText(text: string) {
  const [embedding] = await embedTexts([text]);
  return embedding;
}

export async function embedTexts(texts: string[]) {
  const cleanedTexts = texts.map((text) => text.replace(/\s+/g, " ").trim());

  if (cleanedTexts.some((text) => text.length === 0)) {
    throw new Error("Cannot embed empty text.");
  }

  const client = createOpenAIClient();
  const response = await client.embeddings.create({
    model: getEmbeddingModel(),
    input: cleanedTexts,
    encoding_format: "float",
    dimensions: getEmbeddingDimensions()
  });

  return response.data.map((item) => item.embedding);
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magnitudeA += a[index] * a[index];
    magnitudeB += b[index] * b[index];
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

export function serializeEmbedding(embedding: number[]) {
  return JSON.stringify(embedding);
}

export function parseEmbeddingJson(embeddingJson?: string | null) {
  if (!embeddingJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(embeddingJson) as unknown;

    if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "number")) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
