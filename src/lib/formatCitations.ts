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
const SRC_TAG_RE = / ?\[src:[^\]]+\]/g;

export function formatCitations(
  answer: string,
  analysis: CitationAnalysis
): FormattedCitations {
  if (analysis.isRefusal) {
    return { answer, sources: [] };
  }

  if (analysis.cited.length === 0) {
    return { answer: answer.replace(SRC_TAG_RE, ""), sources: [] };
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

  formattedAnswer = formattedAnswer.replace(SRC_TAG_RE, "");

  return { answer: formattedAnswer, sources };
}
