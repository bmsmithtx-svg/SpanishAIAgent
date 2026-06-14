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
   EMBEDDING_BACKFILL_DEFAULT_LIMIT=10
   EMBEDDING_BACKFILL_MAX_LIMIT=100
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
| `OPENAI_API_KEY` | Server-side OpenAI API key used by `/api/agent/chat` and embedding backfill. It is never exposed to the browser. The key must have permission to use the configured chat and embedding models. |
| `OPENAI_MODEL` | Optional chat model. Defaults to `gpt-4.1-mini` when missing. |
| `OPENAI_EMBEDDING_MODEL` | Optional embedding model for local semantic scoring. Defaults to `text-embedding-3-small`. |
| `OPENAI_EMBEDDING_DIMENSIONS` | Optional embedding vector size. Defaults to `1536`. |
| `EMBEDDING_BACKFILL_DEFAULT_LIMIT` | Optional safe default batch size for embedding backfill. Defaults to `10`. |
| `EMBEDDING_BACKFILL_MAX_LIMIT` | Optional server-side max batch size. Values above `100` are capped to `100`. |
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
2. The server searches `SpanishSourceChunk` records with hybrid retrieval when stored embeddings exist, or keyword retrieval when they do not.
3. Keyword matches are ranked by exact phrase match, keyword overlap, and source relevance.
4. Local semantic scoring compares the question embedding to stored chunk embeddings. This is not full vector database search.
5. If no chunks are found, the app does not call OpenAI and returns a PDF-only refusal.
6. If chunks are found, the server sends only those excerpts to OpenAI.
7. The model is instructed to answer only from the retrieved PDF excerpts.
8. The API returns the answer, retrieved source previews, retrieval mode, scores, and structured citations.

The tutor must refuse requests that ask it to ignore PDFs, use outside knowledge, skip citations, or invent unsupported Spanish content.

## Local Semantic Scoring

Embeddings are stored as JSON on `SpanishSourceChunk` rows in the local SQLite database. This is acceptable for local-first MVP development and a small PDF library because it keeps setup simple and portable.

This is local semantic scoring over stored chunk embeddings, not full vector database search. It may become slow with a large library because the app scans stored SQLite embeddings in application code. A real vector database or vector extension can be considered later if the source library grows.

Use `/settings` to check embedding coverage and backfill chunks in small batches. Backfilling calls the OpenAI embeddings API and uses API credits. Full-library embedding should only be run intentionally in batches; there is no one-click full-library embed button.

To enable embeddings, add an `OPENAI_API_KEY` to `.env.local` that has permission to use `text-embedding-3-small` or the model configured by `OPENAI_EMBEDDING_MODEL`. Run a dry run first, then intentionally embed only `10` chunks at a time.

Safety controls:

- Default backfill requests embed only `10` chunks.
- The server hard-caps each request at `100` chunks, even if a larger limit is passed.
- Embedding all remaining chunks requires an explicit `limit`; no-limit requests cannot silently finish the whole library.
- Dry runs count the next batch and return sample chunk/page references without calling OpenAI or writing to the database.
- The endpoint returns `remainingCount` so more batches can be run intentionally.

Available endpoints:

- `GET /api/sources/embeddings/status`
- `POST /api/sources/embeddings/backfill` with `{ "limit": 10, "dryRun": true }`
- `POST /api/sources/embeddings/backfill` with `{ "limit": 10 }` only after approving a real API-credit-using batch

The chat API reports one of these retrieval modes:

- `hybrid`: local semantic scoring was used alongside the keyword retrieval path.
- `keyword`: local semantic scoring was unavailable, incomplete, or not useful for the query.
- `none`: no usable source chunks were retrieved.

Chat responses also include `semanticRetrievalUsed` so the UI can show whether stored embeddings affected the latest answer.

## Citations

Successful tutor answers include structured citations with:

- PDF file name
- page number
- document id
- page id
- chunk id
- snippet preview

The visible citation label format is `File Name, page X`.

## Grammar-First Daily Curriculum

The `/learn` route now prefers a generated PDF-derived curriculum when imported PDF chunks exist. The original 8-week seed roadmap remains the safe fallback when no PDFs are imported yet or no generated curriculum has been built.

- The fallback seed contains 8 weeks, 5 daily lessons per week, and 40 daily lesson shells total.
- The PDF-derived curriculum can expand beyond 8 weeks because it creates lesson shells from imported PDF page ranges.
- Generated weeks use the same pattern: 5 daily lessons, a review day, and a weekly assessment gate.
- Each daily lesson is structured as 20 minutes: 5 minutes vocabulary, 5 minutes grammar, 7 minutes sentence practice, and 3 minutes challenge.
- Week 2 and later remain locked until the previous week's five lessons, review day, and assessment pass are recorded.
- Progress is stored in browser `localStorage` for the MVP because no Prisma progress model exists yet.
- Real Spanish lesson content is generated only after retrieval finds supporting uploaded PDF chunks.
- If no PDFs are imported, that is not a failure. The fallback 8-week curriculum should still work, and full PDF-derived curriculum testing requires imported PDFs.

The curriculum source hook is `getLessonSourceContext(lesson)` in `src/lib/curriculum/source-context.ts`. It prepares future lesson generation by retrieving local PDF chunks and converting them into file/page source references. The hook must not be used to generate Spanish teaching content unless the retrieved PDFs support that content.

## PDF-Derived Curriculum Generation

The generated curriculum system creates lesson shells only. It does not call OpenAI, does not generate full lesson content, and does not store raw PDFs or copied full page text in the curriculum tables.

Before lesson shells are created, each extracted PDF page is classified locally with deterministic rules. The classifier assigns a 0-100 instructional score and one of these page types: instructional, review, exercise, vocabulary, grammar, culture_or_reading, front_matter, table_of_contents, license_or_credits, answer_key, appendix, index_or_glossary, bibliography, or unknown.

Only instructional page types that meet the threshold are eligible for generated curriculum shells. Front matter, tables of contents, license/credit pages, answer keys, appendices, indexes/glossaries, bibliographies, and unknown/low-signal pages are excluded before page ranges are grouped into lessons. The grouping prefers chapter, unit, lesson, and section boundaries and keeps lesson source windows small.

Generated lesson shells include:

- stable `lessonId`, global `dayNumber`, `weekNumber`, and `dayInWeek`
- section title, lesson title, grammar focus, vocabulary focus, and 20-minute estimate
- source document ids, page start/end, and file/page citation references
- retrieval query, build dependencies, mastery goals, and content generation status

Use `/learn` to run a dry run or build/rebuild the PDF-derived shell roadmap. Dry runs do not write to the database; they return pages scanned, included/excluded counts, classification summaries, sample included/excluded pages, generated section/week/lesson counts, warnings, and `usedOpenAI: false`. The build button is disabled until imported PDF chunks exist. Full daily lesson content remains on-demand at `/learn/day/[dayNumber]` or `/learn/lesson/[lessonId]`.

`GET /api/curriculum/status` reports total source pages, instructional pages included, non-instructional pages excluded, last generation mode, classification summary, current lesson count, warnings, and whether the active curriculum was built with page filtering.

If no PDFs are imported, that is not a failure. The app should keep the fallback 8-week curriculum active and report that full PDF-derived curriculum testing requires imported PDFs. Do not use fake textbook data to simulate PDF-derived Spanish lessons.

Available curriculum endpoints:

- `GET /api/curriculum/status`
- `POST /api/curriculum/generate` with `{ "dryRun": true }`
- `POST /api/curriculum/generate` after PDFs are imported to persist shell records
- `GET /api/curriculum`
- `GET /api/curriculum/lessons`
- `GET /api/curriculum/lessons/[lessonId]`

## Daily Lesson Generation

The daily lesson page at `/learn/day/[dayNumber]` now calls `generateDailyLesson(dayNumber)` on the server. The generator:

- Loads daily lesson metadata from the active PDF-derived generated shell when available, otherwise from the 8-week seed fallback.
- Uses generated shell source references first when they exist, so generated lessons retrieve from their cited page windows before any broader lookup.
- Builds a retrieval query from the lesson title, week number, grammar focus, vocabulary focus, family communication goal, and dependency metadata when seed fallback retrieval is needed.
- Uses existing hybrid retrieval over `SpanishSourceChunk` records, falling back to keyword retrieval when local semantic scoring over stored chunk embeddings is unavailable.
- Returns a safe missing-source warning without calling the OpenAI lesson generator if no relevant chunks are found.
- Calls OpenAI only after PDF chunks are found and sends only the retrieved excerpts as lesson context.
- Uses `src/lib/prompts/daily-lesson-generation-prompt.ts` to require PDF-only JSON output.
- Displays the 5-minute vocabulary warm-up, 5-minute grammar concept, 7-minute sentence-building practice, and 3-minute typed/speak-aloud challenge only from the generated structured response.
- Requires every generated block, vocabulary item, practice item, and challenge to carry file/page citations.

The app does not persist generated lessons yet. Regeneration reruns retrieval against the current PDF library and then calls OpenAI only if retrieved chunks are available. No raw PDF text or large copied source passages are stored in generated lesson output.

If the imported PDFs do not support a lesson section, the page shows `Not enough PDF support found` and keeps the placeholder/safe warning state rather than inventing content from model knowledge.

Weekly assessment APIs are placeholders only. They do not call OpenAI and do not perform real grading yet. Future assessment prompts, feedback, grading rationale, and progression decisions must use only uploaded PDF context and cite file/page references.

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
| `/learn` | Grammar-first roadmap that prefers PDF-derived generated shells and falls back to the 8-week seed plan. |
| `/learn/day/[dayNumber]` | Daily 20-minute lesson page with PDF-grounded generation, citations, warnings, regeneration, and local completion. |
| `/learn/lesson/[lessonId]` | Direct generated curriculum lesson shell route for PDF-derived lessons. |
| `/learn/week/[weekNumber]/assessment` | Weekly assessment placeholder with local pass/fail flow for progression testing. |
| `/practice` | Practice mode surface tied to roadmap, chat, and assessment prep placeholders. |
| `/chat` | Retrieval-grounded Spanish tutor chat. |
| `/settings` | API, database, retrieval, and chat readiness status. |
| `/api/sources/upload` | Upload and extract PDF source files. |
| `/api/sources` | List imported source documents. |
| `/api/sources/[id]` | Load one source document. |
| `/api/sources/[id]/pages` | Load extracted pages for one source document. |
| `/api/sources/search` | Keyword search across extracted source chunks. |
| `/api/sources/embeddings/status` | Returns local embedding coverage and local semantic scoring readiness. |
| `/api/sources/embeddings/backfill` | Dry-runs or embeds a capped batch of missing source chunks without exposing secrets. |
| `/api/agent/status` | Returns safe agent/source/chat status without exposing secrets. |
| `/api/agent/chat` | Server-side retrieval-grounded tutor chat endpoint. |
| `/api/curriculum/status` | Returns seed/PDF-derived curriculum status and source readiness. |
| `/api/curriculum/generate` | Dry-runs or persists deterministic PDF-derived lesson shells without calling OpenAI. |
| `/api/curriculum` | Returns the active generated curriculum when available plus fallback seed metadata. |
| `/api/curriculum/lessons` | Lists generated curriculum lesson shells. |
| `/api/curriculum/lessons/[lessonId]` | Returns one generated curriculum lesson shell. |
| `/api/lessons/day/[dayNumber]` | Generates and returns one PDF-grounded daily lesson or a safe missing-source warning. |
| `/api/lessons/day/[dayNumber]/regenerate` | POST route that reruns retrieval and generation for the current PDF library. |
| `/api/assessment/start` | Starts a weekly assessment placeholder without calling OpenAI. |
| `/api/assessment/message` | Records an assessment placeholder message without generating Spanish content. |
| `/api/assessment/grade` | Records a local placeholder pass/fail result for progression testing. |

## Database Models

Prisma uses SQLite for local development and defines:

- `SpanishSourceDocument`: source PDF metadata, local path, SHA-256 hash, page count, processing status, extraction method, and processing errors.
- `SpanishSourcePage`: one row per PDF page with page number, extracted text, extraction method, and character count.
- `SpanishSourceChunk`: page-level text chunks for retrieval, with document/page references, chunk indexes, optional embedding JSON stored in SQLite, embedding model metadata, and embedding error state.
- `GeneratedCurriculum`: one active PDF-derived shell roadmap with source coverage counts and page-filtering metadata.
- `GeneratedCurriculumSection`: source-backed sections, usually aligned to imported PDF documents.
- `GeneratedCurriculumLesson`: generated lesson shells with source references, page windows, retrieval query, dependencies, and content generation status.
- `GeneratedCurriculumRun`: dry-run and persisted generation run metadata. Runs record counts, page-filtering summaries, and status only, not raw PDF content.

Useful indexes are included for file hashes, document/page lookups, page numbers, chunk relationships, embedding backfill status, generated day numbers, generated week numbers, and generated lesson ids.

## Inspecting Imported Sources

- Use `/library` to see all imported PDFs, processing status, page counts, extraction method, created date, and chunk count.
- Use `/library/[id]` to inspect extracted page previews and citation labels like `File Name, page X`.
- Use the search panel on `/library` for basic keyword search across extracted chunks.

## Source-Grounded Architecture

- `src/lib/sources` contains PDF storage, extraction, chunking, keyword retrieval, local semantic scoring over stored chunk embeddings, embedding backfill, search, citation utilities, and source database helpers.
- `src/lib/curriculum` contains the eight-week grammar-first seed map, deterministic PDF page classifier, generated PDF-derived curriculum service, local progress/locking helpers, and source-context hooks for lessons and assessments.
- `src/lib/agent` contains OpenAI client setup, embedding helpers, agent readiness helpers, and the PDF-grounded daily lesson generator.
- `src/lib/prompts` contains the PDF-only guardrail prompt draft and strict daily lesson generation prompt.
- `src/types` contains shared source, lesson, practice, citation, and agent response types.

## Current Limitations

- Local semantic scoring currently scans JSON embeddings stored in SQLite. This is fine for a small PDF library, but a dedicated vector index may be useful after the source library grows.
- PDF curriculum page filtering is deterministic and conservative. Review dry-run included/excluded samples after importing new sources, especially for unusual textbook layouts.
- Embeddings are backfilled manually from `/settings`; automatic embedding on upload is not implemented yet.
- The tutor has no long-term chat memory.
- Daily lesson quality depends on imported PDFs and retrieval quality. Weak or missing source coverage creates warnings instead of generated Spanish content.
- Full generated-curriculum testing requires imported PDFs. A no-PDF library should report `no_sources` and keep the seed fallback working.
- Generated daily lessons are not persisted yet; page load and regeneration can rerun retrieval and generation.
- Generated curriculum shells are persisted in SQLite, but full lesson content is not bulk-generated.
- Weekly assessment content is still placeholder-gated. Real assessment prompts and grading must wait for PDF-supported generation.
- Curriculum progress is stored in browser `localStorage`, not SQLite, until a future progress model is added.
- OCR is not implemented for scanned pages with no extractable text.

## Future Roadmap

- Add automatic embedding after successful PDF upload.
- Add a vector database or vector extension if SQLite scanning becomes too slow.
- Add curriculum rebuild options that can target selected PDFs or page ranges.
- Add lightweight generated lesson caching if repeated generation becomes too slow or expensive.
- Add persistent progress tracking if localStorage becomes too limited.
- Improve retrieval ranking with page/section metadata.
- Add source-backed practice sessions and review history.
- Add source-backed conversation drills and spaced review.

## Quality Commands

```bash
npm run lint
npm run typecheck
npm run build
```

## API Smoke Tests

API smoke tests are sufficient if browser automation cannot reach localhost.

Recommended checks:

- `GET /api/agent/status`
- `GET /api/curriculum/status`
- `GET /api/curriculum`
- `GET /api/curriculum/lessons`
- `POST /api/curriculum/generate` with `{ "dryRun": true }`
- `GET /api/sources/embeddings/status`
- `GET /api/lessons/day/1`
- `POST /api/lessons/day/1/regenerate` only when you intentionally want to rerun lesson generation from current PDF sources
- `POST /api/sources/embeddings/backfill` with `{ "limit": 10, "dryRun": true }`
- `POST /api/sources/embeddings/backfill` with `{ "limit": 10 }` only after approving a real API-credit-using batch
- `POST /api/assessment/start` with `{ "weekNumber": 1 }`
- `POST /api/assessment/message` with `{ "weekNumber": 1, "messages": [] }`
- `POST /api/assessment/grade` with `{ "weekNumber": 1, "placeholderResult": "pass" }`

## Manual Curriculum Checks

- With no PDFs imported, open `/learn` and confirm the 8-week seed fallback works; this is a valid safe state, not a failure.
- With no PDFs imported, confirm `POST /api/curriculum/generate` returns `no_sources` or the UI reports that imported PDF chunks are required.
- After PDFs are imported, run a curriculum dry run and then intentionally build/rebuild generated lesson shells from `/learn`.
- Confirm dry-run output reports scanned, included, excluded, classification summary, sample included pages, sample excluded pages, generated section/week/lesson counts, warnings, and `usedOpenAI: false`.
- Confirm title pages, license/credits pages, front matter, tables of contents, answer keys, appendices, indexes/glossaries, and bibliography/reference pages are excluded from generated lesson shells when those pages are present in imported PDFs.
- Confirm `/api/curriculum/status`, `/learn`, and `/settings` show page-filtering counts after a dry run or rebuild.
- Confirm generated lesson shells are based on source document/page references and do not bulk-generate full Spanish lesson content.
- Open `/learn` and confirm week 1 day 1 is available while later lessons are gated.
- Open `/learn/day/1`, mark the lesson complete, and confirm day 2 becomes available on the roadmap.
- Confirm `/api/lessons/day/1` returns either PDF-grounded generated content with citations or a safe missing-source warning.
- If generated curriculum exists, open `/learn/lesson/[lessonId]` for one generated lesson shell.
- Confirm generated lesson blocks show citation labels like `File Name, page X` when sources are found.
- Confirm a no-source lesson state does not display invented Spanish content.
- Complete all five week 1 lesson shells, mark the week 1 review done, and confirm `/learn/week/1/assessment` can start.
- Record a placeholder fail and confirm week 2 remains locked.
- Record a placeholder pass and confirm week 2 unlocks locally.
- Open `/practice`, `/chat`, and `/settings` and confirm they reference the roadmap without bypassing locks or PDF-only content rules.
