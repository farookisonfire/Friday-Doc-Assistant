import * as fs from "fs";
import { getOpenAIClient } from "./openai";
import { env } from "./env";
import type { Chunk, EmbeddedChunk } from "./types";

export type EmbeddingsCache = Record<string, number[]>;

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function createSemaphore(max: number) {
  let count = 0;
  const queue: Array<() => void> = [];

  return async function withPermit<T>(fn: () => Promise<T>): Promise<T> {
    if (count >= max) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    count++;
    try {
      return await fn();
    } finally {
      count--;
      const next = queue.shift();
      if (next) next();
    }
  };
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err: unknown) {
      attempt++;
      const status =
        (err as { status?: number })?.status ??
        (err as { response?: { status?: number } })?.response?.status;
      const retryable = status === 429 || (typeof status === "number" && status >= 500 && status <= 599);
      if (!retryable || attempt > retries) throw err;
      const backoffMs = Math.min(30_000, 500 * Math.pow(2, attempt - 1));
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

export function makeEmbedText(chunk: Chunk): string {
  const headings = (chunk.headings ?? []).join("\n");
  return [chunk.title, headings, chunk.text].filter(Boolean).join("\n");
}

export function cacheKey(model: string, chunk: Chunk): string {
  return `${model}:${chunk.content_hash}`;
}

export function loadCache(filePath: string): EmbeddingsCache {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function saveCache(filePath: string, cache: EmbeddingsCache): void {
  fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), "utf8");
}

export async function embedBatch(
  chunks: Chunk[],
  cache: EmbeddingsCache,
  model?: string
): Promise<EmbeddedChunk[]> {
  const resolvedModel = model ?? env.OPENAI_EMBEDDING_MODEL();
  const client = getOpenAIClient();

  const missing = chunks.filter((c) => !cache[cacheKey(resolvedModel, c)]);

  if (missing.length > 0) {
    const inputs = missing.map(makeEmbedText);
    const resp = await withRetry(() =>
      client.embeddings.create({ model: resolvedModel, input: inputs })
    );
    resp.data.forEach((row, i) => {
      cache[cacheKey(resolvedModel, missing[i])] = row.embedding;
    });
  }

  return chunks.map((c) => ({
    ...c,
    embedding_model: resolvedModel,
    embedding: cache[cacheKey(resolvedModel, c)],
  }));
}
