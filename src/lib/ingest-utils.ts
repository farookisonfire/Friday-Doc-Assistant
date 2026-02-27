import * as crypto from "crypto";
import type { Chunk } from "./types";

export interface Section {
  heading: string;
  text: string;
}

export interface ScrapedPage {
  url: string;
  title: string;
  sections: Section[];
  scrapedAt: string;
}

export function hashSha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function splitSectionText(text: string, maxTokens = 600, overlapTokens = 80): string[] {
  if (estimateTokens(text) <= maxTokens) return [text];

  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  let charCount = 0;
  let overlapLength = 0;

  for (const word of words) {
    if (current.length > 0) charCount += 1;
    charCount += word.length;
    current.push(word);

    if (Math.ceil(charCount / 4) >= maxTokens) {
      chunks.push(current.join(" "));
      const overlapCharTarget = overlapTokens * 4;
      const overlap: string[] = [];
      let overlapCharCount = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const add = overlap.length > 0 ? current[i].length + 1 : current[i].length;
        if (overlapCharCount + add > overlapCharTarget) break;
        overlapCharCount += add;
        overlap.unshift(current[i]);
      }
      current = overlap;
      charCount = overlapCharCount;
      overlapLength = overlap.length;
    }
  }

  if (current.length > overlapLength) chunks.push(current.join(" "));
  return chunks;
}

export function chunkPages(pages: ScrapedPage[]): Chunk[] {
  const chunks: Chunk[] = [];
  const createdAt = new Date().toISOString();

  for (const page of pages) {
    let chunkIndex = 0;
    for (const section of page.sections) {
      const splits = splitSectionText(section.text);
      for (const text of splits) {
        const contentHash = hashSha256(text);
        const id = hashSha256(`${page.url}\n${section.heading}\n${text}`);
        chunks.push({
          id,
          text,
          url: page.url,
          title: page.title,
          headings: [section.heading],
          chunk_index: chunkIndex++,
          content_hash: contentHash,
          created_at: createdAt,
        });
      }
    }
  }

  return chunks;
}
