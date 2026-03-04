import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RetrievedChunk } from "@/lib/types";

vi.mock("@/lib/retriever", () => ({ querySimilar: vi.fn() }));
vi.mock("@/lib/prompt", () => ({ buildPrompt: vi.fn() }));
vi.mock("@/lib/citations", () => ({ analyzeCitations: vi.fn() }));
vi.mock("@/lib/formatCitations", () => ({ formatCitations: vi.fn() }));
vi.mock("@/lib/openai", () => ({ getOpenAIClient: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { OPENAI_CHAT_MODEL: vi.fn() } }));

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

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

  it("happy path: wires all deps and returns formatted citations", async () => {
    const mockChunks = [{ id: "c1", text: "some text" }];
    const mockAnalysis = { isRefusal: false, cited: [{ id: "c1" }], hallucinated: [] };
    const mockFormatted = { answer: "final answer [1]", sources: [{ index: 1, title: "T", url: "u", snippet: "s" }] };

    vi.mocked(env.OPENAI_CHAT_MODEL).mockReturnValue("gpt-test");
    vi.mocked(querySimilar).mockResolvedValue(mockChunks);
    vi.mocked(buildPrompt).mockReturnValue({ system: "sys", user: "usr" });

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "raw answer [src:c1]" } }],
    });
    vi.mocked(getOpenAIClient).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    } as never);

    vi.mocked(analyzeCitations).mockResolvedValue(mockAnalysis);
    vi.mocked(formatCitations).mockReturnValue(mockFormatted);

    const res = await POST(makeRequest({ question: "What is X?" }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual(mockFormatted);

    expect(querySimilar).toHaveBeenCalledWith("What is X?");
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

  it("returns 200 with empty sources on refusal", async () => {
    const mockChunks: RetrievedChunk[] = [];
    const mockAnalysis = { isRefusal: true, cited: [], hallucinated: [] };
    const mockFormatted = { answer: "I cannot answer from the provided documentation.", sources: [] };

    vi.mocked(env.OPENAI_CHAT_MODEL).mockReturnValue("gpt-test");
    vi.mocked(querySimilar).mockResolvedValue(mockChunks);
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
