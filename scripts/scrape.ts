import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";
import { env } from "../src/lib/env";

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

async function fetchHtml(url: string, depth = 0): Promise<{ html: string; finalUrl: string }> {
  if (depth > 5) throw new Error(`Too many redirects fetching ${url}`);
  const res = await fetch(url);
  if (res.status >= 400) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const html = await res.text();
  const rscRedirect = html.match(/NEXT_REDIRECT;[^;]+;([^;]+);/);
  if (rscRedirect) {
    return fetchHtml(new URL(rscRedirect[1], url).toString(), depth + 1);
  }
  return { html, finalUrl: res.url };
}

function extractNavLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  $("nav a[href^='/docs']").each((_, el) => {
    const href = $(el).attr("href");
    if (href) seen.add(new URL(href, baseUrl).toString());
  });
  return [...seen];
}

function extractPageContent(html: string, url: string): ScrapedPage {
  const $ = cheerio.load(html);
  const contentEl = $("main .flex-1");
  const title = contentEl.find("h1").first().text().trim();

  const sections: Section[] = [];
  let currentHeading = "";
  let currentText: string[] = [];

  contentEl.find("h1, h2, h3, p, li, pre, blockquote").each((_, el) => {
    const tag = el.tagName;
    if (tag === "h1") return;
    if (tag === "h2" || tag === "h3") {
      const text = currentText.join(" ").replace(/\s+/g, " ").trim();
      if (text) sections.push({ heading: currentHeading, text });
      currentHeading = $(el).text().trim();
      currentText = [];
    } else {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text) currentText.push(text);
    }
  });

  const remainingText = currentText.join(" ").replace(/\s+/g, " ").trim();
  if (remainingText) sections.push({ heading: currentHeading, text: remainingText });

  return { url, title, sections, scrapedAt: new Date().toISOString() };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const baseUrl = env.DOCS_BASE_URL();
  console.log(`[scrape] Starting from ${baseUrl}`);

  const { html: indexHtml } = await fetchHtml(baseUrl);
  const pageUrls = extractNavLinks(indexHtml, baseUrl);
  console.log(`[scrape] Found ${pageUrls.length} pages`);

  const pages: ScrapedPage[] = [];

  for (const url of pageUrls) {
    console.log(`[scrape] Fetching ${url}`);
    try {
      const { html, finalUrl } = await fetchHtml(url);
      pages.push(extractPageContent(html, finalUrl));
    } catch (err) {
      console.error(`[scrape] Failed ${url}: ${err}`);
    }
    if (url !== pageUrls.at(-1)) await sleep(300);
  }

  const outDir = path.join(process.cwd(), "data");
  const outPath = path.join(outDir, "scraped.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(pages, null, 2));
  console.log(`[scrape] Wrote ${pages.length} pages to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
