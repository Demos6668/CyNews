import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  workspacesTable,
  workspaceProductsTable,
  workspaceThreatMatchesTable,
} from "@workspace/db";
import { eq, and, desc, asc, isNull, or } from "drizzle-orm";
import { optionalAuth, requireAuth, DEFAULT_ORG_ID } from "../middlewares/tenantContext";
import {
  createWorkspace,
  addProduct,
  matchThreatsToWorkspace,
  getWorkspaceFeed,
  updateWorkspaceMatch,
} from "../services/workspaceService";
import { asyncHandler, NotFoundError } from "../middlewares/errorHandler";
import { scheduleSoftDelete, cancelSoftDelete } from "../services/softDelete";
import { validate } from "../middlewares/validate";
import {
  CreateWorkspaceBody,
  GetWorkspaceParams,
  UpdateWorkspaceParams,
  UpdateWorkspaceBody,
  DeleteWorkspaceParams,
  AddProductParams,
  AddProductBody,
  RemoveProductParams,
  GetWorkspaceFeedParams,
  GetWorkspaceFeedQueryParams,
  MatchWorkspaceThreatsParams,
  UpdateMatchParams,
  UpdateMatchBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/workspaces", optionalAuth, asyncHandler(async (req: Request, res: Response) => {
    // When org context is available, filter to the org's workspaces.
    // Fall back to showing all workspaces in unauthenticated/legacy mode.
    const orgId = req.ctx?.orgId;
    const rows = await db
      .select()
      .from(workspacesTable)
      .where(
        orgId
          ? eq(workspacesTable.orgId, orgId)
          : or(isNull(workspacesTable.orgId), eq(workspacesTable.orgId, DEFAULT_ORG_ID))
      )
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
}));

router.get("/workspaces/:id", optionalAuth, validate({ params: GetWorkspaceParams }), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const orgId = req.ctx?.orgId;

    const [workspace] = await db
      .select()
      .from(workspacesTable)
      .where(
        orgId
          ? and(eq(workspacesTable.id, id), eq(workspacesTable.orgId, orgId))
          : eq(workspacesTable.id, id)
      )
      .limit(1);

    if (!workspace) {
      throw new NotFoundError("Workspace not found");
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
}));

router.post("/workspaces", requireAuth, validate({ body: CreateWorkspaceBody }), asyncHandler(async (req: Request, res: Response) => {
    const { name, domain, description, products } = req.body;
    const orgId = req.ctx!.orgId;

    const workspace = await createWorkspace({
      name,
      domain,
      description: description ?? undefined,
      orgId,
      products: Array.isArray(products) ? products : undefined,
    });

    res.status(201).json({
      id: workspace.id,
      name: workspace.name,
      domain: workspace.domain,
      description: workspace.description,
      isDefault: workspace.isDefault ?? false,
    });
}));

router.put("/workspaces/:id", requireAuth, validate({ params: UpdateWorkspaceParams, body: UpdateWorkspaceBody }), asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.ctx!.orgId;
    const id = req.params.id as string;
    const [owned] = await db.select({ id: workspacesTable.id }).from(workspacesTable)
      .where(and(eq(workspacesTable.id, id), eq(workspacesTable.orgId, orgId))).limit(1);
    if (!owned) throw new NotFoundError("Workspace not found");

    const { name, domain, description } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (domain !== undefined) updates.domain = domain;
    if (description !== undefined) updates.description = description;
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(workspacesTable)
      .set(updates as Record<string, unknown>)
      .where(eq(workspacesTable.id, id))
      .returning();

    res.json(updated);
}));

router.delete("/workspaces/:id", requireAuth, validate({ params: DeleteWorkspaceParams }), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const orgId = req.ctx!.orgId;

    const [workspace] = await db
      .select()
      .from(workspacesTable)
      .where(and(eq(workspacesTable.id, id), eq(workspacesTable.orgId, orgId)))
      .limit(1);

    if (!workspace) {
      throw new NotFoundError("Workspace not found");
    }

    if (workspace.isDefault) {
      res.status(400).json({ error: "Cannot delete master workspace" });
      return;
    }

    if (process.env.WORKSPACE_SOFT_DELETE === "true") {
      const result = await scheduleSoftDelete({
        subjectType: "workspace",
        subjectId: id,
        requestedBy: req.ctx!.userId,
        graceDays: 30,
      });
      res.json({ success: true, softDeleted: true, purgeAfter: result.purgeAfter.toISOString() });
    } else {
      await db.delete(workspacesTable).where(eq(workspacesTable.id, id));
      res.json({ success: true, softDeleted: false });
    }
}));

router.post("/workspaces/:id/restore", requireAuth, validate({ params: GetWorkspaceParams }), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const orgId = req.ctx!.orgId;

    const [workspace] = await db
      .select({ id: workspacesTable.id, deletedAt: workspacesTable.deletedAt })
      .from(workspacesTable)
      .where(and(eq(workspacesTable.id, id), eq(workspacesTable.orgId, orgId)))
      .limit(1);

    if (!workspace) throw new NotFoundError("Workspace not found");
    if (!workspace.deletedAt) {
      res.status(400).json({ error: "Workspace is not soft-deleted" });
      return;
    }

    // Find and cancel the pending delete request
    const { db: dbClient } = await import("@workspace/db");
    const { deleteRequestsTable } = await import("@workspace/db/schema");
    const [req_] = await dbClient
      .select({ id: deleteRequestsTable.id })
      .from(deleteRequestsTable)
      .where(
        and(
          eq(deleteRequestsTable.subjectType, "workspace"),
          eq(deleteRequestsTable.subjectId, id),
          eq(deleteRequestsTable.state, "pending")
        )
      )
      .limit(1);

    if (req_) {
      await cancelSoftDelete(req_.id, req.ctx!.userId);
    } else {
      // Manually clear soft-delete columns if no request record exists
      await db.update(workspacesTable).set({ deletedAt: null, purgeAfter: null }).where(eq(workspacesTable.id, id));
    }

    res.json({ success: true, restored: true });
}));

router.post("/workspaces/:id/products", requireAuth, validate({ params: AddProductParams, body: AddProductBody }), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { name, vendor, version, category } = req.body;

    const product = await addProduct(id, {
      name,
      vendor: vendor ?? undefined,
      version: version ?? undefined,
      category: category ?? undefined,
    });

    res.status(201).json(product);
}));

router.delete("/workspaces/:id/products/:productId", requireAuth, validate({ params: RemoveProductParams }), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const productId = req.params.productId as string;

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

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    await db
      .delete(workspaceProductsTable)
      .where(
        and(
          eq(workspaceProductsTable.workspaceId, id),
          eq(workspaceProductsTable.id, productId)
        )
      );

    if (product.productName) {
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
}));

router.get("/workspaces/:id/feed", validate({ params: GetWorkspaceFeedParams, query: GetWorkspaceFeedQueryParams }), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

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
      matchStatus: (t as { matchStatus?: "active" | "resolved" }).matchStatus,
      resolvedSeverity: (t as { resolvedSeverity?: "critical" | "high" | "medium" | "low" | "info" | null }).resolvedSeverity,
      resolvedAt: (t as { resolvedAt?: Date | null }).resolvedAt?.toISOString() ?? null,
    }));

    res.json({ items: formatted, total, page, limit });
}));

router.post("/workspaces/:id/match", requireAuth, validate({ params: MatchWorkspaceThreatsParams }), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const matches = await matchThreatsToWorkspace(id);
    res.json({ matchedCount: matches.length });
}));

router.put("/workspaces/:id/matches/:matchId", requireAuth, validate({ params: UpdateMatchParams, body: UpdateMatchBody }), asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const matchId = req.params.matchId as string;

    const { reviewed, dismissed, matchStatus } = req.body;

    const updated = await updateWorkspaceMatch(id, matchId, {
      reviewed,
      dismissed,
      matchStatus,
    });

    res.json(updated);
}));

export default router;
