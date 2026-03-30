/**
 * Remove news and threat items that fail cybersecurity relevance.
 * Only applies to items from RSS sources (not CERT-In, CISA KEV, NVD, URLhaus, ThreatFox, Ransomware.live, Feodo).
 * Run: pnpm --filter @workspace/scripts run reclassify-remove-non-cyber
 * Add --dry-run to preview without deleting.
 */

import { db, newsItemsTable, threatIntelTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { cyberRelevanceDetector } from "@workspace/feed-aggregator";

const SECURITY_CURATED_SOURCES = new Set([
  "CERT-In",
  "CERT-In Advisories",
  "CISA KEV",
  "CISA Alerts",
  "CISA ICS Advisories",
  "US-CERT",
  "NVD",
  "NIST",
  "URLhaus",
  "ThreatFox",
  "Ransomware.live",
  "Ransomware News", // RSS from ransomware.live - inherently cyber
  "Feodo Tracker",
]);

function isRssSource(source: string): boolean {
  const lower = source.toLowerCase();
  return ![...SECURITY_CURATED_SOURCES].some((s) => lower.includes(s.toLowerCase()));
}

async function removeNonCyber() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("[DRY RUN] Would remove non-cybersecurity items from RSS-sourced data...\n");
  else console.log("Removing non-cybersecurity items from RSS-sourced data...\n");

  const allThreats = await db.select().from(threatIntelTable);
  const allNews = await db.select().from(newsItemsTable);

  const threatsToRemove: number[] = [];
  const newsToRemove: number[] = [];

  for (const threat of allThreats) {
    if (!isRssSource(threat.source)) continue;

    const fullText = `${threat.title ?? ""} ${threat.summary ?? ""} ${threat.description ?? ""}`;
    const relevance = cyberRelevanceDetector.isRelevant(fullText, { source: threat.source });

    if (!relevance.isRelevant) {
      threatsToRemove.push(threat.id);
      console.log(`  REMOVE (threat): ${threat.title.substring(0, 60)}... [${threat.source}] (${relevance.reason ?? "low confidence"})`);
    }
  }

  for (const item of allNews) {
    if (!isRssSource(item.source)) continue;

    const fullText = `${item.title ?? ""} ${item.summary ?? ""} ${item.content ?? ""}`;
    const relevance = cyberRelevanceDetector.isRelevant(fullText, { source: item.source });

    if (!relevance.isRelevant) {
      newsToRemove.push(item.id);
      console.log(`  REMOVE (news): ${item.title.substring(0, 60)}... [${item.source}] (${relevance.reason ?? "low confidence"})`);
    }
  }

  if (!dryRun) {
    if (threatsToRemove.length > 0) {
      await db.delete(threatIntelTable).where(inArray(threatIntelTable.id, threatsToRemove));
    }
    if (newsToRemove.length > 0) {
      await db.delete(newsItemsTable).where(inArray(newsItemsTable.id, newsToRemove));
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(dryRun ? "Reclassify Remove Non-Cyber (Dry Run) Complete:" : "Reclassify Remove Non-Cyber Complete:");
  console.log(`  Threats ${dryRun ? "would be " : ""}removed: ${threatsToRemove.length}`);
  console.log(`  News ${dryRun ? "would be " : ""}removed: ${newsToRemove.length}`);
  console.log(`  Total ${dryRun ? "would be " : ""}removed: ${threatsToRemove.length + newsToRemove.length}`);
  console.log(`${"=".repeat(50)}\n`);
}

removeNonCyber().catch((err) => {
  console.error(err);
  process.exit(1);
});
