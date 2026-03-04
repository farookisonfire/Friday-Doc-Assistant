import { describe, it, expect } from "vitest";
import { formatCitations } from "../formatCitations";
import type { CitationAnalysis, RetrievedChunk } from "../types";

function makeChunk(id: string, title: string, url: string, text: string): RetrievedChunk {
  return {
    id,
    title,
    url,
    text,
    headings: [],
    chunk_index: 0,
    content_hash: "hash",
    created_at: "2024-01-01",
    embedding_model: "text-embedding-3-small",
    score: 0.9,
  };
}

describe("formatCitations", () => {
  it("returns answer unchanged and empty sources for a refusal", () => {
    const analysis: CitationAnalysis = { isRefusal: true, cited: [], hallucinated: [] };
    const result = formatCitations("I cannot answer from the provided documentation.", analysis);
    expect(result.answer).toBe("I cannot answer from the provided documentation.");
    expect(result.sources).toEqual([]);
  });

  it("returns answer unchanged and empty sources when no chunks were cited", () => {
    const analysis: CitationAnalysis = { isRefusal: false, cited: [], hallucinated: [] };
    const result = formatCitations("Some answer with no citations.", analysis);
    expect(result.answer).toBe("Some answer with no citations.");
    expect(result.sources).toEqual([]);
  });

  it("replaces [src:ID] with [1] and builds the sources entry", () => {
    const chunk = makeChunk("abc123", "Getting Started", "https://example.com/docs", "Some text");
    const analysis: CitationAnalysis = { isRefusal: false, cited: [chunk], hallucinated: [] };
    const result = formatCitations("Friday supports X [src:abc123].", analysis);
    expect(result.answer).toBe("Friday supports X [1].");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toEqual({
      index: 1,
      title: "Getting Started",
      url: "https://example.com/docs",
      snippet: "Some text",
    });
  });

  it("numbers multiple citations in order of appearance", () => {
    const chunk1 = makeChunk("id1", "Page 1", "https://example.com/1", "Text 1");
    const chunk2 = makeChunk("id2", "Page 2", "https://example.com/2", "Text 2");
    const analysis: CitationAnalysis = { isRefusal: false, cited: [chunk1, chunk2], hallucinated: [] };
    const result = formatCitations("First [src:id1] and second [src:id2].", analysis);
    expect(result.answer).toBe("First [1] and second [2].");
    expect(result.sources[0].index).toBe(1);
    expect(result.sources[1].index).toBe(2);
  });

  it("replaces repeated references to the same chunk with the same number", () => {
    const chunk = makeChunk("id1", "Page 1", "https://example.com/1", "Text");
    const analysis: CitationAnalysis = { isRefusal: false, cited: [chunk], hallucinated: [] };
    const result = formatCitations("First [src:id1] and again [src:id1].", analysis);
    expect(result.answer).toBe("First [1] and again [1].");
    expect(result.sources).toHaveLength(1);
  });

  it("removes hallucinated [src:...] references from the answer", () => {
    const chunk = makeChunk("valid", "Valid Page", "https://example.com", "Text");
    const analysis: CitationAnalysis = { isRefusal: false, cited: [chunk], hallucinated: ["ghost"] };
    const result = formatCitations("Valid [src:valid] and ghost [src:ghost].", analysis);
    expect(result.answer).toBe("Valid [1] and ghost.");
    expect(result.sources).toHaveLength(1);
  });

  it("truncates snippet to 240 characters", () => {
    const longText = "a".repeat(300);
    const chunk = makeChunk("id1", "Title", "https://example.com", longText);
    const analysis: CitationAnalysis = { isRefusal: false, cited: [chunk], hallucinated: [] };
    const result = formatCitations("Answer [src:id1].", analysis);
    expect(result.sources[0].snippet).toHaveLength(240);
  });
});
