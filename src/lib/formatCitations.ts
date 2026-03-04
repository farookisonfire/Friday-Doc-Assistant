import type { CitationAnalysis, RetrievedChunk } from "./types";

export interface FormattedSource {
  index: number;
  title: string;
  url: string;
  snippet: string;
}

export interface FormattedCitations {
  answer: string;
  sources: FormattedSource[];
}

const SNIPPET_LENGTH = 240;

export function formatCitations(
  answer: string,
  analysis: CitationAnalysis
): FormattedCitations {
  if (analysis.isRefusal || analysis.cited.length === 0) {
    return { answer, sources: [] };
  }

  let formattedAnswer = answer;
  const sources: FormattedSource[] = [];

  analysis.cited.forEach((chunk, i) => {
    const index = i + 1;
    formattedAnswer = formattedAnswer.replaceAll(`[src:${chunk.id}]`, `[${index}]`);
    sources.push({
      index,
      title: chunk.title,
      url: chunk.url,
      snippet: chunk.text.slice(0, SNIPPET_LENGTH),
    });
  });

  formattedAnswer = formattedAnswer.replace(/ ?\[src:[^\]]+\]/g, "");

  return { answer: formattedAnswer, sources };
}
