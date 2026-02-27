import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openai", () => ({
  default: vi.fn(() => ({ _type: "openai-client" })),
}));

vi.mock("../env", () => ({
  env: {
    OPENAI_API_KEY: vi.fn().mockReturnValue("sk-test-key"),
  },
}));

describe("getOpenAIClient", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns an OpenAI client instance", async () => {
    const { getOpenAIClient } = await import("../openai");
    expect(getOpenAIClient()).toEqual({ _type: "openai-client" });
  });

  it("returns the same instance on repeated calls (singleton)", async () => {
    const { getOpenAIClient } = await import("../openai");
    expect(getOpenAIClient()).toBe(getOpenAIClient());
  });

  it("initialises the client with the API key from env", async () => {
    const { default: OpenAI } = await import("openai");
    const { getOpenAIClient } = await import("../openai");
    getOpenAIClient();
    expect(OpenAI).toHaveBeenCalledWith({ apiKey: "sk-test-key" });
  });

  it("only constructs the client once across multiple calls", async () => {
    const { default: OpenAI } = await import("openai");
    const { getOpenAIClient } = await import("../openai");
    getOpenAIClient();
    getOpenAIClient();
    getOpenAIClient();
    expect(vi.mocked(OpenAI)).toHaveBeenCalledTimes(1);
  });
});
