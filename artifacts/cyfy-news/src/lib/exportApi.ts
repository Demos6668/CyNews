/**
 * Export API client - centralized fetch calls for export endpoints.
 * These endpoints aren't in the OpenAPI spec yet, so we use typed wrappers
 * instead of generated hooks.
 */

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

async function post<T = unknown>(path: string, body: unknown): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function get<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

/** Bulk export advisories as HTML blob */
export async function exportAdvisoriesBulk(
  params: { ids?: number[]; timeframe?: string; scope?: string; vendor?: string }
): Promise<Blob | null> {
  const res = await post("/export/advisories/bulk", params);
  if (!res.ok) return null;
  return res.blob();
}

/** Get email templates */
export interface EmailTemplate {
  id: string;
  name: string;
  type: string;
  subject: string;
  body: string;
}

export async function getEmailTemplates(type?: string): Promise<EmailTemplate[]> {
  const query = type ? `?type=${encodeURIComponent(type)}` : "";
  return get<EmailTemplate[]>(`/export/templates${query}`);
}

/** Preview email export */
export interface EmailPreview {
  subject: string;
  body: string;
  plainText: string;
  templateUsed: string;
  item: { id: number; certInId: string | null; title: string; type: string };
}

export async function previewEmail(params: {
  advisoryId: number | string;
  templateId?: string;
  customizations?: Record<string, unknown>;
}): Promise<EmailPreview> {
  const res = await post("/export/preview", params);
  if (!res.ok) throw new Error(`Preview failed: ${res.status}`);
  return res.json() as Promise<EmailPreview>;
}

/** Export email */
export async function exportEmail(params: {
  advisoryId: number | string;
  templateId?: string;
  customizations?: Record<string, unknown>;
  format?: "html" | "text" | "mailto" | "outlook";
}): Promise<{ subject?: string; body?: string; mailtoLink?: string }> {
  const res = await post("/export/email", params);
  if (!res.ok) throw new Error(`Email export failed: ${res.status}`);
  return res.json();
}

/** Export single advisory as HTML blob */
export async function exportAdvisoryHtml(id: number): Promise<Blob | null> {
  const res = await fetch(`${BASE}/export/advisory/${id}`);
  if (!res.ok) return null;
  return res.blob();
}

/** Batch email export */
export interface BatchExportResult {
  exports: Array<{
    id: number;
    certInId: string | null;
    title: string;
    subject: string;
    body: string;
  }>;
}

export async function exportEmailBatch(params: {
  advisoryIds: number[];
  templateId?: string;
  format?: "html" | "text";
}): Promise<BatchExportResult> {
  const res = await post("/export/email/batch", params);
  if (!res.ok) throw new Error(`Batch export failed: ${res.status}`);
  return res.json() as Promise<BatchExportResult>;
}
