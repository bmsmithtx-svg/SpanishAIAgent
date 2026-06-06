# SpanishAIAgent

SpanishAIAgent is a dark-themed, local-first study app for PDF-grounded everyday Spanish learning. The app is designed for practical family communication and will eventually connect to an OpenAI API-powered tutor agent.

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
   DATABASE_URL="file:../local-sources/spanish-ai-agent.db"
   ```

   Add local-only values as needed. Do not commit real secrets.

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
| `OPENAI_API_KEY` | Future server-side OpenAI API key. The current app only checks whether it exists. |
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
| `/chat` | Future Spanish tutor agent placeholder. |
| `/settings` | API, database, and source ingestion readiness status. |
| `/api/sources/upload` | Upload and extract PDF source files. |
| `/api/sources` | List imported source documents. |
| `/api/sources/[id]` | Load one source document. |
| `/api/sources/[id]/pages` | Load extracted pages for one source document. |
| `/api/sources/search` | Keyword search across extracted source chunks. |
| `/api/agent/status` | Returns safe agent/source status without exposing secrets. |
| `/api/agent/chat` | Placeholder chat endpoint returning a not implemented response. |

## Database Models

Prisma uses SQLite for local development and defines:

- `SpanishSourceDocument`: source PDF metadata, local path, SHA-256 hash, page count, processing status, extraction method, and processing errors.
- `SpanishSourcePage`: one row per PDF page with page number, extracted text, extraction method, and character count.
- `SpanishSourceChunk`: page-level text chunks for future retrieval, with document/page references and chunk indexes.

Useful indexes are included for file hashes, document/page lookups, page numbers, and chunk relationships.

## Inspecting Imported Sources

- Use `/library` to see all imported PDFs, processing status, page counts, extraction method, created date, and chunk count.
- Use `/library/[id]` to inspect extracted page previews and citation labels like `File Name, page X`.
- Use the search panel on `/library` for basic keyword search across extracted chunks.

## Source-Grounded Architecture

- `src/lib/sources` contains PDF storage, extraction, chunking, search, citation utilities, and source database helpers.
- `src/lib/agent` is reserved for future OpenAI agent orchestration.
- `src/lib/prompts` contains the PDF-only guardrail prompt draft.
- `src/types` contains shared source, lesson, practice, citation, and agent response types.

## Future Roadmap

- Add retrieval over `SpanishSourceChunk` records.
- Connect a server-side OpenAI API tutor route.
- Require every lesson, explanation, example, and answer to include PDF file/page citations.
- Add progress tracking, practice sessions, and review history.
- Add retrieval-grounded OpenAI tutor responses that refuse unsupported questions.

## Quality Commands

```bash
npm run lint
npm run typecheck
npm run build
```
