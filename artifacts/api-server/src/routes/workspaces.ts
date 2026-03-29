import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  workspacesTable,
  workspaceProductsTable,
  workspaceThreatMatchesTable,
} from "@workspace/db";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  ensureMasterWorkspace,
  createWorkspace,
  addProduct,
  matchThreatsToWorkspace,
  getWorkspaceFeed,
} from "../services/workspaceService";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function isValidUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

router.get("/workspaces", async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(workspacesTable)
      .orderBy(desc(workspacesTable.isDefault), asc(workspacesTable.name));

    res.json(rows.map((r) => ({
      id: r.id,
      name: r.name,
      domain: r.domain,
      description: r.description,
      isDefault: r.isDefault ?? false,
      createdAt: r.createdAt?.toISOString() ?? null,
      updatedAt: r.updatedAt?.toISOString() ?? null,
    })));
  } catch (error) {
    logger.error({ err: error }, "List workspaces error");
    res.status(500).json({ error: "Failed to list workspaces" });
  }
});

router.get("/workspaces/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id ?? "");
    if (!isValidUuid(id)) {
      res.status(400).json({ error: "Invalid workspace ID" });
      return;
    }

    const [workspace] = await db
      .select()
      .from(workspacesTable)
      .where(eq(workspacesTable.id, id))
      .limit(1);

    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const products = await db
      .select()
      .from(workspaceProductsTable)
      .where(eq(workspaceProductsTable.workspaceId, id));

    res.json({
      ...workspace,
      products: products.map((p) => ({
        id: p.id,
        productName: p.productName,
        vendor: p.vendor,
        version: p.version,
        category: p.category,
        enabled: p.enabled,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, "Get workspace error");
    res.status(500).json({ error: "Failed to get workspace" });
  }
});

router.post("/workspaces", async (req: Request, res: Response) => {
  try {
    const { name, domain, description, products } = req.body;
    if (!name || !domain) {
      res.status(400).json({ error: "Name and domain are required" });
      return;
    }

    const workspace = await createWorkspace({
      name: String(name),
      domain: String(domain),
      description: description ? String(description) : undefined,
      products: Array.isArray(products) ? products : undefined,
    });

    res.status(201).json({
      id: workspace.id,
      name: workspace.name,
      domain: workspace.domain,
      description: workspace.description,
      isDefault: workspace.isDefault ?? false,
    });
  } catch (error) {
    logger.error({ err: error }, "Create workspace error");
    res.status(500).json({ error: "Failed to create workspace" });
  }
});

router.put("/workspaces/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id ?? "");
    if (!isValidUuid(id)) {
      res.status(400).json({ error: "Invalid workspace ID" });
      return;
    }

    const { name, domain, description } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = String(name);
    if (domain !== undefined) updates.domain = String(domain);
    if (description !== undefined) updates.description = String(description);
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(workspacesTable)
      .set(updates as Record<string, unknown>)
      .where(eq(workspacesTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Update workspace error");
    res.status(500).json({ error: "Failed to update workspace" });
  }
});

router.delete("/workspaces/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id ?? "");
    if (!isValidUuid(id)) {
      res.status(400).json({ error: "Invalid workspace ID" });
      return;
    }

    const [workspace] = await db
      .select()
      .from(workspacesTable)
      .where(eq(workspacesTable.id, id))
      .limit(1);

    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    if (workspace.isDefault) {
      res.status(400).json({ error: "Cannot delete master workspace" });
      return;
    }

    await db.delete(workspacesTable).where(eq(workspacesTable.id, id));
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Delete workspace error");
    res.status(500).json({ error: "Failed to delete workspace" });
  }
});

router.post("/workspaces/:id/products", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id ?? "");
    if (!isValidUuid(id)) {
      res.status(400).json({ error: "Invalid workspace ID" });
      return;
    }

    const { name, vendor, version, category } = req.body;
    if (!name) {
      res.status(400).json({ error: "Product name is required" });
      return;
    }

    const product = await addProduct(id, {
      name: String(name),
      vendor: vendor ? String(vendor) : undefined,
      version: version ? String(version) : undefined,
      category: category ? String(category) : undefined,
    });

    res.status(201).json(product);
  } catch (error) {
    logger.error({ err: error }, "Add product error");
    res.status(500).json({ error: "Failed to add product" });
  }
});

router.delete("/workspaces/:id/products/:productId", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id ?? "");
    const productId = String(req.params.productId ?? "");
    if (!isValidUuid(id) || !isValidUuid(productId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [product] = await db
      .select({ productName: workspaceProductsTable.productName })
      .from(workspaceProductsTable)
      .where(
        and(
          eq(workspaceProductsTable.workspaceId, id),
          eq(workspaceProductsTable.id, productId)
        )
      )
      .limit(1);

    await db
      .delete(workspaceProductsTable)
      .where(
        and(
          eq(workspaceProductsTable.workspaceId, id),
          eq(workspaceProductsTable.id, productId)
        )
      );

    if (product?.productName) {
      await db
        .delete(workspaceThreatMatchesTable)
        .where(
          and(
            eq(workspaceThreatMatchesTable.workspaceId, id),
            eq(workspaceThreatMatchesTable.matchedProduct, product.productName)
          )
        );
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Remove product error");
    res.status(500).json({ error: "Failed to remove product" });
  }
});

router.get("/workspaces/:id/feed", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id ?? "");
    if (!isValidUuid(id)) {
      res.status(400).json({ error: "Invalid workspace ID" });
      return;
    }

    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || 20));

    const { items, total } = await getWorkspaceFeed(id, { page, limit });

    const formatted = items.map((t) => ({
      id: t.id,
      title: t.title,
      summary: t.summary,
      description: t.description,
      scope: t.scope,
      severity: t.severity,
      category: t.category,
      threatActor: t.threatActor,
      threatActorAliases: (t.threatActorAliases as string[]) ?? [],
      targetSectors: (t.targetSectors as string[]) ?? [],
      targetRegions: (t.targetRegions as string[]) ?? [],
      ttps: (t.ttps as string[]) ?? [],
      iocs: (t.iocs as string[]) ?? [],
      malwareFamilies: (t.malwareFamilies as string[]) ?? [],
      affectedSystems: (t.affectedSystems as string[]) ?? [],
      mitigations: (t.mitigations as string[]) ?? [],
      source: t.source,
      sourceUrl: t.sourceUrl,
      references: (t.references as string[]) ?? [],
      campaignName: t.campaignName,
      status: t.status,
      confidenceLevel: t.confidenceLevel,
      firstSeen: t.firstSeen?.toISOString() ?? null,
      lastSeen: t.lastSeen?.toISOString() ?? null,
      publishedAt: t.publishedAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      matchedProduct: (t as { matchedProduct?: string }).matchedProduct,
      relevanceScore: (t as { relevanceScore?: number }).relevanceScore,
      reviewed: (t as { reviewed?: boolean }).reviewed,
      matchId: (t as { matchId?: string }).matchId,
    }));

    res.json({ items: formatted, total, page, limit });
  } catch (error) {
    logger.error({ err: error }, "Get feed error");
    res.status(500).json({ error: "Failed to get workspace feed" });
  }
});

router.post("/workspaces/:id/match", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id ?? "");
    if (!isValidUuid(id)) {
      res.status(400).json({ error: "Invalid workspace ID" });
      return;
    }

    const matches = await matchThreatsToWorkspace(id);
    res.json({ matchedCount: matches.length });
  } catch (error) {
    logger.error({ err: error }, "Match threats error");
    res.status(500).json({ error: "Failed to match threats" });
  }
});

router.put("/workspaces/:id/matches/:matchId", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id ?? "");
    const matchId = String(req.params.matchId ?? "");
    if (!isValidUuid(id) || !isValidUuid(matchId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const { reviewed, dismissed } = req.body;
    const updates: Record<string, unknown> = {};
    if (reviewed !== undefined) updates.reviewed = Boolean(reviewed);
    if (dismissed !== undefined) updates.dismissed = Boolean(dismissed);

    const [updated] = await db
      .update(workspaceThreatMatchesTable)
      .set(updates as Record<string, unknown>)
      .where(
        and(
          eq(workspaceThreatMatchesTable.workspaceId, id),
          eq(workspaceThreatMatchesTable.id, matchId)
        )
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Update match error");
    res.status(500).json({ error: "Failed to update match" });
  }
});

export default router;
