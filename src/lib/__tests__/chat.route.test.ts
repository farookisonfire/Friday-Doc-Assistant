import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RetrievedChunk } from "@/lib/types";

vi.mock("langsmith/traceable", () => ({
  traceable: vi.fn((fn) => fn),
  getCurrentRunTree: vi.fn().mockReturnValue({ trace_id: "test-trace-id" }),
}));
vi.mock("@/lib/retriever", () => ({ querySimilar: vi.fn() }));
vi.mock("@/lib/prompt", () => ({ buildPrompt: vi.fn() }));
vi.mock("@/lib/citations", () => ({ analyzeCitations: vi.fn() }));
vi.mock("@/lib/formatCitations", () => ({ formatCitations: vi.fn() }));
vi.mock("@/lib/openai", () => ({ getOpenAIClient: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { OPENAI_CHAT_MODEL: vi.fn() } }));

import { getCurrentRunTree } from "langsmith/traceable";
import { querySimilar } from "@/lib/retriever";
import { buildPrompt } from "@/lib/prompt";
import { analyzeCitations } from "@/lib/citations";
import { formatCitations } from "@/lib/formatCitations";
import { getOpenAIClient } from "@/lib/openai";
import { env } from "@/lib/env";
import { POST } from "@/app/api/chat/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setupHappyPathMocks(overrides: { isRefusal?: boolean } = {}) {
  const mockChunks = [{ id: "c1", text: "some text" }];
  const mockAnalysis = { isRefusal: overrides.isRefusal ?? false, cited: [{ id: "c1" }], hallucinated: [] };
  const mockFormatted = { answer: "final answer [1]", sources: [{ index: 1, title: "T", url: "u", snippet: "s" }] };

  vi.mocked(env.OPENAI_CHAT_MODEL).mockReturnValue("gpt-test");
  vi.mocked(querySimilar).mockResolvedValue(mockChunks as never);
  vi.mocked(buildPrompt).mockReturnValue({ system: "sys", user: "usr" });

  const mockCreate = vi.fn().mockResolvedValue({
    choices: [{ message: { content: "raw answer [src:c1]" } }],
  });
  vi.mocked(getOpenAIClient).mockReturnValue({
    chat: { completions: { create: mockCreate } },
  } as never);

  vi.mocked(analyzeCitations).mockResolvedValue(mockAnalysis as never);
  vi.mocked(formatCitations).mockReturnValue(mockFormatted);

  return { mockChunks, mockAnalysis, mockFormatted, mockCreate };
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentRunTree).mockReturnValue({ trace_id: "test-trace-id" } as never);
  });

  it("returns 400 when question is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 when question is an empty string", async () => {
    const res = await POST(makeRequest({ question: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is null", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "null",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("happy path: wires all deps and returns formatted citations with traceId and isRefusal", async () => {
    const { mockChunks, mockAnalysis, mockFormatted, mockCreate } = setupHappyPathMocks();

    const res = await POST(makeRequest({ question: "What is X?" }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({ ...mockFormatted, traceId: "test-trace-id", isRefusal: false });

    expect(querySimilar).toHaveBeenCalledWith("What is X?", 5);
    expect(buildPrompt).toHaveBeenCalledWith("What is X?", mockChunks);
    expect(mockCreate).toHaveBeenCalledWith({
      model: "gpt-test",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "usr" },
      ],
    });
    expect(analyzeCitations).toHaveBeenCalledWith("raw answer [src:c1]", mockChunks);
    expect(formatCitations).toHaveBeenCalledWith("raw answer [src:c1]", mockAnalysis);
  });

  it("passes topK from body clamped to 1–8", async () => {
    setupHappyPathMocks();
    await POST(makeRequest({ question: "What is X?", topK: 3 }));
    expect(querySimilar).toHaveBeenCalledWith("What is X?", 3);
  });

  it("clamps topK below minimum to 1", async () => {
    setupHappyPathMocks();
    await POST(makeRequest({ question: "What is X?", topK: 0 }));
    expect(querySimilar).toHaveBeenCalledWith("What is X?", 1);
  });

  it("clamps topK above maximum to 8", async () => {
    setupHappyPathMocks();
    await POST(makeRequest({ question: "What is X?", topK: 20 }));
    expect(querySimilar).toHaveBeenCalledWith("What is X?", 8);
  });

  it("returns 200 with empty sources and isRefusal true on refusal", async () => {
    const mockChunks: RetrievedChunk[] = [];
    const mockAnalysis = { isRefusal: true, cited: [], hallucinated: [] };
    const mockFormatted = { answer: "I cannot answer from the provided documentation.", sources: [] };

    vi.mocked(env.OPENAI_CHAT_MODEL).mockReturnValue("gpt-test");
    vi.mocked(querySimilar).mockResolvedValue(mockChunks as never);
    vi.mocked(buildPrompt).mockReturnValue({ system: "sys", user: "usr" });

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "I cannot answer from the provided documentation." } }],
    });
    vi.mocked(getOpenAIClient).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    } as never);

    vi.mocked(analyzeCitations).mockResolvedValue(mockAnalysis);
    vi.mocked(formatCitations).mockReturnValue(mockFormatted);

    const res = await POST(makeRequest({ question: "What is the meaning of life?" }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.sources).toEqual([]);
    expect(json.isRefusal).toBe(true);
  });

  it("returns 502 when OpenAI returns empty content", async () => {
    vi.mocked(env.OPENAI_CHAT_MODEL).mockReturnValue("gpt-test");
    vi.mocked(querySimilar).mockResolvedValue([]);
    vi.mocked(buildPrompt).mockReturnValue({ system: "sys", user: "usr" });

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "" } }],
    });
    vi.mocked(getOpenAIClient).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    } as never);

    const res = await POST(makeRequest({ question: "What is X?" }));
    expect(res.status).toBe(502);
  });

  it("returns 500 when a dependency throws", async () => {
    vi.mocked(env.OPENAI_CHAT_MODEL).mockReturnValue("gpt-test");
    vi.mocked(querySimilar).mockRejectedValue(new Error("Pinecone down"));

    const res = await POST(makeRequest({ question: "What is X?" }));
    expect(res.status).toBe(500);
  });
});
