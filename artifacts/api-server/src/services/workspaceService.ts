/**
 * Workspace Service - Domain workspaces with product-based threat matching.
 */

import {
  db,
  workspacesTable,
  workspaceProductsTable,
  workspaceThreatMatchesTable,
  workspaceSettingsTable,
  threatIntelTable,
} from "@workspace/db";
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import type { ThreatIntel } from "@workspace/db";

export interface ProductInput {
  name: string;
  vendor?: string;
  version?: string;
  category?: string;
}

export interface WorkspaceInput {
  name: string;
  domain: string;
  description?: string;
  products?: ProductInput[];
}

export async function ensureMasterWorkspace(): Promise<void> {
  const [existing] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.isDefault, true))
    .limit(1);

  if (!existing) {
    await db.insert(workspacesTable).values({
      name: "Master Feed",
      domain: "*",
      description: "All threat intelligence from all sources",
      isDefault: true,
    });
  }
}

function generateKeywords(product: ProductInput): string[] {
  const keywords: string[] = [];
  const name = product.name.toLowerCase();
  keywords.push(name);
  keywords.push(name.replace(/\s+/g, ""));
  if (product.vendor) {
    const vendor = product.vendor.toLowerCase();
    keywords.push(vendor);
    keywords.push(`${vendor} ${name}`);
  }
  if (product.version) {
    keywords.push(`${name} ${product.version}`.toLowerCase());
  }
  keywords.push(`cve ${name}`);
  return [...new Set(keywords)];
}

export async function createWorkspace(data: WorkspaceInput) {
  const [workspace] = await db
    .insert(workspacesTable)
    .values({
      name: data.name,
      domain: data.domain,
      description: data.description ?? null,
    })
    .returning();

  if (!workspace) throw new Error("Failed to create workspace");

  await db.insert(workspaceSettingsTable).values({
    workspaceId: workspace.id,
  });

  if (data.products?.length) {
    for (const product of data.products) {
      await addProduct(workspace.id, product);
    }
  }

  await matchThreatsToWorkspace(workspace.id);
  return workspace;
}

export async function addProduct(
  workspaceId: string,
  product: ProductInput
): Promise<{ id: string }> {
  const keywords = generateKeywords(product);
  const [row] = await db
    .insert(workspaceProductsTable)
    .values({
      workspaceId,
      productName: product.name,
      vendor: product.vendor ?? null,
      version: product.version ?? null,
      category: product.category ?? null,
      keywords,
    })
    .returning();

  if (!row) throw new Error("Failed to add product");
  await matchThreatsToWorkspace(workspaceId);
  return { id: row.id };
}

function calculateRelevance(
  threat: typeof threatIntelTable.$inferSelect,
  products: { productName: string; vendor: string | null; version: string | null }[]
): number {
  let score = 0;
  const text = `${threat.title} ${threat.summary} ${threat.description}`.toLowerCase();

  for (const product of products) {
    if (text.includes(product.productName.toLowerCase())) score += 30;
    if (product.vendor && text.includes(product.vendor.toLowerCase())) score += 20;
    if (product.version && text.includes(product.version)) score += 25;
  }

  if (threat.severity === "critical") score += 20;
  if (threat.severity === "high") score += 10;
  return Math.min(score, 100);
}

export async function matchThreatsToWorkspace(workspaceId: string): Promise<ThreatIntel[]> {
  const products = await db
    .select()
    .from(workspaceProductsTable)
    .where(
      and(
        eq(workspaceProductsTable.workspaceId, workspaceId),
        eq(workspaceProductsTable.enabled, true)
      )
    );

  if (products.length === 0) return [];

  const allKeywords = products.flatMap((p) => [
    p.productName.toLowerCase(),
    p.vendor?.toLowerCase(),
    ...((p.keywords as string[]) ?? []),
  ]).filter(Boolean) as string[];

  const uniqueKeywords = [...new Set(allKeywords)].slice(0, 30);

  const keywordConditions = uniqueKeywords.flatMap((kw) => [
    ilike(threatIntelTable.title, `%${kw}%`),
    ilike(threatIntelTable.summary, `%${kw}%`),
    ilike(threatIntelTable.description, `%${kw}%`),
  ]);

  const threats = await db
    .select()
    .from(threatIntelTable)
    .where(or(...keywordConditions))
    .orderBy(desc(threatIntelTable.publishedAt))
    .limit(100);

  const existingMatches = await db
    .select({ threatId: workspaceThreatMatchesTable.threatId })
    .from(workspaceThreatMatchesTable)
    .where(eq(workspaceThreatMatchesTable.workspaceId, workspaceId));

  const existingIds = new Set(existingMatches.map((m) => m.threatId));

  for (const threat of threats) {
    if (existingIds.has(threat.id)) continue;

    const matchedProduct = products.find(
      (p) =>
        threat.title?.toLowerCase().includes(p.productName.toLowerCase()) ||
        threat.summary?.toLowerCase().includes(p.productName.toLowerCase()) ||
        threat.description?.toLowerCase().includes(p.productName.toLowerCase())
    );

    const relevanceScore = calculateRelevance(threat, products);

    await db.insert(workspaceThreatMatchesTable).values({
      workspaceId,
      threatId: threat.id,
      matchedProduct: matchedProduct?.productName ?? null,
      relevanceScore,
    });
    existingIds.add(threat.id);
  }

  return threats;
}

export interface WorkspaceFeedOptions {
  timeframe?: string;
  page?: number;
  limit?: number;
}

export async function getWorkspaceFeed(
  workspaceId: string,
  options: WorkspaceFeedOptions = {}
): Promise<{
  items: Array<ThreatIntel & { matchId?: string; matchedProduct?: string; relevanceScore?: number; reviewed?: boolean }>;
  total: number;
}> {
  const { page = 1, limit = 20 } = options;

  const [workspace] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  if (!workspace) throw new Error("Workspace not found");

  if (workspace.isDefault) {
    const items = await db
      .select()
      .from(threatIntelTable)
      .orderBy(desc(threatIntelTable.publishedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(threatIntelTable);

    return {
      items: items.map((t) => ({ ...t, matchedProduct: undefined, relevanceScore: undefined, reviewed: undefined })),
      total: countRow?.count ?? items.length,
    };
  }

  const matches = await db
    .select({
      matchId: workspaceThreatMatchesTable.id,
      threat: threatIntelTable,
      matchedProduct: workspaceThreatMatchesTable.matchedProduct,
      relevanceScore: workspaceThreatMatchesTable.relevanceScore,
      reviewed: workspaceThreatMatchesTable.reviewed,
    })
    .from(workspaceThreatMatchesTable)
    .innerJoin(threatIntelTable, eq(workspaceThreatMatchesTable.threatId, threatIntelTable.id))
    .where(
      and(
        eq(workspaceThreatMatchesTable.workspaceId, workspaceId),
        eq(workspaceThreatMatchesTable.dismissed, false)
      )
    )
    .orderBy(desc(workspaceThreatMatchesTable.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workspaceThreatMatchesTable)
    .where(
      and(
        eq(workspaceThreatMatchesTable.workspaceId, workspaceId),
        eq(workspaceThreatMatchesTable.dismissed, false)
      )
    );

  const items = matches.map((m) => ({
    ...m.threat,
    matchId: m.matchId,
    matchedProduct: m.matchedProduct ?? undefined,
    relevanceScore: m.relevanceScore ?? undefined,
    reviewed: m.reviewed ?? false,
  }));

  return {
    items,
    total: totalRow?.count ?? items.length,
  };
}
