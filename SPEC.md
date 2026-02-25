# Friday Doc Assistant

## Overview

Friday Doc Assistant is a grounded documentation assistant built over [Friday's public docs](https://www.codewithfriday.com/docs). It combines structured retrieval, source citation, and end-to-end trace logging to demonstrate what a production-grade applied AI system looks like beyond simply calling an LLM.

The system is designed to answer questions using only retrieved documentation context, cite every factual claim with a verifiable source, and produce observable, reproducible runs.

---

## Goals

- Answer questions using **only** Friday docs context
- Provide **verifiable citations** — inline footnotes with a Sources list per response
- Make every run **observable and reproducible** via LangSmith and a custom trace logger
- Support an **evaluation harness** to measure and track retrieval quality and grounding over time
- Lay a foundation for **tool-augmented workflows**

## Non-goals

- General web browsing or arbitrary internet search
- Fine-tuning or training custom models
- Answering questions outside the Friday docs corpus without explicit acknowledgment

---

## Tech Stack

| Technology | Role | Why |
|---|---|---|
| **TypeScript** | End-to-end language | Type safety across ingestion, retrieval, eval, and UI catches integration errors early |
| **Next.js (App Router)** | Full-stack framework | Fast iteration, file-based routing, natural fit for Vercel deployment |
| **OpenAI** | LLM + embeddings | Raw API calls give full control over prompting and grounding mechanics |
| **Pinecone** | Vector store | Managed index with predictable operational behavior and metadata filtering |
| **LangSmith** | Observability | Run-level tracing, prompt comparisons, and dataset management |
| **Cheerio** | HTML scraping | Deterministic server-side HTML parsing — no headless browser needed |
| **Tailwind CSS** | UI styling | Rapid iteration without context-switching to a separate stylesheet |

---

## Architecture

### Ingestion Pipeline

```
Scrape → Verify → Ingest
```

1. **Scrape** — Fetch docs HTML, extract title, headings, and body text, preserve canonical URL and section anchors. Output: `data/scraped.json`
2. **Verify** — Sanity checks: empty pages, duplicates, broken links, token length outliers. Output: human-reviewable report before anything touches Pinecone
3. **Ingest** — Chunk text → embed with OpenAI → upsert vectors to Pinecone with metadata:
   - `url`, `title`, `headings`, `chunk_index`, `content_hash`, `created_at`

Keeping these as separate scripts means any step can be re-run independently without side effects.

### Query → Answer Pipeline (RAG)

```
User query
  → Embed query (OpenAI)
  → Pinecone topK retrieval (+ optional metadata filters)
  → Score / rerank retrieved chunks
  → Assemble prompt (system rules + excerpts + citation format)
  → OpenAI completion
  → Response with inline footnotes + Sources list
  → Trace log (retrieval inputs/outputs, prompt, tokens, citation map, scores)
```

### Citation Format

Responses use inline footnotes with a trailing Sources list:

```
Friday supports document processing and structuring [1].

Sources:
[1] https://www.codewithfriday.com/docs/document-processing — "Document Processing"
```

---

## Key Engineering Decisions

### Raw API calls over a framework (e.g. LangChain)
**Decision**: Call OpenAI and Pinecone directly.
**Tradeoff**: More code to write, but full visibility into every step. No magic abstractions hiding retrieval behavior or prompt construction. Easier to debug, easier to reason about grounding failures.

### Separate scrape / verify / ingest steps
**Decision**: Three distinct scripts rather than one end-to-end pipeline.
**Tradeoff**: Slightly more orchestration, but each step is independently re-runnable and inspectable. Verification before ingestion prevents bad data from reaching the vector store.

### Grounding-first prompting
**Decision**: The system prompt instructs the model to answer only from retrieved context, and to explicitly say it doesn't know if context is insufficient.
**Tradeoff**: Occasionally more conservative answers, but eliminates hallucinated claims about Friday's product.

### Custom eval scoring functions
**Decision**: Build retrieval recall, grounding score, and citation accuracy from scratch rather than using an off-the-shelf eval library.
**Tradeoff**: More upfront work, but forces a precise understanding of what each metric actually measures and makes the scoring logic fully auditable.

### Correlation IDs on every request
**Decision**: Every query generates a `trace_id` that flows through retrieval, prompting, and the response.
**Tradeoff**: Small overhead, but makes it possible to replay any request exactly and correlate LangSmith traces with local logs.

---

## Phases

### Phase 1 — Project Setup (`#1`)
**Deliverables**: Next.js app scaffolded, env validation, placeholder scripts, `.env.example`
**Acceptance criteria**: Dev server runs; `npm run scrape|ingest|eval` validate env vars and exit cleanly; `tsc --noEmit` passes

### Phase 2 — Doc Ingestion Pipeline (`#2`)
**Deliverables**: `scripts/scrape.ts`, `scripts/ingest.ts`, `data/scraped.json`, Pinecone index populated
**Acceptance criteria**: All Friday docs pages scraped and verified; chunks upserted to Pinecone with correct metadata; re-running ingest is idempotent

### Phase 3 — Core RAG Layer (`#3`)
**Deliverables**: `src/lib/retrieval.ts`, `src/lib/prompt.ts`, citation formatting
**Acceptance criteria**: Queries return grounded answers with ≥1 citation for factual claims; model refuses or flags when context is insufficient

### Phase 4 — Custom Trace Logger (`#4`)
**Deliverables**: `src/lib/tracer.ts`, LangSmith integration, `trace_id` on every request
**Acceptance criteria**: Every request has a `trace_id`; retrieval inputs/outputs, prompt, token usage, and scores are logged; traces visible in LangSmith

### Phase 5 — API Route + Chat UI (`#5`)
**Deliverables**: `src/app/api/chat/route.ts`, chat UI
**Acceptance criteria**: User can ask a question and see a grounded response with citations; errors surface actionable messages

### Phase 6 — Evaluation Harness (`#6`)
**Deliverables**: `scripts/eval.ts`, fixed question dataset, scoring functions
**Acceptance criteria**: `npm run eval` produces a comparable JSON report; retrieval recall, grounding score, and citation accuracy are measured; results are reproducible across runs

### Phase 7 — Deploy to Vercel (`#7`)
**Deliverables**: Production deployment, env vars configured, basic monitoring
**Acceptance criteria**: Publicly accessible URL; ingestion not required at runtime; p95 latency is acceptable

---

## Local Development

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                  # starts Next.js at http://localhost:3000
```

### Required environment variables

| Variable | Used by |
|---|---|
| `OPENAI_API_KEY` | Embeddings + completions |
| `PINECONE_API_KEY` | Vector store reads/writes |
| `PINECONE_INDEX` | Target Pinecone index name |
| `PINECONE_NAMESPACE` | Namespace within the index |
| `LANGSMITH_API_KEY` | Trace logging |
| `DOCS_BASE_URL` | Scraper entry point |

### Scripts

```bash
npm run scrape   # scrape Friday docs -> data/scraped.json
npm run ingest   # embed + upsert chunks to Pinecone
npm run eval     # run evaluation harness -> eval/results/
```

---

## Evaluation & Reproducibility

The eval harness runs a fixed set of questions against the live retrieval + generation pipeline and scores each response on three dimensions:

- **Retrieval recall** — did the relevant chunks surface in the top K results?
- **Grounding score** — is the answer supported by the retrieved context?
- **Citation accuracy** — do the cited URLs exist and match the claim?

Results are written to `eval/results/` as JSON and logged to LangSmith for cross-run comparison. The question dataset is committed to the repo so results are reproducible across different retrieval configs and prompt versions.

---

## What I Learned

_A running log — updated as the project evolves._

<!--
Template:
### YYYY-MM-DD — [topic]
- **Observation**:
- **What caused it**:
- **What I changed**:
- **Result**:
- **Next experiment**:
-->
