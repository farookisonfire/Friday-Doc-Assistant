import { traceable, getCurrentRunTree } from "langsmith/traceable";
import { querySimilar } from "./retriever";
import { buildPrompt } from "./prompt";
import { getOpenAIClient } from "./openai";
import { env } from "./env";
import { analyzeCitations } from "./citations";
import { formatCitations } from "./formatCitations";
import type { RetrievedChunk, CitationAnalysis } from "./types";
import type { FormattedSource } from "./formatCitations";

export interface RunRagResult {
  answer: string;
  sources: FormattedSource[];
  isRefusal: boolean;
  traceId: string;
  chunks: RetrievedChunk[];
  analysis: CitationAnalysis;
}

export const runRag = traceable(
  async (question: string, topK: number): Promise<RunRagResult> => {
    const chunks = await querySimilar(question, topK);
    const { system, user } = buildPrompt(question, chunks);

    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: env.OPENAI_CHAT_MODEL(),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const answer = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!answer) {
      return {
        answer: "",
        sources: [],
        isRefusal: false,
        traceId: getCurrentRunTree().trace_id,
        chunks,
        analysis: { isRefusal: false, cited: [], hallucinated: [] },
      };
    }
    const analysis = await analyzeCitations(answer, chunks);
    const formatted = formatCitations(answer, analysis);

    return {
      answer: formatted.answer,
      sources: formatted.sources,
      isRefusal: analysis.isRefusal,
      traceId: getCurrentRunTree().trace_id,
      chunks,
      analysis,
    };
  },
  { name: "runRag", run_type: "chain" }
);
