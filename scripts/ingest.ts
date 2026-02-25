import { env } from "../src/lib/env";

async function main() {
  env.OPENAI_API_KEY();
  env.PINECONE_API_KEY();
  const index = env.PINECONE_INDEX();
  const namespace = env.PINECONE_NAMESPACE();
  console.log(`[ingest] Pinecone index: ${index} | namespace: ${namespace}`);
  console.log("[ingest] Phase 2: will read data/scraped.json -> embed each chunk -> upsert vectors to Pinecone");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
