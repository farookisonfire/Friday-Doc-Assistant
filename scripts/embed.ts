import * as fs from "fs";
import * as path from "path";
import type { Chunk } from "../src/lib/types";
import {
  chunkArray,
  createSemaphore,
  embedBatch,
  loadCache,
  saveCache,
} from "../src/lib/embeddings";
import { env } from "../src/lib/env";

function dataPath(file: string): string {
  return path.join(process.cwd(), "data", file);
}

async function main() {
  const chunksPath = dataPath("chunks.json");
  const cachePath = dataPath("embeddings_cache.json");
  const outPath = dataPath("embedded_chunks.json");

  if (!fs.existsSync(chunksPath)) {
    throw new Error(`chunks.json not found at ${chunksPath} — run npm run ingest first`);
  }

  const chunks: Chunk[] = JSON.parse(fs.readFileSync(chunksPath, "utf8"));
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error("chunks.json is empty or malformed");
  }
  console.log(`[embed] Loaded ${chunks.length} chunks`);

  const cache = loadCache(cachePath);
  const model = env.OPENAI_EMBEDDING_MODEL();
  const batchSize = env.EMBED_BATCH_SIZE();
  const concurrency = env.EMBED_CONCURRENCY();

  const missing = chunks.filter((c) => !cache[`${model}:${c.content_hash}`]);
  console.log(`[embed] ${missing.length} chunks need embedding (${chunks.length - missing.length} cached)`);

  const batches = chunkArray(chunks, batchSize);
  const sem = createSemaphore(concurrency);

  const results = await Promise.all(
    batches.map((batch, i) =>
      sem(async () => {
        const embedded = await embedBatch(batch, cache, model);
        console.log(`[embed] Batch ${i + 1}/${batches.length} done (${batch.length} chunks)`);
        return embedded;
      })
    )
  );

  const embedded = results.flat();

  fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(embedded, null, 2), "utf8");
  saveCache(cachePath, cache);

  console.log(`[embed] Wrote ${embedded.length} embedded chunks to ${outPath}`);
  console.log(`[embed] Cache has ${Object.keys(cache).length} entries`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
