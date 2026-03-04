import { NextResponse } from "next/server";
import { traceable, getCurrentRunTree } from "langsmith/traceable";
import { querySimilar } from "@/lib/retriever";
import { buildPrompt } from "@/lib/prompt";
import { analyzeCitations } from "@/lib/citations";
import { formatCitations } from "@/lib/formatCitations";
import { getOpenAIClient } from "@/lib/openai";
import { env } from "@/lib/env";

const runChat = traceable(
  async (question: string, topK: number) => {
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

    const answer = completion.choices[0]?.message?.content?.trim();
    if (!answer) {
      return NextResponse.json({ error: "Model returned no answer" }, { status: 502 });
    }

    const analysis = await analyzeCitations(answer, chunks);
    const formatted = formatCitations(answer, analysis);
    const traceId = getCurrentRunTree().trace_id;

    return NextResponse.json({ ...formatted, traceId, isRefusal: analysis.isRefusal });
  },
  { name: "runChat", run_type: "chain" }
);

export async function POST(req: Request) {
  let body: Record<string, unknown>;

  try {
    const parsed = await req.json();
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const rawTopK = Number.isFinite(body.topK) ? (body.topK as number) : 5;
  const topK = Math.min(8, Math.max(1, Math.round(rawTopK)));

  try {
    return await runChat(question, topK);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
