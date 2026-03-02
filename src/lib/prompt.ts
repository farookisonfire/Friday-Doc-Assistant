import type { RetrievedChunk } from "./types";

export const REFUSAL_PHRASE = "I cannot answer from the provided documentation.";

const SYSTEM_PROMPT = [
  "You are a documentation assistant. Answer questions using ONLY the documentation snippets provided in the user message.",
  `If the documentation does not contain enough information to answer, respond with exactly: "${REFUSAL_PHRASE}"`,
  "Cite sources inline using the format [src:ID] immediately after the statement they support, where ID is the snippet ID.",
  "Do not fabricate information or cite sources not present in the provided snippets.",
].join("\n");

export function buildPrompt(
  question: string,
  chunks: RetrievedChunk[]
): { system: string; user: string } {
  const contextBlocks = chunks.map((c) =>
    [
      `[src:${c.id}]`,
      `Title: ${c.title}`,
      `URL: ${c.url}`,
      `Headings: ${c.headings.join(" > ")}`,
      `Text: ${c.text}`,
    ].join("\n")
  );

  const user = [
    `Question: ${question}`,
    "",
    "Documentation:",
    contextBlocks.length > 0 ? contextBlocks.join("\n\n") : "(no documentation provided)",
  ].join("\n");

  return { system: SYSTEM_PROMPT, user };
}
