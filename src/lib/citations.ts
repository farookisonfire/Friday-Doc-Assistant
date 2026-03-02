import { REFUSAL_PHRASE } from "./prompt";
import type { RetrievedChunk, CitationAnalysis } from "./types";

const CITATION_REGEX = /\[src:([^\]]+)\]/g;

export function parseCitations(text: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(CITATION_REGEX)) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function validateCitations(
  ids: string[],
  chunks: RetrievedChunk[]
): { valid: RetrievedChunk[]; hallucinated: string[] } {
  const chunkMap = new Map(chunks.map((c) => [c.id, c]));
  const valid: RetrievedChunk[] = [];
  const hallucinated: string[] = [];

  for (const id of ids) {
    const chunk = chunkMap.get(id);
    if (chunk) {
      valid.push(chunk);
    } else {
      hallucinated.push(id);
    }
  }

  return { valid, hallucinated };
}

export function analyzeCitations(
  response: string,
  chunks: RetrievedChunk[]
): CitationAnalysis {
  if (response.trim() === REFUSAL_PHRASE) {
    return { isRefusal: true, cited: [], hallucinated: [] };
  }

  const ids = parseCitations(response);
  const { valid, hallucinated } = validateCitations(ids, chunks);

  return { isRefusal: false, cited: valid, hallucinated };
}
