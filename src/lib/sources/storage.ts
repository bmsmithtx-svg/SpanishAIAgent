import path from "node:path";
import { mkdir } from "node:fs/promises";

export const LOCAL_SOURCE_ROOT = path.join(process.cwd(), "local-sources");
export const LOCAL_PDF_DIR = path.join(LOCAL_SOURCE_ROOT, "pdfs");
export const LOCAL_UPLOAD_DIR = path.join(LOCAL_SOURCE_ROOT, "uploads");
export const LOCAL_EXTRACTED_DIR = path.join(LOCAL_SOURCE_ROOT, "extracted");

export async function ensureLocalSourceDirectories() {
  await Promise.all([
    mkdir(LOCAL_SOURCE_ROOT, { recursive: true }),
    mkdir(LOCAL_PDF_DIR, { recursive: true }),
    mkdir(LOCAL_UPLOAD_DIR, { recursive: true }),
    mkdir(LOCAL_EXTRACTED_DIR, { recursive: true })
  ]);
}

export function sanitizePdfFileName(fileName: string) {
  const baseName = path.basename(fileName).replace(/[^\w.() -]+/g, "-").trim();
  const safeName = baseName.length > 0 ? baseName : "source.pdf";

  return safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
}
