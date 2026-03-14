import { Router, type IRouter, type Request, type Response } from "express";
import { db, advisoriesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  GetAdvisoriesQueryParams,
  GetAdvisoriesResponse,
  GetAdvisoryByIdParams,
  GetAdvisoryByIdResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatAdvisory(item: typeof advisoriesTable.$inferSelect) {
  return {
    id: item.id,
    cveId: item.cveId,
    title: item.title,
    description: item.description,
    cvssScore: item.cvssScore,
    severity: item.severity,
    affectedProducts: (item.affectedProducts as string[]) ?? [],
    vendor: item.vendor,
    patchAvailable: item.patchAvailable,
    patchUrl: item.patchUrl,
    workarounds: (item.workarounds as string[]) ?? [],
    references: (item.references as string[]) ?? [],
    status: item.status,
    publishedAt: item.publishedAt.toISOString(),
  };
}

router.get("/advisories", async (req: Request, res: Response) => {
  try {
    const query = GetAdvisoriesQueryParams.parse(req.query);
    const conditions: SQL[] = [];

    if (query.severity) conditions.push(eq(advisoriesTable.severity, query.severity));
    if (query.vendor) conditions.push(eq(advisoriesTable.vendor, query.vendor));
    if (query.status) conditions.push(eq(advisoriesTable.status, query.status));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(advisoriesTable)
      .where(where);

    const total = totalResult?.count ?? 0;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const items = await db
      .select()
      .from(advisoriesTable)
      .where(where)
      .orderBy(sql`${advisoriesTable.publishedAt} DESC`)
      .limit(limit)
      .offset(offset);

    const data = GetAdvisoriesResponse.parse({
      items: items.map(formatAdvisory),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });

    res.json(data);
  } catch (error) {
    console.error("Advisories list error:", error);
    res.status(500).json({ error: "Failed to fetch advisories" });
  }
});

router.get("/advisories/:id", async (req: Request, res: Response) => {
  try {
    const params = GetAdvisoryByIdParams.parse({ id: Number(req.params.id) });

    const [item] = await db
      .select()
      .from(advisoriesTable)
      .where(eq(advisoriesTable.id, params.id));

    if (!item) {
      res.status(404).json({ error: "Advisory not found" });
      return;
    }

    const data = GetAdvisoryByIdResponse.parse(formatAdvisory(item));
    res.json(data);
  } catch (error) {
    console.error("Advisory detail error:", error);
    res.status(500).json({ error: "Failed to fetch advisory" });
  }
});

export default router;
