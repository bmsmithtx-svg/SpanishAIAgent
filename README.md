# SpanishAIAgent

SpanishAIAgent is a dark-themed, local-first study app foundation for PDF-grounded everyday Spanish learning. The app is designed for practical family communication and will eventually connect to an OpenAI API-powered tutor agent.

## Strict PDF-Only Rule

All Spanish teaching content, examples, grammar explanations, vocabulary, lessons, practice questions, cultural notes, and tutor answers must come only from uploaded Spanish PDF sources. If the uploaded PDFs do not support an answer, the future agent must say that the PDFs do not contain enough information.

For this first version, all learning areas are placeholders. No Spanish curriculum has been generated or imported.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env.local
   ```

3. Add local-only values to `.env.local` as needed. Do not commit real secrets.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open the app at [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Future server-side OpenAI API key. The current app only checks whether it exists. |
| `DATABASE_URL` | Future local or hosted database connection string. |
| `NEXT_PUBLIC_APP_NAME` | Public app name shown in API status responses. Defaults to `SpanishAIAgent`. |

## Current Routes

| Route | Purpose |
| --- | --- |
| `/` | Dashboard with source-grounded learning placeholders. |
| `/library` | PDF source library placeholder. |
| `/learn` | Lesson roadmap placeholder. |
| `/practice` | Practice mode placeholder. |
| `/chat` | Future Spanish tutor agent placeholder. |
| `/settings` | API and readiness status placeholder. |
| `/api/agent/status` | Returns safe agent configuration status without exposing secrets. |
| `/api/agent/chat` | Placeholder chat endpoint returning a not implemented response. |

## Source-Grounded Architecture

- `src/lib/sources` is reserved for PDF parsing, page extraction, indexing, and retrieval.
- `src/lib/agent` is reserved for future OpenAI agent orchestration.
- `src/lib/prompts` contains the PDF-only guardrail prompt draft.
- `src/types` contains shared source, lesson, practice, citation, and agent response types.

## Future Roadmap

- Add a PDF upload and ingestion workflow.
- Extract page-level source records with file names and page numbers.
- Add retrieval over uploaded PDF pages.
- Connect a server-side OpenAI API agent route.
- Require every lesson, explanation, example, and answer to include PDF file/page citations.
- Add progress tracking, practice sessions, and review history.

## Quality Commands

```bash
npm run lint
npm run typecheck
npm run build
```
