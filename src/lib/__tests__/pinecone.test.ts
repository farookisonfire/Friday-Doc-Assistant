import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockNamespace, mockIndex, MockPinecone } = vi.hoisted(() => {
  const mockNamespace = vi.fn().mockReturnValue({ _type: "namespace-handle" });
  const mockIndex = vi.fn().mockReturnValue({ namespace: mockNamespace });
  const MockPinecone = vi.fn(() => ({ index: mockIndex }));
  return { mockNamespace, mockIndex, MockPinecone };
});

vi.mock("@pinecone-database/pinecone", () => ({
  Pinecone: MockPinecone,
}));

vi.mock("../env", () => ({
  env: {
    PINECONE_API_KEY: vi.fn().mockReturnValue("pc-test-key"),
    PINECONE_INDEX: vi.fn().mockReturnValue("my-index"),
    PINECONE_NAMESPACE: vi.fn().mockReturnValue("my-namespace"),
  },
}));

describe("pineconeIndex", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a namespace-scoped index handle", async () => {
    const { pineconeIndex } = await import("../pinecone");
    const result = pineconeIndex();
    expect(result).toEqual({ _type: "namespace-handle" });
  });

  it("initialises Pinecone with the API key from env", async () => {
    const { pineconeIndex } = await import("../pinecone");
    pineconeIndex();
    expect(MockPinecone).toHaveBeenCalledWith({ apiKey: "pc-test-key" });
  });

  it("calls index() with the correct index name", async () => {
    const { pineconeIndex } = await import("../pinecone");
    pineconeIndex();
    expect(mockIndex).toHaveBeenCalledWith({ name: "my-index" });
  });

  it("calls namespace() with the correct namespace", async () => {
    const { pineconeIndex } = await import("../pinecone");
    pineconeIndex();
    expect(mockNamespace).toHaveBeenCalledWith("my-namespace");
  });

  it("only constructs the Pinecone client once (singleton)", async () => {
    const { pineconeIndex } = await import("../pinecone");
    pineconeIndex();
    pineconeIndex();
    pineconeIndex();
    expect(MockPinecone).toHaveBeenCalledTimes(1);
  });
});
