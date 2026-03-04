import { NextResponse } from "next/server";
import { runRag } from "@/lib/runRag";

export const maxDuration = 60;

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
    const result = await runRag(question, topK);
    if (!result.answer && !result.isRefusal) {
      return NextResponse.json({ error: "Model returned no answer" }, { status: 502 });
    }
    return NextResponse.json({
      answer: result.answer,
      sources: result.sources,
      isRefusal: result.isRefusal,
      traceId: result.traceId,
    });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
