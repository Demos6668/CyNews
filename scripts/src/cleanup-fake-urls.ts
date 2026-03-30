/**
 * Cleanup Fake URLs - Find and optionally remove news/threat items with invalid sourceUrl.
 * Run: pnpm --filter @workspace/scripts run cleanup-fake-urls
 * To delete: pnpm --filter @workspace/scripts run cleanup-fake-urls -- --delete
 */

import { db, newsItemsTable, threatIntelTable } from "@workspace/db";

const FAKE_PATTERNS = ["example.com", "placeholder", "localhost", "test.com", "fake", "dummy"];

function isInvalidUrl(url: string | null | undefined): boolean {
  if (url === null || url === undefined) return true;
  if (typeof url !== "string" || url.trim() === "") return true;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return true;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes(".")) return true;
    const hostLower = parsed.hostname.toLowerCase();
    if (FAKE_PATTERNS.some((p) => hostLower.includes(p))) return true;
    return false;
  } catch {
    return true;
  }
}

async function main() {
  const deleteFlag = process.argv.includes("--delete");

  const newsItems = await db.select({ id: newsItemsTable.id, title: newsItemsTable.title, sourceUrl: newsItemsTable.sourceUrl }).from(newsItemsTable);
  const threatItems = await db.select({ id: threatIntelTable.id, title: threatIntelTable.title, sourceUrl: threatIntelTable.sourceUrl }).from(threatIntelTable);

  const flaggedNews = newsItems.filter((r) => isInvalidUrl(r.sourceUrl));
  const flaggedThreats = threatItems.filter((r) => isInvalidUrl(r.sourceUrl));

  console.log(`[cleanup-fake-urls] News items with invalid sourceUrl: ${flaggedNews.length}`);
  for (const r of flaggedNews) {
    const title = r.title.length > 50 ? r.title.slice(0, 50) + "…" : r.title;
    console.log(`  - id=${r.id} sourceUrl=${r.sourceUrl ?? "(null)"} title=${title}`);
  }

  console.log(`[cleanup-fake-urls] Threat intel with invalid sourceUrl: ${flaggedThreats.length}`);
  for (const r of flaggedThreats) {
    const title = r.title.length > 50 ? r.title.slice(0, 50) + "…" : r.title;
    console.log(`  - id=${r.id} sourceUrl=${r.sourceUrl ?? "(null)"} title=${title}`);
  }

  const total = flaggedNews.length + flaggedThreats.length;
  if (total === 0) {
    console.log("[cleanup-fake-urls] No items to clean. Done.");
    return;
  }

  if (deleteFlag) {
    const { inArray } = await import("drizzle-orm");
    if (flaggedNews.length > 0) {
      await db.delete(newsItemsTable).where(inArray(newsItemsTable.id, flaggedNews.map((r) => r.id)));
      console.log(`[cleanup-fake-urls] Deleted ${flaggedNews.length} news items.`);
    }
    if (flaggedThreats.length > 0) {
      await db.delete(threatIntelTable).where(inArray(threatIntelTable.id, flaggedThreats.map((r) => r.id)));
      console.log(`[cleanup-fake-urls] Deleted ${flaggedThreats.length} threat intel items.`);
    }
    console.log("[cleanup-fake-urls] Re-run LiveFeedAggregator to repopulate: pnpm --filter @workspace/scripts run live-feed");
  } else {
    console.log(`[cleanup-fake-urls] ${total} items flagged. Add --delete to remove them.`);
  }
}

main().catch((err) => {
  console.error("[cleanup-fake-urls] Error:", err);
  process.exit(1);
});
