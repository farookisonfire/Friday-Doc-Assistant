import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import {
  chunkArray,
  createSemaphore,
  withRetry,
  makeEmbedText,
  cacheKey,
  loadCache,
  saveCache,
  embedBatch,
} from "../embeddings";
import { getOpenAIClient } from "../openai";
import type { Chunk } from "../types";

vi.mock("fs");
vi.mock("../openai", () => ({
  getOpenAIClient: vi.fn(),
}));
vi.mock("../env", () => ({
  env: {
    OPENAI_EMBEDDING_MODEL: vi.fn().mockReturnValue("text-embedding-3-small"),
  },
}));

const mockChunk = (overrides: Partial<Chunk> = {}): Chunk => ({
  id: "chunk-1",
  text: "Hello world",
  url: "https://example.com/page",
  title: "Example Page",
  headings: ["Section One"],
  chunk_index: 0,
  content_hash: "abc123",
  created_at: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

describe("chunkArray", () => {
  it("splits an array into chunks of the given size", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single chunk when array is smaller than size", () => {
    expect(chunkArray([1, 2], 5)).toEqual([[1, 2]]);
  });

  it("returns empty array for empty input", () => {
    expect(chunkArray([], 3)).toEqual([]);
  });

  it("handles exact multiples", () => {
    expect(chunkArray([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });
});

describe("createSemaphore", () => {
  it("allows up to max concurrent tasks", async () => {
    const withPermit = createSemaphore(2);
    let active = 0;
    let maxActive = 0;

    const task = () =>
      withPermit(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 10));
        active--;
      });

    await Promise.all([task(), task(), task(), task()]);
    expect(maxActive).toBe(2);
  });

  it("resolves all tasks even when queued", async () => {
    const withPermit = createSemaphore(1);
    const results: number[] = [];
    await Promise.all(
      [1, 2, 3].map((n) => withPermit(async () => { results.push(n); }))
    );
    expect(results).toEqual([1, 2, 3]);
  });
});

describe("withRetry", () => {
  it("returns result immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 status and eventually succeeds", async () => {
    const err = { status: 429 };
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValue("ok");

    vi.useFakeTimers();
    const promise = withRetry(fn, 5);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("does not retry on 400 status", async () => {
    const err = { status: 400 };
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, 3)).rejects.toEqual(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry on insufficient_quota 429", async () => {
    const err = { status: 429, code: "insufficient_quota" };
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, 3)).rejects.toEqual(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 500 status", async () => {
    const err = { status: 500 };
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue("recovered");

    vi.useFakeTimers();
    const promise = withRetry(fn, 5);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("throws after exhausting retries", async () => {
    const err = { status: 503 };
    const fn = vi.fn().mockRejectedValue(err);

    vi.useFakeTimers();
    const promise = withRetry(fn, 2);
    const assertion = expect(promise).rejects.toEqual(err);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});

describe("makeEmbedText", () => {
  it("joins title, headings, and text", () => {
    const chunk = mockChunk({ title: "Title", headings: ["H1", "H2"], text: "Body" });
    expect(makeEmbedText(chunk)).toBe("Title\nH1\nH2\nBody");
  });

  it("handles empty headings array", () => {
    const chunk = mockChunk({ title: "Title", headings: [], text: "Body" });
    expect(makeEmbedText(chunk)).toBe("Title\nBody");
  });
});

describe("cacheKey", () => {
  it("is deterministic for the same input", () => {
    const chunk = mockChunk();
    expect(cacheKey("model-a", chunk)).toBe(cacheKey("model-a", chunk));
  });

  it("differs for different models", () => {
    const chunk = mockChunk();
    expect(cacheKey("model-a", chunk)).not.toBe(cacheKey("model-b", chunk));
  });

  it("differs for different chunk content", () => {
    const a = mockChunk({ text: "Hello" });
    const b = mockChunk({ text: "World" });
    expect(cacheKey("model-a", a)).not.toBe(cacheKey("model-a", b));
  });

  it("includes the model name as a prefix", () => {
    const chunk = mockChunk();
    expect(cacheKey("my-model", chunk)).toMatch(/^my-model:/);
  });
});

describe("loadCache", () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.readFileSync).mockReset();
  });

  it("returns empty object when file does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(loadCache("/some/path.json")).toEqual({});
  });

  it("parses and returns cache from file", () => {
    const data = { "key1": [0.1, 0.2] };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(data));
    expect(loadCache("/some/path.json")).toEqual(data);
  });
});

describe("saveCache", () => {
  it("writes JSON to the given file path", () => {
    const cache = { "key1": [0.1, 0.2] };
    saveCache("/some/path.json", cache);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/some/path.json",
      JSON.stringify(cache, null, 2),
      "utf8"
    );
  });
});

describe("embedBatch", () => {
  it("returns cached embeddings without calling the API", async () => {
    const mockCreate = vi.fn();
    vi.mocked(getOpenAIClient).mockReturnValue({
      embeddings: { create: mockCreate },
    } as never);

    const chunk = mockChunk();
    const model = "text-embedding-3-small";
    const key = cacheKey(model, chunk);
    const cache = { [key]: [0.1, 0.2, 0.3] };

    const result = await embedBatch([chunk], cache, model);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result[0].embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it("calls the API for uncached chunks and updates the cache", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      data: [{ embedding: [0.9, 0.8, 0.7] }],
    });
    vi.mocked(getOpenAIClient).mockReturnValue({
      embeddings: { create: mockCreate },
    } as never);

    const chunk = mockChunk({ text: "Uncached text" });
    const cache = {};

    const result = await embedBatch([chunk], cache, "text-embedding-3-small");

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result[0].embedding).toEqual([0.9, 0.8, 0.7]);
    expect(Object.keys(cache)).toHaveLength(1);
  });

  it("mixes cached and uncached chunks correctly", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      data: [{ embedding: [0.5, 0.5] }],
    });
    vi.mocked(getOpenAIClient).mockReturnValue({
      embeddings: { create: mockCreate },
    } as never);

    const model = "text-embedding-3-small";
    const cachedChunk = mockChunk({ id: "c1", text: "Cached" });
    const uncachedChunk = mockChunk({ id: "c2", text: "Uncached" });
    const cache = { [cacheKey(model, cachedChunk)]: [1.0, 0.0] };

    const result = await embedBatch([cachedChunk, uncachedChunk], cache, model);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result[0].embedding).toEqual([1.0, 0.0]);
    expect(result[1].embedding).toEqual([0.5, 0.5]);
  });
});
