import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { env } from "../env";

describe("env", () => {
  const ORIGINAL = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL };
  });

  afterAll(() => {
    process.env = ORIGINAL;
  });

  describe("required vars", () => {
    it("throws when OPENAI_API_KEY is missing", () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => env.OPENAI_API_KEY()).toThrow("Missing required environment variable: OPENAI_API_KEY");
    });

    it("returns value when OPENAI_API_KEY is set", () => {
      process.env.OPENAI_API_KEY = "sk-test";
      expect(env.OPENAI_API_KEY()).toBe("sk-test");
    });

    it("throws when PINECONE_API_KEY is missing", () => {
      delete process.env.PINECONE_API_KEY;
      expect(() => env.PINECONE_API_KEY()).toThrow("Missing required environment variable: PINECONE_API_KEY");
    });

    it("returns value when PINECONE_API_KEY is set", () => {
      process.env.PINECONE_API_KEY = "pc-test";
      expect(env.PINECONE_API_KEY()).toBe("pc-test");
    });

    it("throws when PINECONE_INDEX is missing", () => {
      delete process.env.PINECONE_INDEX;
      expect(() => env.PINECONE_INDEX()).toThrow("Missing required environment variable: PINECONE_INDEX");
    });

    it("throws when PINECONE_NAMESPACE is missing", () => {
      delete process.env.PINECONE_NAMESPACE;
      expect(() => env.PINECONE_NAMESPACE()).toThrow("Missing required environment variable: PINECONE_NAMESPACE");
    });

    it("throws when DOCS_BASE_URL is missing", () => {
      delete process.env.DOCS_BASE_URL;
      expect(() => env.DOCS_BASE_URL()).toThrow("Missing required environment variable: DOCS_BASE_URL");
    });

    it("throws when LANGSMITH_API_KEY is missing", () => {
      delete process.env.LANGSMITH_API_KEY;
      expect(() => env.LANGSMITH_API_KEY()).toThrow("Missing required environment variable: LANGSMITH_API_KEY");
    });

    it("returns value when LANGSMITH_API_KEY is set", () => {
      process.env.LANGSMITH_API_KEY = "ls-test";
      expect(env.LANGSMITH_API_KEY()).toBe("ls-test");
    });

    it("reads the latest value on each call (lazy)", () => {
      process.env.OPENAI_API_KEY = "first";
      expect(env.OPENAI_API_KEY()).toBe("first");
      process.env.OPENAI_API_KEY = "second";
      expect(env.OPENAI_API_KEY()).toBe("second");
    });
  });

  describe("optional vars with defaults", () => {
    it("returns default model when OPENAI_EMBEDDING_MODEL is not set", () => {
      delete process.env.OPENAI_EMBEDDING_MODEL;
      expect(env.OPENAI_EMBEDDING_MODEL()).toBe("text-embedding-3-small");
    });

    it("returns custom model when OPENAI_EMBEDDING_MODEL is set", () => {
      process.env.OPENAI_EMBEDDING_MODEL = "text-embedding-ada-002";
      expect(env.OPENAI_EMBEDDING_MODEL()).toBe("text-embedding-ada-002");
    });

    it("returns default batch size of 100 when EMBED_BATCH_SIZE is not set", () => {
      delete process.env.EMBED_BATCH_SIZE;
      expect(env.EMBED_BATCH_SIZE()).toBe(100);
    });

    it("parses EMBED_BATCH_SIZE as an integer", () => {
      process.env.EMBED_BATCH_SIZE = "50";
      expect(env.EMBED_BATCH_SIZE()).toBe(50);
    });

    it("returns default concurrency of 2 when EMBED_CONCURRENCY is not set", () => {
      delete process.env.EMBED_CONCURRENCY;
      expect(env.EMBED_CONCURRENCY()).toBe(2);
    });

    it("parses EMBED_CONCURRENCY as an integer", () => {
      process.env.EMBED_CONCURRENCY = "4";
      expect(env.EMBED_CONCURRENCY()).toBe(4);
    });
  });
});
