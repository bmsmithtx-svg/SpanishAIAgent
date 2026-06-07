# SpanishAIAgent

SpanishAIAgent is a dark-themed, local-first study app for PDF-grounded everyday Spanish learning. The app is designed for practical family communication and includes a first retrieval-grounded OpenAI tutor chat.

## Strict PDF-Only Rule

All Spanish teaching content, examples, grammar explanations, vocabulary, lessons, practice questions, cultural notes, and tutor answers must come only from uploaded Spanish PDF sources. If the uploaded PDFs do not support an answer, the future agent must say that the PDFs do not contain enough information.

No Spanish curriculum should be generated from general model knowledge. Imported PDFs are the source of truth.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env.local
   ```

3. Confirm the local database URL in `.env.local`:

   ```bash
   OPENAI_API_KEY=
   OPENAI_MODEL=gpt-4.1-mini
   OPENAI_EMBEDDING_MODEL=text-embedding-3-small
   OPENAI_EMBEDDING_DIMENSIONS=1536
   DATABASE_URL="file:../local-sources/spanish-ai-agent.db"
   ```

   Add your real `OPENAI_API_KEY` locally. Do not commit real secrets. If `OPENAI_MODEL` is omitted, the server falls back to `gpt-4.1-mini`.

4. Create and migrate the local SQLite database:

   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

   If Prisma has trouble creating the SQLite file on a fresh machine, create the empty file first:

   ```bash
   sqlite3 local-sources/spanish-ai-agent.db ".databases"
   npx prisma migrate dev
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open the app at [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Server-side OpenAI API key used by `/api/agent/chat`. It is never exposed to the browser. |
| `OPENAI_MODEL` | Optional chat model. Defaults to `gpt-4.1-mini` when missing. |
| `OPENAI_EMBEDDING_MODEL` | Optional embedding model for semantic retrieval. Defaults to `text-embedding-3-small`. |
| `OPENAI_EMBEDDING_DIMENSIONS` | Optional embedding vector size. Defaults to `1536`. |
| `DATABASE_URL` | Local SQLite database URL for imported PDF metadata, pages, and chunks. |
| `NEXT_PUBLIC_APP_NAME` | Public app name shown in API status responses. Defaults to `SpanishAIAgent`. |

## Adding PDFs

1. Start the app with `npm run dev`.
2. Open `/library`.
3. Use the upload panel to add one or more PDF files.
4. The app stores raw PDFs locally under `local-sources/pdfs/`.
5. Extracted page/chunk records are stored in the local SQLite database at `local-sources/spanish-ai-agent.db`.
6. Optional extraction snapshots are written under `local-sources/extracted/`.

Duplicate PDFs are detected with a SHA-256 file hash. Uploading the same PDF twice will return the existing source record instead of creating duplicates.

## Retrieval-Grounded Chat

The `/chat` page and `/api/agent/chat` route implement the first working SpanishAIAgent tutor flow:

1. The user sends a question or study request.
2. The server searches `SpanishSourceChunk` records with hybrid retrieval when embeddings exist, or keyword retrieval when they do not.
3. Keyword matches are ranked by exact phrase match, keyword overlap, and source relevance.
4. Semantic matches compare the question embedding to stored chunk embeddings.
5. If no chunks are found, the app does not call OpenAI and returns a PDF-only refusal.
6. If chunks are found, the server sends only those excerpts to OpenAI.
7. The model is instructed to answer only from the retrieved PDF excerpts.
8. The API returns the answer, retrieved source previews, retrieval mode, scores, and structured citations.

The tutor must refuse requests that ask it to ignore PDFs, use outside knowledge, skip citations, or invent unsupported Spanish content.

## Semantic Retrieval

Embeddings are stored on `SpanishSourceChunk` rows in the local SQLite database. This keeps the first version local-first and simple while preserving the future option to move vectors into a dedicated vector store.

Use `/settings` to check embedding coverage and backfill chunks in small batches. Backfilling calls the OpenAI embeddings API and uses API credits.

Available endpoints:

- `GET /api/sources/embeddings/status`
- `POST /api/sources/embeddings/backfill`

The chat API reports one of these retrieval modes:

- `hybrid`: keyword and semantic candidates were both available.
- `semantic`: semantic candidates were available without keyword candidates.
- `keyword`: semantic retrieval was unavailable, incomplete, or not useful for the query.
- `none`: no usable source chunks were retrieved.

## Citations

Successful tutor answers include structured citations with:

- PDF file name
- page number
- document id
- page id
- chunk id
- snippet preview

The visible citation label format is `File Name, page X`.

## Git Safety

Raw PDFs, local uploads, extracted snapshots, temp files, and local database files are ignored by git:

- `*.pdf`
- `local-sources/**/*.pdf`
- `local-sources/uploads/*`
- `local-sources/extracted/*`
- `local-sources/**/*.db`
- `*.sqlite`, `*.sqlite3`, `*.db`

Only `.gitkeep` placeholders are tracked inside `local-sources/` so the folder structure exists after clone.

## Current Routes

| Route | Purpose |
| --- | --- |
| `/` | Dashboard with source ingestion counts and source library status. |
| `/library` | Upload PDFs, list imported sources, and search extracted chunks. |
| `/library/[id]` | Inspect a source document, extracted pages, page counts, and citation labels. |
| `/learn` | Lesson roadmap placeholder. |
| `/practice` | Practice mode placeholder. |
| `/chat` | Retrieval-grounded Spanish tutor chat. |
| `/settings` | API, database, retrieval, and chat readiness status. |
| `/api/sources/upload` | Upload and extract PDF source files. |
| `/api/sources` | List imported source documents. |
| `/api/sources/[id]` | Load one source document. |
| `/api/sources/[id]/pages` | Load extracted pages for one source document. |
| `/api/sources/search` | Keyword search across extracted source chunks. |
| `/api/sources/embeddings/status` | Returns local embedding coverage and semantic retrieval readiness. |
| `/api/sources/embeddings/backfill` | Embeds the next batch of missing source chunks without exposing secrets. |
| `/api/agent/status` | Returns safe agent/source/chat status without exposing secrets. |
| `/api/agent/chat` | Server-side retrieval-grounded tutor chat endpoint. |

## Database Models

Prisma uses SQLite for local development and defines:

- `SpanishSourceDocument`: source PDF metadata, local path, SHA-256 hash, page count, processing status, extraction method, and processing errors.
- `SpanishSourcePage`: one row per PDF page with page number, extracted text, extraction method, and character count.
- `SpanishSourceChunk`: page-level text chunks for retrieval, with document/page references, chunk indexes, optional embedding JSON, embedding model metadata, and embedding error state.

Useful indexes are included for file hashes, document/page lookups, page numbers, chunk relationships, and embedding backfill status.

## Inspecting Imported Sources

- Use `/library` to see all imported PDFs, processing status, page counts, extraction method, created date, and chunk count.
- Use `/library/[id]` to inspect extracted page previews and citation labels like `File Name, page X`.
- Use the search panel on `/library` for basic keyword search across extracted chunks.

## Source-Grounded Architecture

- `src/lib/sources` contains PDF storage, extraction, chunking, keyword retrieval, semantic retrieval, embedding backfill, search, citation utilities, and source database helpers.
- `src/lib/agent` contains OpenAI client setup, embedding helpers, and agent readiness helpers.
- `src/lib/prompts` contains the PDF-only guardrail prompt draft.
- `src/types` contains shared source, lesson, practice, citation, and agent response types.

## Current Limitations

- Semantic retrieval currently scans stored SQLite embeddings in application code. A dedicated vector index may be useful after the source library grows.
- Embeddings are backfilled manually from `/settings`; automatic embedding on upload is not implemented yet.
- The tutor has no long-term chat memory.
- Daily lesson generation is not yet organized by PDF sections.
- OCR is not implemented for scanned pages with no extractable text.

## Future Roadmap

- Add automatic embedding after successful PDF upload.
- Add a vector database or vector extension if SQLite scanning becomes too slow.
- Generate daily lessons from source-backed PDF sections.
- Improve retrieval ranking with page/section metadata.
- Add progress tracking, practice sessions, and review history.
- Add source-backed conversation drills and spaced review.

## Quality Commands

```bash
npm run lint
npm run typecheck
npm run build
```
