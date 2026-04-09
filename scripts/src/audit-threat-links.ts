/**
 * Audit and normalize threat source links and remove duplicate threat rows.
 * Run: pnpm --filter @workspace/scripts run audit-threat-links
 */

import { db, threatIntelTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

type ThreatRow = typeof threatIntelTable.$inferSelect;

const syntheticThreatFixtures = new Set([
  "CrowdStrike Intelligence|LockBit 4.0 Ransomware Campaign|https://crowdstrike.com/blog/lockbit-4",
  "Microsoft Threat Intelligence|APT29 CloudNight Backdoor Campaign|https://microsoft.com/security/blog",
  "ICS-CERT|GridShock ICS/SCADA Malware|https://ics-cert.us-cert.gov/",
  "Kaspersky GReAT|Lazarus Cryptocurrency Exchange Campaign|https://securelist.com/",
  "Proofpoint|Emotet Botnet Resurgence via OneNote|https://proofpoint.com/threat-insight",
  "Fortinet PSIRT|FortiOS Authentication Bypass Exploitation|https://fortiguard.com/psirt",
  "FBI Cyber Division|Regional Government Phishing Campaign|https://ic3.gov/alerts",
  "Claroty Research|IoT Sensor Vulnerabilities in Industrial Settings|https://claroty.com/research",
  "US-CERT|Apache Struts Zero-Day Active Exploitation|https://us-cert.cisa.gov/ncas/alerts",
]);

function normalizeUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

function dedupeUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const url of urls) {
    const normalized = normalizeUrl(url);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

function threatKey(row: ThreatRow): string {
  const sourceUrl = normalizeUrl(row.sourceUrl);
  if (sourceUrl) return `url:${sourceUrl}`;

  return `fallback:${row.source.trim()}|${row.title.trim()}|${row.publishedAt.toISOString()}`;
}

function threatFixtureKey(row: ThreatRow): string {
  return `${row.source.trim()}|${row.title.trim()}|${normalizeUrl(row.sourceUrl) ?? ""}`;
}

function compareThreatRows(left: ThreatRow, right: ThreatRow): number {
  const updatedDiff = right.updatedAt.getTime() - left.updatedAt.getTime();
  if (updatedDiff !== 0) return updatedDiff;
  return right.id - left.id;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function auditThreatLinks() {
  console.log("Auditing threat link integrity and duplicates...\n");

  const threats = await db.select().from(threatIntelTable);
  console.log(`Found ${threats.length} threat rows`);

  const syntheticFixtureIds = threats
    .filter((threat) => syntheticThreatFixtures.has(threatFixtureKey(threat)))
    .map((threat) => threat.id);
  const syntheticFixtureIdSet = new Set(syntheticFixtureIds);

  if (syntheticFixtureIds.length > 0) {
    console.log(`Found ${syntheticFixtureIds.length} synthetic threat fixture rows to remove`);
  }

  const grouped = new Map<string, ThreatRow[]>();
  for (const threat of threats) {
    if (syntheticFixtureIdSet.has(threat.id)) continue;
    const key = threatKey(threat);
    const current = grouped.get(key) ?? [];
    current.push(threat);
    grouped.set(key, current);
  }

  const deleteIds = [...syntheticFixtureIds];
  let duplicateDeleteCount = 0;
  let duplicateGroups = 0;

  for (const rows of grouped.values()) {
    if (rows.length < 2) continue;
    duplicateGroups++;
    rows.sort(compareThreatRows);
    const duplicateIds = rows.slice(1).map((row) => row.id);
    duplicateDeleteCount += duplicateIds.length;
    deleteIds.push(...duplicateIds);
  }

  let updatedRows = 0;
  let dedupedReferenceRows = 0;
  let normalizedSourceUrls = 0;

  for (const rows of grouped.values()) {
    const survivor = rows.slice().sort(compareThreatRows)[0];
    const sourceUrl = normalizeUrl(survivor.sourceUrl);
    const references = dedupeUrls((survivor.references as string[]) ?? []).filter(
      (ref) => ref !== sourceUrl
    );

    const sourceChanged = survivor.sourceUrl !== sourceUrl;
    const referencesChanged =
      JSON.stringify((survivor.references as string[]) ?? []) !== JSON.stringify(references);

    if (!sourceChanged && !referencesChanged) continue;

    await db
      .update(threatIntelTable)
      .set({
        sourceUrl,
        references,
      })
      .where(eq(threatIntelTable.id, survivor.id));

    updatedRows++;
    if (sourceChanged) normalizedSourceUrls++;
    if (referencesChanged) dedupedReferenceRows++;
  }

  for (const ids of chunk(deleteIds, 500)) {
    await db.delete(threatIntelTable).where(inArray(threatIntelTable.id, ids));
  }

  console.log(`Deleted ${syntheticFixtureIds.length} synthetic threat fixture rows`);
  console.log(`Deleted ${duplicateDeleteCount} duplicate threat rows across ${duplicateGroups} duplicate groups`);
  console.log(`Updated ${updatedRows} surviving rows`);
  console.log(`  Normalized source URLs: ${normalizedSourceUrls}`);
  console.log(`  Deduped references: ${dedupedReferenceRows}`);
}

auditThreatLinks().catch((error) => {
  console.error(error);
  process.exit(1);
});
