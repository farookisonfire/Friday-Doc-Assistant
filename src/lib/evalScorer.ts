import type { RetrievedChunk } from "./types";

export function scoreRetrievalRecall(
  chunks: RetrievedChunk[],
  expectedUrls: string[] | undefined
): number {
  if (!expectedUrls?.length) return NaN;
  const retrieved = new Set(chunks.map((c) => c.url));
  const hits = expectedUrls.filter((u) => retrieved.has(u)).length;
  return hits / expectedUrls.length;
}

export function scoreGrounding(hallucinated: string[]): number {
  return hallucinated.length === 0 ? 1 : 0;
}

export function scoreCitationPrecision(citedCount: number, hallucinatedCount: number): number {
  const total = citedCount + hallucinatedCount;
  if (total === 0) return 1;
  return citedCount / total;
}

export function scoreRefusalCorrectness(
  isRefusal: boolean,
  shouldRefuse: boolean | undefined
): number {
  if (shouldRefuse === undefined) return NaN;
  return isRefusal === shouldRefuse ? 1 : 0;
}
