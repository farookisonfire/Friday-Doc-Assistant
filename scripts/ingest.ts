import * as fs from "fs";
import * as path from "path";
import { chunkPages, type ScrapedPage } from "../src/lib/ingest-utils";

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

  const outPath = path.join(process.cwd(), "data", "chunks.json");
  fs.writeFileSync(outPath, JSON.stringify(chunks, null, 2), "utf8");
  console.log(`[ingest] Wrote ${chunks.length} chunks to ${outPath}`);
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
