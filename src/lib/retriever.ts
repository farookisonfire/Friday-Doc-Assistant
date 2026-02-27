import { getOpenAIClient } from "./openai";
import { pineconeIndex } from "./pinecone";
import { env } from "./env";
import type { RetrievedChunk } from "./types";

function hasRequiredMetadata(m: Record<string, unknown>): m is Omit<RetrievedChunk, "id" | "score"> {
  return (
    typeof m.text === "string" &&
    typeof m.url === "string" &&
    typeof m.title === "string" &&
    Array.isArray(m.headings) &&
    typeof m.chunk_index === "number" &&
    typeof m.content_hash === "string" &&
    typeof m.created_at === "string" &&
    typeof m.embedding_model === "string"
  );
}

export async function querySimilar(question: string, topK = 5): Promise<RetrievedChunk[]> {
  const model = env.OPENAI_EMBEDDING_MODEL();
  const openai = getOpenAIClient();

  const { data } = await openai.embeddings.create({ model, input: question });
  const vector = data[0]!.embedding;

  const result = await pineconeIndex().query({ vector, topK, includeMetadata: true });

  return (result.matches ?? []).flatMap((match) => {
    const m = match.metadata as Record<string, unknown> | undefined;
    if (m == null || !hasRequiredMetadata(m)) return [];
    return [{
      id: match.id,
      score: match.score ?? 0,
      text: m.text,
      url: m.url,
      title: m.title,
      headings: m.headings,
      chunk_index: m.chunk_index,
      content_hash: m.content_hash,
      created_at: m.created_at,
      embedding_model: m.embedding_model,
    }];
  });
}
