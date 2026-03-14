import { Router, type IRouter, type Request, type Response } from "express";
import { db, threatIntelTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  GetThreatsQueryParams,
  GetThreatsResponse,
  GetThreatByIdParams,
  GetThreatByIdResponse,
  ExportThreatsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatThreatIntel(item: typeof threatIntelTable.$inferSelect) {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    description: item.description,
    scope: item.scope,
    severity: item.severity,
    category: item.category,
    threatActor: item.threatActor,
    threatActorAliases: (item.threatActorAliases as string[]) ?? [],
    targetSectors: (item.targetSectors as string[]) ?? [],
    targetRegions: (item.targetRegions as string[]) ?? [],
    ttps: (item.ttps as string[]) ?? [],
    iocs: (item.iocs as string[]) ?? [],
    malwareFamilies: (item.malwareFamilies as string[]) ?? [],
    affectedSystems: (item.affectedSystems as string[]) ?? [],
    mitigations: (item.mitigations as string[]) ?? [],
    source: item.source,
    sourceUrl: item.sourceUrl,
    references: (item.references as string[]) ?? [],
    campaignName: item.campaignName,
    status: item.status,
    confidenceLevel: item.confidenceLevel,
    firstSeen: item.firstSeen?.toISOString() ?? null,
    lastSeen: item.lastSeen?.toISOString() ?? null,
    publishedAt: item.publishedAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

router.get("/threats/export", async (req: Request, res: Response) => {
  try {
    const query = ExportThreatsQueryParams.parse(req.query);
    const conditions: SQL[] = [];

    if (query.scope) conditions.push(eq(threatIntelTable.scope, query.scope));
    if (query.severity) conditions.push(eq(threatIntelTable.severity, query.severity));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select()
      .from(threatIntelTable)
      .where(where)
      .orderBy(sql`${threatIntelTable.publishedAt} DESC`);

    const headers = ["ID", "Title", "Summary", "Severity", "Scope", "Category", "Threat Actor", "Campaign", "Source", "Status", "Confidence", "TTPs", "IOCs", "Malware Families", "Affected Systems", "Mitigations", "Published At"];
    const csvRows = [headers.join(",")];

    const sanitizeCsvField = (val: string): string => {
      let sanitized = val.replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(sanitized)) {
        sanitized = "'" + sanitized;
      }
      return `"${sanitized}"`;
    };

    for (const item of items) {
      const row = [
        item.id,
        sanitizeCsvField(item.title ?? ""),
        sanitizeCsvField(item.summary ?? ""),
        item.severity,
        item.scope,
        item.category,
        sanitizeCsvField(item.threatActor ?? ""),
        sanitizeCsvField(item.campaignName ?? ""),
        sanitizeCsvField(item.source ?? ""),
        item.status,
        item.confidenceLevel,
        sanitizeCsvField(((item.ttps as string[]) ?? []).join("; ")),
        sanitizeCsvField(((item.iocs as string[]) ?? []).join("; ")),
        sanitizeCsvField(((item.malwareFamilies as string[]) ?? []).join("; ")),
        sanitizeCsvField(((item.affectedSystems as string[]) ?? []).join("; ")),
        sanitizeCsvField(((item.mitigations as string[]) ?? []).join("; ")),
        item.publishedAt.toISOString(),
      ];
      csvRows.push(row.join(","));
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=threats-export.csv");
    res.send(csvRows.join("\n"));
  } catch (error) {
    console.error("Export threats error:", error);
    res.status(500).json({ error: "Failed to export threats" });
  }
});

router.get("/threats/:id", async (req: Request, res: Response) => {
  try {
    const params = GetThreatByIdParams.parse({ id: Number(req.params.id) });

    const [item] = await db
      .select()
      .from(threatIntelTable)
      .where(eq(threatIntelTable.id, params.id));

    if (!item) {
      res.status(404).json({ error: "Threat not found" });
      return;
    }

    const data = GetThreatByIdResponse.parse(formatThreatIntel(item));
    res.json(data);
  } catch (error) {
    console.error("Threat detail error:", error);
    res.status(500).json({ error: "Failed to fetch threat" });
  }
});

router.get("/threats", async (req: Request, res: Response) => {
  try {
    const query = GetThreatsQueryParams.parse(req.query);
    const conditions: SQL[] = [];

    if (query.scope) conditions.push(eq(threatIntelTable.scope, query.scope));
    if (query.severity) conditions.push(eq(threatIntelTable.severity, query.severity));
    if (query.category) conditions.push(eq(threatIntelTable.category, query.category));
    if (query.status) conditions.push(eq(threatIntelTable.status, query.status));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(threatIntelTable)
      .where(where);

    const total = totalResult?.count ?? 0;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const items = await db
      .select()
      .from(threatIntelTable)
      .where(where)
      .orderBy(sql`${threatIntelTable.publishedAt} DESC`)
      .limit(limit)
      .offset(offset);

    const data = GetThreatsResponse.parse({
      items: items.map(formatThreatIntel),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });

    res.json(data);
  } catch (error) {
    console.error("Threats list error:", error);
    res.status(500).json({ error: "Failed to fetch threats" });
  }
});

export default router;
