import { describe, it, expect } from "vitest";
import { buildPrompt, REFUSAL_PHRASE } from "../prompt";
import type { RetrievedChunk } from "../types";

function makeChunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    id: "chunk-1",
    score: 0.9,
    text: "Some documentation text.",
    url: "https://example.com/page",
    title: "Example Page",
    headings: ["Section A", "Subsection B"],
    chunk_index: 0,
    content_hash: "abc123",
    created_at: "2026-01-01T00:00:00Z",
    embedding_model: "text-embedding-3-small",
    ...overrides,
  };
}

describe("buildPrompt", () => {
  it("includes the question in the user prompt", () => {
    const result = buildPrompt("How do I reset my password?", []);
    expect(result.user).toContain("How do I reset my password?");
  });

  it("includes the exact REFUSAL_PHRASE in the system prompt", () => {
    const result = buildPrompt("What is X?", []);
    expect(result.system).toContain(REFUSAL_PHRASE);
  });

  it("does not wrap REFUSAL_PHRASE in quotes in the system prompt", () => {
    const result = buildPrompt("What is X?", []);
    expect(result.system).not.toContain(`"${REFUSAL_PHRASE}"`);
  });

  it("includes [src:ID] citation format instruction in the system prompt", () => {
    const result = buildPrompt("What is X?", []);
    expect(result.system).toContain("[src:ID]");
  });

  it("includes chunk id, title, url, and text in the user prompt", () => {
    const chunk = makeChunk({
      id: "chunk-42",
      title: "Auth Guide",
      url: "https://docs.example.com/auth",
      text: "Use API keys to authenticate.",
    });

    const result = buildPrompt("How do I authenticate?", [chunk]);

    expect(result.user).toContain("[src:chunk-42]");
    expect(result.user).toContain("Auth Guide");
    expect(result.user).toContain("https://docs.example.com/auth");
    expect(result.user).toContain("Use API keys to authenticate.");
  });

  it("joins headings with ' > ' in the user prompt", () => {
    const chunk = makeChunk({ headings: ["Getting Started", "Installation", "npm"] });
    const result = buildPrompt("How do I install?", [chunk]);
    expect(result.user).toContain("Getting Started > Installation > npm");
  });

  it("handles an empty headings array without error", () => {
    const chunk = makeChunk({ headings: [] });
    const result = buildPrompt("What is X?", [chunk]);
    expect(result.user).toContain("Headings: \n");
  });

  it("preserves retriever order across multiple chunks", () => {
    const c1 = makeChunk({ id: "first-chunk" });
    const c2 = makeChunk({ id: "second-chunk" });
    const c3 = makeChunk({ id: "third-chunk" });

    const result = buildPrompt("What is X?", [c1, c2, c3]);

    const i1 = result.user.indexOf("first-chunk");
    const i2 = result.user.indexOf("second-chunk");
    const i3 = result.user.indexOf("third-chunk");

    expect(i1).toBeLessThan(i2);
    expect(i2).toBeLessThan(i3);
  });

  it("returns a valid shape with no context blocks when chunks is empty", () => {
    const result = buildPrompt("What is X?", []);
    expect(result.user).toContain("Documentation:");
    expect(result.user).toContain("(no documentation provided)");
  });

  it("includes all chunks when multiple are provided", () => {
    const c1 = makeChunk({ id: "a", text: "Alpha text" });
    const c2 = makeChunk({ id: "b", text: "Beta text" });

    const result = buildPrompt("Tell me everything.", [c1, c2]);

    expect(result.user).toContain("Alpha text");
    expect(result.user).toContain("Beta text");
  });
});
