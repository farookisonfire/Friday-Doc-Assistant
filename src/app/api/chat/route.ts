import { NextResponse } from "next/server";
import { querySimilar } from "@/lib/retriever";
import { buildPrompt } from "@/lib/prompt";
import { analyzeCitations } from "@/lib/citations";
import { formatCitations } from "@/lib/formatCitations";
import { getOpenAIClient } from "@/lib/openai";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  try {
    const chunks = await querySimilar(question);
    const { system, user } = buildPrompt(question, chunks);

    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: env.OPENAI_CHAT_MODEL(),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const answer = completion.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return NextResponse.json({ error: "Model returned no answer" }, { status: 502 });
    }

    const analysis = await analyzeCitations(answer, chunks);
    const formatted = formatCitations(answer, analysis);

    return NextResponse.json(formatted);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
