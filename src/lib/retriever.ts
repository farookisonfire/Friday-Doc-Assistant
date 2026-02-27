import { getOpenAIClient } from "./openai";
import { pineconeIndex } from "./pinecone";
import { env } from "./env";
import type { RetrievedChunk } from "./types";

export async function querySimilar(question: string, topK = 5): Promise<RetrievedChunk[]> {
  const model = env.OPENAI_EMBEDDING_MODEL();
  const openai = getOpenAIClient();

  const { data } = await openai.embeddings.create({ model, input: question });
  const vector = data[0]!.embedding;

  const result = await pineconeIndex().query({ vector, topK, includeMetadata: true });

  return (result.matches ?? []).map((match) => {
    const m = (match.metadata ?? {}) as Record<string, unknown>;
    return {
      id: match.id,
      score: match.score ?? 0,
      text: m.text as string,
      url: m.url as string,
      title: m.title as string,
      headings: m.headings as string[],
      chunk_index: m.chunk_index as number,
      content_hash: m.content_hash as string,
      created_at: m.created_at as string,
      embedding_model: m.embedding_model as string,
    };
  });
}
