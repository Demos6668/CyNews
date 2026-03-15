/**
 * Reclassify all threat_intel and news_items for India scope detection.
 * Run: pnpm --filter @workspace/scripts run reclassify-scope
 */

import { db, newsItemsTable, threatIntelTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { indiaDetector } from "@workspace/india-detector";

async function reclassifyAll() {
  console.log("Re-classifying all threats and news for India detection...\n");

  const allThreats = await db.select().from(threatIntelTable);
  const allNews = await db.select().from(newsItemsTable);

  console.log(`Found ${allThreats.length} threats and ${allNews.length} news items to process\n`);

  let localCount = 0;
  let globalCount = 0;
  let updated = 0;

  for (const threat of allThreats) {
    const fullText = `${threat.title ?? ""} ${threat.summary ?? ""} ${threat.description ?? ""}`;
    const detection = indiaDetector.isIndiaRelated(fullText, { source: threat.source });
    const state = indiaDetector.detectState(fullText);
    const sector = indiaDetector.detectSector(fullText);

    const newScope = indiaDetector.isIndianSource(threat.source) ? "local" : detection.scope;

    const indiaFields = {
      scope: newScope,
      isIndiaRelated: detection.isIndia,
      indiaConfidence: detection.confidence,
      indianState: state?.code ?? null,
      indianStateName: state?.state ?? null,
      indianCity: state?.city ?? null,
      indianSector: sector ?? null,
    };

    const needsUpdate =
      threat.scope !== newScope ||
      threat.isIndiaRelated !== detection.isIndia ||
      threat.indiaConfidence !== detection.confidence;

    if (needsUpdate) {
      await db.update(threatIntelTable).set(indiaFields).where(eq(threatIntelTable.id, threat.id));
      updated++;
      if (detection.isIndia) {
        console.log(`  LOCAL: ${threat.title.substring(0, 60)}... (confidence: ${detection.confidence})`);
      }
    }

    if (newScope === "local") localCount++;
    else globalCount++;
  }

  for (const item of allNews) {
    const fullText = `${item.title ?? ""} ${item.summary ?? ""} ${item.content ?? ""}`;
    const detection = indiaDetector.isIndiaRelated(fullText, { source: item.source });
    const state = indiaDetector.detectState(fullText);
    const sector = indiaDetector.detectSector(fullText);

    const newScope = indiaDetector.isIndianSource(item.source) ? "local" : detection.scope;

    const indiaFields = {
      scope: newScope,
      isIndiaRelated: detection.isIndia,
      indiaConfidence: detection.confidence,
      indianState: state?.code ?? null,
      indianStateName: state?.state ?? null,
      indianCity: state?.city ?? null,
      indianSector: sector ?? null,
    };

    const needsUpdate =
      item.scope !== newScope ||
      item.isIndiaRelated !== detection.isIndia ||
      item.indiaConfidence !== detection.confidence;

    if (needsUpdate) {
      await db.update(newsItemsTable).set(indiaFields).where(eq(newsItemsTable.id, item.id));
      updated++;
      if (detection.isIndia) {
        console.log(`  LOCAL: ${item.title.substring(0, 60)}... (confidence: ${detection.confidence})`);
      }
    }

    if (newScope === "local") localCount++;
    else globalCount++;
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log("Re-classification Complete:");
  console.log(`  Total: ${allThreats.length + allNews.length}`);
  console.log(`  Local (India): ${localCount}`);
  console.log(`  Global: ${globalCount}`);
  console.log(`  Updated: ${updated}`);
  console.log(`${"=".repeat(50)}\n`);
}

reclassifyAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
