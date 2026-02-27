import { describe, it, expect } from "vitest";
import { hashSha256, estimateTokens, splitSectionText, chunkPages } from "../ingest-utils";
import type { ScrapedPage } from "../ingest-utils";

describe("hashSha256", () => {
  it("returns a 64-character hex string", () => {
    expect(hashSha256("hello")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic for the same input", () => {
    expect(hashSha256("hello")).toBe(hashSha256("hello"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashSha256("hello")).not.toBe(hashSha256("world"));
  });

  it("returns the known SHA-256 of 'hello'", () => {
    expect(hashSha256("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });
});

describe("estimateTokens", () => {
  it("returns ceil(length / 4)", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("")).toBe(0);
  });

  it("handles longer strings", () => {
    const text = "a".repeat(400);
    expect(estimateTokens(text)).toBe(100);
  });
});

describe("splitSectionText", () => {
  it("returns the text as-is when it fits within maxTokens", () => {
    const short = "short text";
    expect(splitSectionText(short, 600)).toEqual([short]);
  });

  it("splits long text into multiple chunks", () => {
    const word = "word ";
    const longText = word.repeat(700);
    const chunks = splitSectionText(longText, 100);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("each chunk is within the token limit (approximately)", () => {
    const longText = "word ".repeat(700);
    const chunks = splitSectionText(longText, 100);
    for (const chunk of chunks) {
      expect(estimateTokens(chunk)).toBeLessThanOrEqual(120);
    }
  });

  it("preserves all words across chunks (with overlap)", () => {
    const words = Array.from({ length: 300 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const chunks = splitSectionText(text, 50, 0);
    const allWords = chunks.flatMap((c) => c.split(" "));
    for (const word of words) {
      expect(allWords).toContain(word);
    }
  });

  it("returns a single chunk for empty string", () => {
    expect(splitSectionText("", 600)).toEqual([""]);
  });
});

describe("chunkPages", () => {
  it("returns empty array for empty pages input", () => {
    expect(chunkPages([])).toEqual([]);
  });

  it("produces a chunk for each section", () => {
    const pages: ScrapedPage[] = [
      {
        url: "https://example.com",
        title: "Page",
        scrapedAt: "2024-01-01T00:00:00.000Z",
        sections: [
          { heading: "Intro", text: "Hello world" },
          { heading: "Details", text: "More info here" },
        ],
      },
    ];
    const chunks = chunkPages(pages);
    expect(chunks).toHaveLength(2);
  });

  it("sets correct metadata on each chunk", () => {
    const pages: ScrapedPage[] = [
      {
        url: "https://example.com/page",
        title: "My Page",
        scrapedAt: "2024-01-01T00:00:00.000Z",
        sections: [{ heading: "Section", text: "Some text" }],
      },
    ];
    const [chunk] = chunkPages(pages);
    expect(chunk.url).toBe("https://example.com/page");
    expect(chunk.title).toBe("My Page");
    expect(chunk.headings).toEqual(["Section"]);
    expect(chunk.text).toBe("Some text");
    expect(chunk.chunk_index).toBe(0);
    expect(chunk.id).toBeTruthy();
    expect(chunk.content_hash).toBeTruthy();
  });

  it("assigns sequential chunk_index values per page", () => {
    const pages: ScrapedPage[] = [
      {
        url: "https://example.com",
        title: "Page",
        scrapedAt: "2024-01-01T00:00:00.000Z",
        sections: [
          { heading: "A", text: "Text A" },
          { heading: "B", text: "Text B" },
          { heading: "C", text: "Text C" },
        ],
      },
    ];
    const chunks = chunkPages(pages);
    expect(chunks.map((c) => c.chunk_index)).toEqual([0, 1, 2]);
  });

  it("produces unique IDs for different sections", () => {
    const pages: ScrapedPage[] = [
      {
        url: "https://example.com",
        title: "Page",
        scrapedAt: "2024-01-01T00:00:00.000Z",
        sections: [
          { heading: "A", text: "Text A" },
          { heading: "B", text: "Text B" },
        ],
      },
    ];
    const chunks = chunkPages(pages);
    expect(chunks[0].id).not.toBe(chunks[1].id);
  });

  it("handles pages with no sections", () => {
    const pages: ScrapedPage[] = [
      { url: "https://example.com", title: "Empty", scrapedAt: "2024-01-01T00:00:00.000Z", sections: [] },
    ];
    expect(chunkPages(pages)).toEqual([]);
  });
});
