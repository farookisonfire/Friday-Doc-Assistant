import { describe, it, expect, vi, beforeEach } from "vitest";
import { querySimilar } from "../retriever";

const mockQuery = vi.fn();
const mockEmbeddingsCreate = vi.fn();

vi.mock("../pinecone", () => ({
  pineconeIndex: vi.fn(() => ({ query: mockQuery })),
}));

vi.mock("../openai", () => ({
  getOpenAIClient: vi.fn(() => ({
    embeddings: { create: mockEmbeddingsCreate },
  })),
}));

vi.mock("../env", () => ({
  env: {
    OPENAI_EMBEDDING_MODEL: vi.fn().mockReturnValue("text-embedding-3-small"),
  },
}));

const VECTOR = Array.from({ length: 8 }, (_, i) => i * 0.1);

const makeMatch = (overrides: Record<string, unknown> = {}) => ({
  id: "chunk-1",
  score: 0.92,
  metadata: {
    text: "Some text",
    url: "https://example.com/page",
    title: "Example Page",
    headings: ["Intro", "Details"],
    chunk_index: 0,
    content_hash: "abc123",
    created_at: "2026-01-01T00:00:00Z",
    embedding_model: "text-embedding-3-small",
    ...overrides,
  },
});

describe("querySimilar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: VECTOR }] });
    mockQuery.mockResolvedValue({ matches: [makeMatch()] });
  });

  it("returns mapped RetrievedChunk objects", async () => {
    const results = await querySimilar("how do I configure this?");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: "chunk-1",
      score: 0.92,
      text: "Some text",
      url: "https://example.com/page",
      title: "Example Page",
      headings: ["Intro", "Details"],
      chunk_index: 0,
      content_hash: "abc123",
      created_at: "2026-01-01T00:00:00Z",
      embedding_model: "text-embedding-3-small",
    });
  });

  it("embeds the question with the correct model and input", async () => {
    await querySimilar("what is the retry limit?");

    expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: "what is the retry limit?",
    });
  });

  it("queries Pinecone with the embedding vector and topK", async () => {
    await querySimilar("how do I configure this?", 3);

    expect(mockQuery).toHaveBeenCalledWith({
      vector: VECTOR,
      topK: 3,
      includeMetadata: true,
    });
  });

  it("uses a default topK of 5 when not provided", async () => {
    await querySimilar("some question");

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ topK: 5 })
    );
  });

  it("returns an empty array when matches is missing or null", async () => {
    mockQuery.mockResolvedValue({ matches: null });
    expect(await querySimilar("anything")).toEqual([]);

    mockQuery.mockResolvedValue({});
    expect(await querySimilar("anything")).toEqual([]);
  });

  it("defaults score to 0 when match.score is undefined", async () => {
    mockQuery.mockResolvedValue({
      matches: [{ ...makeMatch(), score: undefined }],
    });
    const [result] = await querySimilar("anything");

    expect(result!.score).toBe(0);
  });

  it("handles missing metadata gracefully", async () => {
    mockQuery.mockResolvedValue({
      matches: [{ id: "chunk-2", score: 0.5, metadata: undefined }],
    });
    const [result] = await querySimilar("anything");

    expect(result!.id).toBe("chunk-2");
    expect(result!.text).toBeUndefined();
    expect(result!.url).toBeUndefined();
  });
});
