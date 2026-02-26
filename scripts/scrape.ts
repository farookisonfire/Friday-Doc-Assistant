import { env } from "../src/lib/env";

async function main() {
  const baseUrl = env.DOCS_BASE_URL();
  console.log(`[scrape] Base URL: ${baseUrl}`);
  console.log("[scrape] Phase 2: will crawl docs HTML -> extract + chunk text -> write to data/scraped.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
