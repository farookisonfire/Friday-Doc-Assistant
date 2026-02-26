import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

interface Section {
  heading: string;
  text: string;
}

interface ScrapedPage {
  url: string;
  title: string;
  sections: Section[];
  scrapedAt: string;
}

interface Chunk {
  id: string;
  text: string;
  url: string;
  title: string;
  headings: string[];
  chunk_index: number;
  content_hash: string;
  created_at: string;
}

function hashSha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitSectionText(text: string, maxTokens = 600, overlapTokens = 80): string[] {
  if (estimateTokens(text) <= maxTokens) return [text];

  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  let charCount = 0;

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
    }
  }

  if (current.length > 0) chunks.push(current.join(" "));
  return chunks;
}

function chunkPages(pages: ScrapedPage[]): Chunk[] {
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

function main() {
  const scrapedPath = path.join(process.cwd(), "data", "scraped.json");
  if (!fs.existsSync(scrapedPath)) {
    throw new Error(`scraped.json not found at ${scrapedPath} — run npm run scrape first`);
  }

  const pages: ScrapedPage[] = JSON.parse(fs.readFileSync(scrapedPath, "utf8"));
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error("scraped.json is empty or malformed");
  }
  console.log(`[ingest] Loaded ${pages.length} pages from scraped.json`);

  const chunks = chunkPages(pages);
  console.log(`[ingest] Produced ${chunks.length} chunks`);

  if (chunks.length === 0) {
    console.warn("[ingest] No chunks produced — check that sections have text");
    return;
  }

  console.log("\n[ingest] Sample chunk:");
  console.log(JSON.stringify(chunks[0], null, 2));
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
