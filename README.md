# Friday Doc Assistant

A grounded documentation assistant built over [Friday's public docs](https://www.codewithfriday.com/docs). Ask a question, get an answer backed by real sources — every factual claim is cited with a link to the relevant doc page.

For full project spec and architecture decisions, see [`SPEC.md`](./SPEC.md).

---

## How it works

```
Docs site → scrape → chunk → embed → Pinecone
                                          ↓
                          User question → embed → retrieve top-K chunks
                                                        ↓
                                              Assemble prompt → OpenAI
                                                        ↓
                                              Answer with citations → UI
```

### Layers

| Layer | Location | Description |
|---|---|---|
| **Ingestion** | `scripts/` | Scrape, chunk, embed, and upsert docs to Pinecone |
| **Shared utilities** | `src/lib/` | Env validation, OpenAI client, Pinecone client, embeddings, shared types |

---

## Tech stack

| Technology | Role |
|---|---|
| **Next.js (App Router)** | Full-stack framework — API routes + chat UI |
| **TypeScript** | End-to-end type safety across ingestion, retrieval, and UI |
| **OpenAI** | Embeddings (`text-embedding-3-small`) + chat completions |
| **Pinecone** | Managed vector store for similarity search |
| **Cheerio** | Server-side HTML scraping — no headless browser needed |
| **Vitest** | Unit testing |
| **LangSmith** | Trace logging and evaluation |
| **Tailwind CSS** | UI styling |

---

## Setup

### Prerequisites

- Node.js 20.9+
- A [Pinecone](https://www.pinecone.io/) account with an index created
- An [OpenAI](https://platform.openai.com/) API key
- A [LangSmith](https://smith.langchain.com/) API key (optional — for tracing)

### Install

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Description |
|---|---|
| `DOCS_BASE_URL` | Root URL of the documentation site to scrape |
| `OPENAI_API_KEY` | OpenAI API key |
| `PINECONE_API_KEY` | Pinecone API key |
| `PINECONE_INDEX` | Name of your Pinecone index |
| `PINECONE_NAMESPACE` | Namespace within the index |
| `LANGSMITH_API_KEY` | LangSmith API key |

### Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

### Ingestion pipeline

Run these once (or whenever the docs change) to populate Pinecone:

```bash
npm run scrape    # Crawl the docs site → data/scraped.json
npm run ingest    # Chunk scraped pages → data/chunks.json
npm run embed     # Embed chunks via OpenAI → data/embedded_chunks.json
npm run upsert    # Upsert embedded chunks to Pinecone
```

Each step is independent — you can re-run any one without repeating the others.

### Development

```bash
npm run dev           # Start Next.js dev server at http://localhost:3000
npm run build         # Production build
npm start             # Start production server
npm run lint          # Run ESLint
```

### Testing

```bash
npm test              # Run all tests once
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

### Evaluation

```bash
npm run eval          # Run the evaluation harness → eval/results/
```
