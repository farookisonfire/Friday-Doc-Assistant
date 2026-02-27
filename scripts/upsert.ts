import * as fs from "fs/promises";
import { chunkArray } from "../src/lib/embeddings";
import { pineconeIndex } from "../src/lib/pinecone";
import type { EmbeddedChunk } from "../src/lib/types";

const FILE = "data/embedded_chunks.json";
const BATCH_SIZE = 100;

async function main() {
  const raw = await fs.readFile(FILE, "utf-8");
  const chunks = JSON.parse(raw) as EmbeddedChunk[];

  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error(`No embedded chunks found in ${FILE}`);
  }

  const dim = chunks[0]!.embedding.length;
  if (dim === 0) throw new Error("First chunk has no embedding values.");

  const mismatch = chunks.find((c) => c.embedding.length !== dim);
  if (mismatch) {
    throw new Error(`Embedding dimension mismatch for id=${mismatch.id}: expected ${dim}, got ${mismatch.embedding.length}`);
  }

  const vectors = chunks.map(({ id, embedding, ...metadata }) => ({
    id,
    values: embedding,
    metadata,
  }));

  console.log(`[upsert] Loaded ${vectors.length} vectors (dim=${dim})`);

  const index = pineconeIndex();
  const batches = chunkArray(vectors, BATCH_SIZE);

  for (const [i, batch] of batches.entries()) {
    await index.upsert({ records: batch });
    console.log(`[upsert] Batch ${i + 1}/${batches.length} done (${batch.length} vectors)`);
  }

  console.log(`[upsert] Done — upserted ${vectors.length} vectors to Pinecone`);
}

main().catch((err) => {
  console.error("[upsert] Error:", err);
  process.exit(1);
});
