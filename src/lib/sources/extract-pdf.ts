import { readFile } from "node:fs/promises";

export type ExtractedPdfPage = {
  pageNumber: number;
  text: string;
  extractionMethod: "pdf-text" | "failed";
  characterCount: number;
};

export type ExtractedPdfDocument = {
  pageCount: number;
  extractionMethod: "pdf-text" | "mixed" | "failed";
  pages: ExtractedPdfPage[];
};

type PdfTextItem = {
  str?: string;
};

export async function extractPdfTextByPage(filePath: string): Promise<ExtractedPdfDocument> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const fileBuffer = await readFile(filePath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(fileBuffer),
    disableWorker: true,
    useSystemFonts: true
  });
  const pdf = await loadingTask.promise;
  const pages: ExtractedPdfPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: PdfTextItem) => item.str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    pages.push({
      pageNumber,
      text,
      extractionMethod: text.length > 0 ? "pdf-text" : "failed",
      characterCount: text.length
    });
  }

  const extractedPageCount = pages.filter((page) => page.text.length > 0).length;
  const extractionMethod =
    extractedPageCount === 0
      ? "failed"
      : extractedPageCount === pages.length
        ? "pdf-text"
        : "mixed";

  return {
    pageCount: pdf.numPages,
    extractionMethod,
    pages
  };
}

export function chunkSpanishSourcePage(text: string, maxLength = 1200, overlap = 160) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + maxLength, normalized.length);

    if (end < normalized.length) {
      const wordBoundary = normalized.lastIndexOf(" ", end);

      if (wordBoundary > start + maxLength * 0.6) {
        end = wordBoundary;
      }
    }

    const chunk = normalized.slice(start, end).trim();

    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
