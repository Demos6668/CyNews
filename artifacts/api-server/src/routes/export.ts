import { Router, type IRouter, type Request, type Response } from "express";
import { db, advisoriesTable } from "@workspace/db";
import { eq, gte, inArray, desc, and } from "drizzle-orm";
import { getTimeframeStartDate, type TimeframeValue } from "../lib/timeframe";
import { generateAdvisoryHTML, generateBulkAdvisoryHTML } from "../services/exportService";

const router: IRouter = Router();
const MAX_BULK_IDS = 50;

function toAdvisoryForExport(row: typeof advisoriesTable.$inferSelect) {
  return {
    id: row.id,
    cveId: row.cveId,
    title: row.title,
    description: row.description,
    cvssScore: row.cvssScore,
    severity: row.severity,
    affectedProducts: (row.affectedProducts as string[]) ?? [],
    vendor: row.vendor,
    patchAvailable: row.patchAvailable,
    patchUrl: row.patchUrl,
    workarounds: (row.workarounds as string[]) ?? [],
    references: (row.references as string[]) ?? [],
    status: row.status,
    publishedAt: row.publishedAt.toISOString(),
    scope: row.scope,
    isIndiaRelated: row.isIndiaRelated ?? undefined,
    indiaConfidence: row.indiaConfidence ?? undefined,
  };
}

router.get("/export/advisory/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: "Invalid advisory ID" });
      return;
    }

    const [item] = await db
      .select()
      .from(advisoriesTable)
      .where(eq(advisoriesTable.id, id));

    if (!item) {
      res.status(404).json({ error: "Advisory not found" });
      return;
    }

    const advisory = toAdvisoryForExport(item);
    const html = generateAdvisoryHTML(advisory);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${item.cveId.replace(/[^a-zA-Z0-9-]/g, "_")}-advisory.html"`
    );
    res.send(html);
  } catch (error) {
    console.error("Export advisory error:", error);
    res.status(500).json({ error: "Failed to export advisory" });
  }
});

router.post("/export/advisories/bulk", async (req: Request, res: Response) => {
  try {
    const body = req.body as { ids?: number[]; timeframe?: string; scope?: "local" | "global" };
    let items: typeof advisoriesTable.$inferSelect[];

    if (body.ids && Array.isArray(body.ids)) {
      const ids = body.ids.slice(0, MAX_BULK_IDS).filter((id) => Number.isInteger(id) && id > 0);
      if (ids.length === 0) {
        res.status(400).json({ error: "No valid advisory IDs provided" });
        return;
      }
      items = await db
        .select()
        .from(advisoriesTable)
        .where(inArray(advisoriesTable.id, ids))
        .orderBy(desc(advisoriesTable.publishedAt));
    } else if (body.timeframe && typeof body.timeframe === "string") {
      const validTimeframes: TimeframeValue[] = ["1h", "6h", "24h", "7d", "30d", "all"];
      const tf = validTimeframes.includes(body.timeframe as TimeframeValue)
        ? (body.timeframe as TimeframeValue)
        : "24h";
      const fromDate = getTimeframeStartDate(tf);
      const scopeFilter = body.scope === "local" || body.scope === "global" ? body.scope : undefined;
      const conditions = [];
      if (fromDate) conditions.push(gte(advisoriesTable.publishedAt, fromDate));
      if (scopeFilter) conditions.push(eq(advisoriesTable.scope, scopeFilter));
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      items = await db
        .select()
        .from(advisoriesTable)
        .where(where)
        .orderBy(desc(advisoriesTable.publishedAt))
        .limit(MAX_BULK_IDS);
    } else {
      res.status(400).json({ error: "Provide ids or timeframe in request body" });
      return;
    }

    if (items.length === 0) {
      res.status(404).json({ error: "No advisories found" });
      return;
    }

    const advisories = items.map(toAdvisoryForExport);
    const html = generateBulkAdvisoryHTML(advisories, "Security Advisories Report");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="cyfy-advisories-${new Date().toISOString().slice(0, 10)}.html"`
    );
    res.send(html);
  } catch (error) {
    console.error("Bulk export error:", error);
    res.status(500).json({ error: "Failed to export advisories" });
  }
});

export default router;
