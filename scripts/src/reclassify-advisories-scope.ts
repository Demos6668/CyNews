/**
 * Reclassify all advisories for India scope detection.
 * Run: pnpm --filter @workspace/scripts run reclassify-advisories-scope
 */

import { db, advisoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { indiaDetector } from "@workspace/india-detector";

async function reclassifyAdvisories() {
  console.log("Re-classifying all advisories for India scope detection...\n");

  const allAdvisories = await db.select().from(advisoriesTable);
  console.log(`Found ${allAdvisories.length} advisories to process\n`);

  let localCount = 0;
  let globalCount = 0;
  let updated = 0;

  for (const advisory of allAdvisories) {
    const refs = (advisory.references as string[]) ?? [];
    const refsText = refs.join(" ");
    const fullText = `${advisory.title ?? ""} ${advisory.description ?? ""} ${advisory.vendor ?? ""} ${refsText}`;
    const detection = indiaDetector.isIndiaRelated(fullText, { source: advisory.vendor ?? "" });

    const newScope = indiaDetector.isIndianSource(advisory.vendor ?? "") ? "local" : detection.scope;

    const indiaFields = {
      scope: newScope,
      isIndiaRelated: detection.isIndia,
      indiaConfidence: detection.confidence,
    };

    const needsUpdate =
      advisory.scope !== newScope ||
      advisory.isIndiaRelated !== detection.isIndia ||
      advisory.indiaConfidence !== detection.confidence;

    if (needsUpdate) {
      await db.update(advisoriesTable).set(indiaFields).where(eq(advisoriesTable.id, advisory.id));
      updated++;
      if (detection.isIndia) {
        console.log(`  LOCAL: ${advisory.cveId} - ${advisory.title.substring(0, 50)}... (confidence: ${detection.confidence})`);
      }
    }

    if (newScope === "local") localCount++;
    else globalCount++;
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log("Advisory re-classification complete:");
  console.log(`  Total: ${allAdvisories.length}`);
  console.log(`  Local (India): ${localCount}`);
  console.log(`  Global: ${globalCount}`);
  console.log(`  Updated: ${updated}`);
  console.log(`${"=".repeat(50)}\n`);
}

reclassifyAdvisories().catch((err) => {
  console.error(err);
  process.exit(1);
});
