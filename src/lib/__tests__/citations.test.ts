import { describe, it, expect, vi } from "vitest";
import { parseCitations, validateCitations, analyzeCitations } from "../citations";
import { REFUSAL_PHRASE } from "../prompt";
import type { RetrievedChunk } from "../types";

vi.mock("langsmith/traceable", () => ({
  traceable: vi.fn((fn) => fn),
}));

function makeChunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    id: "chunk-1",
    score: 0.9,
    text: "Some documentation text.",
    url: "https://example.com/page",
    title: "Example Page",
    headings: ["Section A"],
    chunk_index: 0,
    content_hash: "abc123",
    created_at: "2026-01-01T00:00:00Z",
    embedding_model: "text-embedding-3-small",
    ...overrides,
  };
}

describe("parseCitations", () => {
  it("extracts a single citation ID", () => {
    expect(parseCitations("Some claim. [src:chunk-abc]")).toEqual(["chunk-abc"]);
  });

  it("extracts multiple citation IDs in order", () => {
    expect(
      parseCitations("First claim. [src:chunk-1] Second claim. [src:chunk-2]")
    ).toEqual(["chunk-1", "chunk-2"]);
  });

  it("deduplicates repeated citation IDs", () => {
    expect(
      parseCitations("[src:chunk-1] Some text. [src:chunk-1]")
    ).toEqual(["chunk-1"]);
  });

  it("preserves order of first appearance when deduplicating", () => {
    expect(
      parseCitations("[src:chunk-b] [src:chunk-a] [src:chunk-b]")
    ).toEqual(["chunk-b", "chunk-a"]);
  });

  it("returns an empty array when there are no citations", () => {
    expect(parseCitations("No citations here.")).toEqual([]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseCitations("")).toEqual([]);
  });
});

describe("validateCitations", () => {
  it("returns all chunks as valid when all IDs match", () => {
    const chunks = [makeChunk({ id: "a" }), makeChunk({ id: "b" })];
    const result = validateCitations(["a", "b"], chunks);
    expect(result.valid).toEqual(chunks);
    expect(result.hallucinated).toEqual([]);
  });

  it("flags IDs not present in retrieved chunks as hallucinated", () => {
    const chunk = makeChunk({ id: "a" });
    const result = validateCitations(["a", "ghost-id"], [chunk]);
    expect(result.valid).toEqual([chunk]);
    expect(result.hallucinated).toEqual(["ghost-id"]);
  });

  it("returns all IDs as hallucinated when chunks is empty", () => {
    const result = validateCitations(["chunk-1", "chunk-2"], []);
    expect(result.valid).toEqual([]);
    expect(result.hallucinated).toEqual(["chunk-1", "chunk-2"]);
  });

  it("returns empty valid and hallucinated when ids is empty", () => {
    const chunks = [makeChunk({ id: "a" })];
    const result = validateCitations([], chunks);
    expect(result.valid).toEqual([]);
    expect(result.hallucinated).toEqual([]);
  });

  it("returns the full RetrievedChunk object for valid citations", () => {
    const chunk = makeChunk({ id: "a", title: "Auth Guide" });
    const result = validateCitations(["a"], [chunk]);
    expect(result.valid[0]).toEqual(chunk);
  });
});

describe("analyzeCitations", () => {
  it("detects an exact refusal phrase and returns isRefusal true", async () => {
    const result = await analyzeCitations(REFUSAL_PHRASE, []);
    expect(result.isRefusal).toBe(true);
    expect(result.cited).toEqual([]);
    expect(result.hallucinated).toEqual([]);
  });

  it("trims whitespace before checking for refusal", async () => {
    const result = await analyzeCitations(`  ${REFUSAL_PHRASE}  `, []);
    expect(result.isRefusal).toBe(true);
  });

  it("does not treat a partial refusal phrase as a refusal", async () => {
    const result = await analyzeCitations(`${REFUSAL_PHRASE} But here is something.`, []);
    expect(result.isRefusal).toBe(false);
  });

  it("returns isRefusal false and correct cited chunks on happy path", async () => {
    const chunk = makeChunk({ id: "chunk-abc" });
    const response = "Here is the answer. [src:chunk-abc]";
    const result = await analyzeCitations(response, [chunk]);
    expect(result.isRefusal).toBe(false);
    expect(result.cited).toEqual([chunk]);
    expect(result.hallucinated).toEqual([]);
  });

  it("flags hallucinated citations not in retrieved chunks", async () => {
    const chunk = makeChunk({ id: "chunk-real" });
    const response = "Real claim. [src:chunk-real] Fake claim. [src:chunk-ghost]";
    const result = await analyzeCitations(response, [chunk]);
    expect(result.cited).toHaveLength(1);
    expect(result.hallucinated).toEqual(["chunk-ghost"]);
  });

  it("returns empty cited and hallucinated when response has no citations", async () => {
    const chunk = makeChunk({ id: "chunk-abc" });
    const response = "Here is an answer with no inline citations.";
    const result = await analyzeCitations(response, [chunk]);
    expect(result.isRefusal).toBe(false);
    expect(result.cited).toEqual([]);
    expect(result.hallucinated).toEqual([]);
  });
});
