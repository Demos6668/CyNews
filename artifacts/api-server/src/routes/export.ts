import { Router, type IRouter, type Request, type Response } from "express";
import { db, advisoriesTable, threatIntelTable } from "@workspace/db";
import { eq, gte, inArray, desc, and } from "drizzle-orm";
import { getTimeframeStartDate, type TimeframeValue } from "../lib/timeframe";
import { generateAdvisoryHTML, generateBulkAdvisoryHTML } from "../services/exportService";
import {
  emailTemplateService,
  type AdvisoryWithCustomizations,
} from "../services/emailTemplateService";
import type { AdvisoryForExport } from "../services/exportService";
import { asyncHandler, NotFoundError } from "../middlewares/errorHandler";
import { validate } from "../middlewares/validate";
import { z } from "zod";
import {
  displayableAdvisorySql,
  isDisplayableAdvisory,
  normalizeAdvisoryLinks,
} from "../lib/advisoryLinks";
import {
  isDisplayableThreat,
  normalizeThreatLinks,
} from "../lib/threatLinks";

const router: IRouter = Router();

const BulkAdvisoriesBody = z.object({
  ids: z.array(z.number().int().positive()).optional(),
  timeframe: z.string().optional(),
  scope: z.enum(["local", "global"]).optional(),
  vendor: z.string().optional(),
});

const ExportPreviewBody = z.object({
  advisoryId: z.union([z.number(), z.string()]),
  templateId: z.string().optional(),
  customizations: z.record(z.unknown()).optional(),
});

const ExportEmailBody = z.object({
  advisoryId: z.union([z.number(), z.string()]),
  templateId: z.string().optional(),
  customizations: z.record(z.unknown()).optional(),
  format: z.enum(["html", "text", "mailto", "outlook"]).optional(),
});

const ExportEmailBatchBody = z.object({
  advisoryIds: z.array(z.number().int().positive()),
  templateId: z.string().optional(),
  format: z.enum(["html", "text"]).optional(),
});
const MAX_BULK_IDS = 50;

function convertHtmlToPlainText(html: string): string {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

type ExportItem =
  | { type: "advisory"; row: typeof advisoriesTable.$inferSelect }
  | { type: "threat"; row: typeof threatIntelTable.$inferSelect };

async function findExportItemById(
  idParam: string | number
): Promise<ExportItem | null> {
  const numId = Number(idParam);
  if (Number.isInteger(numId) && numId > 0) {
    const [adv] = await db
      .select()
      .from(advisoriesTable)
      .where(eq(advisoriesTable.id, numId));
    if (adv && isDisplayableAdvisory(adv)) return { type: "advisory", row: adv };

    const [threat] = await db
      .select()
      .from(threatIntelTable)
      .where(eq(threatIntelTable.id, numId));
    if (threat && isDisplayableThreat(threat)) return { type: "threat", row: threat };
  }
  const [adv] = await db
    .select()
    .from(advisoriesTable)
    .where(eq(advisoriesTable.certInId, String(idParam)))
    .limit(1);
  if (adv && isDisplayableAdvisory(adv)) return { type: "advisory", row: adv };
  return null;
}

function toAdvisoryForExport(row: typeof advisoriesTable.$inferSelect) {
  const links = normalizeAdvisoryLinks(row);

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
    patchUrl: links.patchUrl,
    workarounds: (row.workarounds as string[]) ?? [],
    references: links.references,
    status: row.status,
    publishedAt: row.publishedAt.toISOString(),
    scope: row.scope,
    isIndiaRelated: row.isIndiaRelated ?? undefined,
    indiaConfidence: row.indiaConfidence ?? undefined,
    sourceUrl: links.sourceUrl ?? undefined,
    source: row.source ?? undefined,
    summary: row.summary ?? undefined,
    content: row.content ?? undefined,
    category: row.category ?? undefined,
    certInId: row.certInId ?? undefined,
    certInType: row.certInType ?? undefined,
    cveIds: (row.cveIds as string[]) ?? [],
    recommendations: (row.recommendations as string[]) ?? [],
  };
}

function toThreatForExport(row: typeof threatIntelTable.$inferSelect): AdvisoryWithCustomizations {
  const links = normalizeThreatLinks(row);

  return {
    id: row.id,
    cveId: "",
    title: row.title,
    description: row.description,
    cvssScore: 0,
    severity: row.severity,
    affectedProducts: (row.affectedSystems as string[]) ?? [],
    vendor: "",
    patchAvailable: false,
    patchUrl: null,
    workarounds: [],
    references: links.references,
    status: row.status,
    publishedAt: row.publishedAt.toISOString(),
    scope: row.scope,
    isIndiaRelated: row.isIndiaRelated ?? false,
    sourceUrl: links.sourceUrl ?? undefined,
    source: row.source,
    summary: row.summary,
    content: row.description,
    category: row.category,
    recommendations: (row.mitigations as string[]) ?? [],
    iocs: (row.iocs as string[]) ?? [],
    isCertIn: false,
    isThreat: true,
  };
}

router.get("/export/advisory/:id", asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: "Invalid advisory ID" });
      return;
    }

    const [item] = await db
      .select()
      .from(advisoriesTable)
      .where(eq(advisoriesTable.id, id));

    if (!item || !isDisplayableAdvisory(item)) {
      throw new NotFoundError("Advisory not found");
    }

    const advisory = toAdvisoryForExport(item);
    const html = generateAdvisoryHTML(advisory);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    const filename = (item.certInId ?? item.cveId).replace(/[^a-zA-Z0-9-]/g, "_");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}-advisory.html"`
    );
    res.send(html);
}));

router.post("/export/advisories/bulk", validate({ body: BulkAdvisoriesBody }), asyncHandler(async (req: Request, res: Response) => {
    const body = req.body;
    let items: typeof advisoriesTable.$inferSelect[];

    if (body.ids && Array.isArray(body.ids)) {
      const ids = body.ids.slice(0, MAX_BULK_IDS).filter((id: number) => Number.isInteger(id) && id > 0);
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
      const validTimeframes: (TimeframeValue | "90d")[] = ["1h", "6h", "24h", "7d", "30d", "90d", "all"];
      const tf = validTimeframes.includes(body.timeframe as TimeframeValue | "90d")
        ? body.timeframe
        : "24h";
      const fromDate =
        tf === "90d"
          ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          : getTimeframeStartDate(tf as TimeframeValue);
      const scopeFilter = body.scope === "local" || body.scope === "global" ? body.scope : undefined;
      const vendorFilter = body.vendor && typeof body.vendor === "string" ? body.vendor.trim() : undefined;
      const conditions = [displayableAdvisorySql];
      if (fromDate) conditions.push(gte(advisoriesTable.publishedAt, fromDate));
      if (scopeFilter) conditions.push(eq(advisoriesTable.scope, scopeFilter));
      if (vendorFilter) conditions.push(eq(advisoriesTable.vendor, vendorFilter));
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

    items = items.filter(isDisplayableAdvisory);

    if (items.length === 0) {
      throw new NotFoundError("No advisories found");
    }

    const advisories = items.map(toAdvisoryForExport);
    const html = generateBulkAdvisoryHTML(advisories, "Security Advisories Report");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="security-advisories-${new Date().toISOString().slice(0, 10)}.html"`
    );
    res.send(html);
}));

router.get("/export/templates", asyncHandler(async (req: Request, res: Response) => {
  const type = (req.query.type as string) || "all";
  const templates = emailTemplateService.getTemplates(type);
  res.json(templates);
}));

router.get("/export/templates/:id", asyncHandler(async (req: Request, res: Response) => {
  const template = emailTemplateService.getTemplate(req.params.id as string);
  if (!template) {
    throw new NotFoundError("Template not found");
  }
  res.json(template);
}));

router.post("/export/preview", validate({ body: ExportPreviewBody }), asyncHandler(async (req: Request, res: Response) => {
    const { advisoryId, templateId, customizations } = req.body;

    const exportItem = await findExportItemById(advisoryId);
    if (!exportItem) {
      throw new NotFoundError("Advisory not found");
    }

    const advisory: AdvisoryWithCustomizations =
      exportItem.type === "advisory"
        ? { ...toAdvisoryForExport(exportItem.row), ...customizations }
        : { ...toThreatForExport(exportItem.row), ...customizations };

    const templateType =
      exportItem.type === "threat"
        ? "threat"
        : (exportItem.row as typeof advisoriesTable.$inferSelect).isCertIn
          ? "cert-in"
          : "general";

    const template = templateId
      ? emailTemplateService.getTemplate(templateId)
      : emailTemplateService.getDefaultTemplate(templateType);

    if (!template) {
      throw new NotFoundError("Template not found");
    }

    const result = emailTemplateService.processTemplate(template, advisory);
    const plainText = convertHtmlToPlainText(result.body);

    const row = exportItem.row;
    res.json({
      subject: result.subject,
      body: result.body,
      plainText,
      templateUsed: template.id,
      item: {
        id: row.id,
        certInId: exportItem.type === "advisory" ? (row as typeof advisoriesTable.$inferSelect).certInId : null,
        title: row.title,
        type: exportItem.type === "threat" ? "threat" : exportItem.type === "advisory" && (row as typeof advisoriesTable.$inferSelect).isCertIn ? "cert-in" : "advisory",
      },
    });
}));

router.post("/export/email", validate({ body: ExportEmailBody }), asyncHandler(async (req: Request, res: Response) => {
    const { advisoryId, templateId, customizations, format } = req.body;

    const exportItem = await findExportItemById(advisoryId);
    if (!exportItem) {
      throw new NotFoundError("Advisory not found");
    }

    const advisory: AdvisoryWithCustomizations =
      exportItem.type === "advisory"
        ? { ...toAdvisoryForExport(exportItem.row), ...customizations }
        : { ...toThreatForExport(exportItem.row), ...customizations };

    const templateType =
      exportItem.type === "threat"
        ? "threat"
        : (exportItem.row as typeof advisoriesTable.$inferSelect).isCertIn
          ? "cert-in"
          : "general";

    const template = templateId
      ? emailTemplateService.getTemplate(templateId)
      : emailTemplateService.getDefaultTemplate(templateType);

    if (!template) {
      throw new NotFoundError("Template not found");
    }

    const result = emailTemplateService.processTemplate(template, advisory);

    switch (format) {
      case "mailto": {
        const mailtoSubject = encodeURIComponent(result.subject);
        const mailtoBody = encodeURIComponent(
          convertHtmlToPlainText(result.body)
        );
        res.json({
          mailtoLink: `mailto:?subject=${mailtoSubject}&body=${mailtoBody}`,
        });
        break;
      }
      case "text":
        res.json({
          subject: result.subject,
          body: convertHtmlToPlainText(result.body),
        });
        break;
      case "outlook":
      case "html":
      default:
        res.json({
          subject: result.subject,
          body: result.body,
        });
        break;
    }
}));

router.post("/export/email/batch", validate({ body: ExportEmailBatchBody }), asyncHandler(async (req: Request, res: Response) => {
    const { advisoryIds, templateId, format } = req.body;

    const ids = advisoryIds.slice(0, MAX_BULK_IDS);

    const items = await db
      .select()
      .from(advisoriesTable)
      .where(inArray(advisoriesTable.id, ids))
      .orderBy(desc(advisoriesTable.publishedAt));

    const results: Array<{
      id: number;
      certInId: string | null;
      title: string;
      subject: string;
      body: string;
    }> = [];

    for (const item of items) {
      const advisory = toAdvisoryForExport(item) as AdvisoryForExport;
      const template = templateId
        ? emailTemplateService.getTemplate(templateId)
        : emailTemplateService.getDefaultTemplate(
            item.isCertIn ? "cert-in" : "general"
          );

      if (template) {
        const result = emailTemplateService.processTemplate(template, advisory);
        results.push({
          id: item.id,
          certInId: item.certInId,
          title: item.title,
          subject: result.subject,
          body:
            format === "text"
              ? convertHtmlToPlainText(result.body)
              : result.body,
        });
      }
    }

    res.json({ exports: results });
}));

export default router;
