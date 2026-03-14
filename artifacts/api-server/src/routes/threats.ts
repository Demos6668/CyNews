import { Router, type IRouter, type Request, type Response } from "express";
import { db, newsItemsTable } from "@workspace/db";
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

function formatNewsItem(item: typeof newsItemsTable.$inferSelect) {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    content: item.content,
    type: item.type,
    scope: item.scope,
    severity: item.severity,
    category: item.category,
    source: item.source,
    sourceUrl: item.sourceUrl,
    region: (item.region as string[]) ?? [],
    tags: (item.tags as string[]) ?? [],
    iocs: (item.iocs as string[]) ?? [],
    affectedSystems: (item.affectedSystems as string[]) ?? [],
    mitigations: (item.mitigations as string[]) ?? [],
    status: item.status,
    bookmarked: item.bookmarked,
    publishedAt: item.publishedAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

router.get("/threats/export", async (req: Request, res: Response) => {
  try {
    const query = ExportThreatsQueryParams.parse(req.query);
    const conditions: SQL[] = [eq(newsItemsTable.type, "threat")];

    if (query.scope) conditions.push(eq(newsItemsTable.scope, query.scope));
    if (query.severity) conditions.push(eq(newsItemsTable.severity, query.severity));

    const items = await db
      .select()
      .from(newsItemsTable)
      .where(and(...conditions))
      .orderBy(sql`${newsItemsTable.publishedAt} DESC`);

    const headers = ["ID", "Title", "Summary", "Severity", "Scope", "Category", "Source", "Status", "IOCs", "Affected Systems", "Mitigations", "Published At"];
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
        sanitizeCsvField(item.source ?? ""),
        item.status,
        sanitizeCsvField(((item.iocs as string[]) ?? []).join("; ")),
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
      .from(newsItemsTable)
      .where(and(eq(newsItemsTable.id, params.id), eq(newsItemsTable.type, "threat")));

    if (!item) {
      res.status(404).json({ error: "Threat not found" });
      return;
    }

    const data = GetThreatByIdResponse.parse(formatNewsItem(item));
    res.json(data);
  } catch (error) {
    console.error("Threat detail error:", error);
    res.status(500).json({ error: "Failed to fetch threat" });
  }
});

router.get("/threats", async (req: Request, res: Response) => {
  try {
    const query = GetThreatsQueryParams.parse(req.query);
    const conditions: SQL[] = [eq(newsItemsTable.type, "threat")];

    if (query.scope) conditions.push(eq(newsItemsTable.scope, query.scope));
    if (query.severity) conditions.push(eq(newsItemsTable.severity, query.severity));
    if (query.category) conditions.push(eq(newsItemsTable.category, query.category));
    if (query.status) conditions.push(eq(newsItemsTable.status, query.status));

    const where = and(...conditions);

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsItemsTable)
      .where(where);

    const total = totalResult?.count ?? 0;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const items = await db
      .select()
      .from(newsItemsTable)
      .where(where)
      .orderBy(sql`${newsItemsTable.publishedAt} DESC`)
      .limit(limit)
      .offset(offset);

    const data = GetThreatsResponse.parse({
      items: items.map(formatNewsItem),
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
