/**
 * Email Template Service - Generates professional, client-facing email content.
 * Human-readable summaries, business impact, and timeline guidance for SOC teams.
 */

import type { AdvisoryForExport } from "./exportService";

export interface EmailTemplate {
  id: string;
  name: string;
  type: "cert-in" | "general" | "threat" | "all";
  isDefault: boolean;
  description: string;
}

export interface TemplateListEntry {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  description: string;
}

export interface AdvisoryWithCustomizations extends AdvisoryForExport {
  businessImpact?: string;
  additionalRecommendations?: string;
  additionalNotes?: string;
  internalNotes?: string;
  priorityOverride?: string;
  dueDate?: string;
  iocs?: IocsShape;
  isCertIn?: boolean;
  isThreat?: boolean;
}

export type IocsShape =
  | { ips?: string[]; domains?: string[]; hashes?: string[]; urls?: string[] }
  | string[];

interface PreparedData {
  advisoryId: string;
  title: string;
  titleShort: string;
  summary: string;
  source: string;
  sourceUrl: string;
  category: string;
  colors: { primary: string; primaryDark: string; primaryLight: string; primaryText: string };
  severity: string;
  severityLabel: string;
  severityColor: string;
  severityBgColor: string;
  urgency: string;
  timeline: string;
  actionVerb: string;
  cvssScore: string | null;
  cvssRating: string;
  publishedDate: string;
  currentDate: string;
  currentDateTime: string;
  cveIds: string[];
  affectedProducts: string[];
  recommendations: string[];
  references: string[];
  iocs: IocsShape | null;
  whatHappened: string;
  businessImpact: string;
  isCertIn: boolean;
  hasCves: boolean;
  hasProducts: boolean;
  hasRecommendations: boolean;
  hasIocs: boolean;
  scope: string;
  isIndiaRelated: boolean;
}

const TEMPLATES: Record<string, EmailTemplate> = {
  "cert-in-professional": {
    id: "cert-in-professional",
    name: "CERT-In Professional",
    type: "cert-in",
    isDefault: true,
    description: "Clean, professional format for CERT-In advisories",
  },
  "cert-in-executive": {
    id: "cert-in-executive",
    name: "CERT-In Executive Brief",
    type: "cert-in",
    isDefault: false,
    description: "Concise executive summary format",
  },
  "advisory-professional": {
    id: "advisory-professional",
    name: "Advisory Professional",
    type: "general",
    isDefault: true,
    description: "Professional format for security advisories",
  },
  "advisory-executive": {
    id: "advisory-executive",
    name: "Advisory Executive Brief",
    type: "general",
    isDefault: false,
    description: "Executive summary for leadership",
  },
  "threat-alert": {
    id: "threat-alert",
    name: "Threat Alert",
    type: "threat",
    isDefault: true,
    description: "Urgent threat notification format",
  },
  "threat-detailed": {
    id: "threat-detailed",
    name: "Threat Detailed Report",
    type: "threat",
    isDefault: false,
    description: "Comprehensive threat intelligence report",
  },
  "plain-text": {
    id: "plain-text",
    name: "Plain Text",
    type: "all",
    isDefault: false,
    description: "Simple text format for all email clients",
  },
};

const COLOR_SCHEMES: Record<string, { primary: string; primaryDark: string; primaryLight: string; primaryText: string }> = {
  "cert-in": { primary: "#F97316", primaryDark: "#EA580C", primaryLight: "#FFF7ED", primaryText: "#9A3412" },
  cisa: { primary: "#1D4ED8", primaryDark: "#1E40AF", primaryLight: "#EFF6FF", primaryText: "#1E3A8A" },
  nvd: { primary: "#7C3AED", primaryDark: "#6D28D9", primaryLight: "#F5F3FF", primaryText: "#5B21B6" },
  default: { primary: "#0095AF", primaryDark: "#0077B6", primaryLight: "#F0F9FF", primaryText: "#0C4A6E" },
};

const SEVERITY_INFO: Record<string, { label: string; color: string; bgColor: string; urgency: string; timeline: string; actionVerb: string }> = {
  CRITICAL: { label: "Critical", color: "#DC2626", bgColor: "#FEE2E2", urgency: "Immediate action required", timeline: "within 24 hours", actionVerb: "Act immediately" },
  HIGH: { label: "High", color: "#EA580C", bgColor: "#FFEDD5", urgency: "Prompt attention needed", timeline: "within 48-72 hours", actionVerb: "Prioritize this week" },
  MEDIUM: { label: "Medium", color: "#CA8A04", bgColor: "#FEF9C3", urgency: "Plan remediation", timeline: "within 1-2 weeks", actionVerb: "Schedule remediation" },
  LOW: { label: "Low", color: "#16A34A", bgColor: "#DCFCE7", urgency: "Address during maintenance", timeline: "during next maintenance window", actionVerb: "Review when convenient" },
};

export class EmailTemplateService {
  getTemplates(type: string = "all"): TemplateListEntry[] {
    const templates = Object.values(TEMPLATES);
    if (type === "all") return templates;
    return templates.filter((t) => t.type === type || t.type === "all");
  }

  getTemplate(templateId: string): EmailTemplate | null {
    return TEMPLATES[templateId] ?? null;
  }

  getDefaultTemplate(type: string): EmailTemplate | null {
    const templates = this.getTemplates(type);
    const found = templates.find((t) => t.isDefault) ?? templates[0] ?? null;
    return found as EmailTemplate | null;
  }

  processTemplate(template: EmailTemplate, advisory: AdvisoryWithCustomizations): { subject: string; body: string } {
    const data = this.prepareData(advisory);
    const subject = this.generateSubject(template.id, data);
    const body = this.generateBody(template.id, data);
    return { subject, body };
  }

  prepareData(advisory: AdvisoryWithCustomizations): PreparedData {
    const severity = (advisory.priorityOverride ?? advisory.severity ?? "medium").toString().toUpperCase();
    const title = advisory.title ?? "Security Advisory";
    const source = advisory.source ?? "Security Feed";

    const sourceKey = this.getSourceKey(source);
    const colors = COLOR_SCHEMES[sourceKey] ?? COLOR_SCHEMES.default;

    let titleShort = title;
    if (title.length > 60) {
      const firstSentence = title.split(/[.!?]/)[0] ?? title;
      titleShort = firstSentence.length > 60 ? title.substring(0, 57) + "..." : firstSentence;
    }

    const severityInfo = this.getSeverityInfo(severity);
    const summary = this.cleanText(advisory.summary ?? advisory.description ?? advisory.content ?? "");
    const contentAnalysis = this.analyzeContent(advisory);

    const cveIds = advisory.cveIds?.length ? advisory.cveIds : advisory.cveId ? [advisory.cveId] : [];
    const rawIocs = advisory.iocs;

    return {
      advisoryId: String(advisory.certInId ?? advisory.cveId ?? advisory.id ?? "N/A"),
      title,
      titleShort,
      summary,
      source,
      sourceUrl: advisory.sourceUrl ?? "#",
      category: advisory.category ?? advisory.certInType ?? "Security Advisory",
      colors,
      severity,
      severityLabel: severityInfo.label,
      severityColor: severityInfo.color,
      severityBgColor: severityInfo.bgColor,
      urgency: severityInfo.urgency,
      timeline: severityInfo.timeline,
      actionVerb: severityInfo.actionVerb,
      cvssScore: advisory.cvssScore != null ? Number(advisory.cvssScore).toFixed(1) : null,
      cvssRating: this.getCvssRating(advisory.cvssScore),
      publishedDate: this.formatDate(advisory.publishedAt),
      currentDate: this.formatDate(new Date()),
      currentDateTime: this.formatDateTime(new Date()),
      cveIds,
      affectedProducts: this.cleanArray(advisory.affectedProducts ?? []),
      recommendations: this.cleanArray(advisory.recommendations ?? advisory.workarounds ?? []),
      references: this.cleanArray(advisory.references ?? []),
      iocs: this.normalizeIocs(rawIocs),
      whatHappened: contentAnalysis.whatHappened,
      businessImpact: advisory.businessImpact ?? contentAnalysis.businessImpact,
      isCertIn: advisory.isCertIn ?? source === "CERT-In",
      hasCves: cveIds.length > 0,
      hasProducts: (advisory.affectedProducts ?? []).length > 0,
      hasRecommendations: (advisory.recommendations ?? advisory.workarounds ?? []).length > 0,
      hasIocs: !!rawIocs && (Array.isArray(rawIocs) ? rawIocs.length > 0 : Object.keys(rawIocs as object).length > 0),
      scope: advisory.scope ?? "global",
      isIndiaRelated: advisory.isIndiaRelated ?? advisory.scope === "local",
    };
  }

  private getSourceKey(source: string): string {
    const s = (source ?? "").toLowerCase();
    if (s.includes("cert-in")) return "cert-in";
    if (s.includes("cisa")) return "cisa";
    if (s.includes("nvd") || s.includes("nist")) return "nvd";
    return "default";
  }

  private getSeverityInfo(severity: string) {
    return SEVERITY_INFO[severity] ?? SEVERITY_INFO.MEDIUM;
  }

  private generateSubject(templateId: string, data: PreparedData): string {
    const subjects: Record<string, string> = {
      "cert-in-professional": `Security Advisory: ${data.titleShort} [${data.severityLabel} Priority]`,
      "cert-in-executive": `Action Required: ${data.titleShort}`,
      "advisory-professional": `Security Update: ${data.titleShort} [${data.severityLabel}]`,
      "advisory-executive": `Security Brief: ${data.titleShort}`,
      "threat-alert": `Threat Alert: ${data.titleShort} [${data.severityLabel}]`,
      "threat-detailed": `Threat Intelligence Report: ${data.titleShort}`,
      "plain-text": `[${data.severityLabel}] ${data.titleShort}`,
    };
    return subjects[templateId] ?? subjects["advisory-professional"];
  }

  private generateBody(templateId: string, data: PreparedData): string {
    switch (templateId) {
      case "cert-in-professional":
        return this.genCertInProfessional(data);
      case "cert-in-executive":
        return this.genExecutiveBrief(data, "cert-in");
      case "advisory-professional":
        return this.genAdvisoryProfessional(data);
      case "advisory-executive":
        return this.genExecutiveBrief(data, "general");
      case "threat-alert":
        return this.genThreatAlert(data);
      case "threat-detailed":
        return this.genThreatDetailed(data);
      case "plain-text":
        return this.genPlainText(data);
      default:
        return this.genAdvisoryProfessional(data);
    }
  }

  private genCertInProfessional(data: PreparedData): string {
    const c = data.colors;
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f5f5f5;">
<div style="max-width:640px;margin:0 auto;background:#fff;">
<div style="background:linear-gradient(135deg,${c.primary} 0%,${c.primaryDark} 100%);padding:24px 28px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td><p style="color:rgba(255,255,255,0.9);margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;">CERT-In Security Advisory</p>
<h1 style="color:#fff;margin:0;font-size:20px;font-weight:600;line-height:1.4;">${this.esc(data.titleShort)}</h1></td>
<td width="90" align="right" valign="top"><div style="background:${data.severityBgColor};color:${data.severityColor};padding:8px 14px;border-radius:6px;font-weight:600;font-size:12px;">${data.severityLabel}</div></td>
</tr></table></div>
<div style="background:#1F2937;padding:12px 28px;color:#E5E7EB;font-size:13px;">
<span style="margin-right:16px;"><strong style="color:#9CA3AF;">Ref:</strong> ${data.advisoryId}</span>
<span style="margin-right:16px;"><strong style="color:#9CA3AF;">Date:</strong> ${data.publishedDate}</span>
${data.cvssScore ? `<span><strong style="color:#9CA3AF;">CVSS:</strong> ${data.cvssScore}</span>` : ""}</div>
<div style="padding:28px;">
<div style="background:${c.primaryLight};border-left:4px solid ${c.primary};padding:18px 20px;margin-bottom:24px;border-radius:0 8px 8px 0;">
<h2 style="color:${c.primaryText};margin:0 0 10px;font-size:13px;font-weight:600;text-transform:uppercase;">What You Need to Know</h2>
<p style="color:#1F2937;margin:0;font-size:15px;line-height:1.6;">${data.whatHappened || this.esc(data.summary.substring(0, 350))}</p></div>
${this.renderAffectedSystems(data)}
${this.renderCveSection(data)}
${this.renderRecommendations(data)}
${this.renderTimeline(data)}
</div>
${this.renderFooter(data, c.primary)}
</div>
${this.renderDisclaimer()}
</body></html>`;
  }

  private genAdvisoryProfessional(data: PreparedData): string {
    const c = data.colors;
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f5f5f5;">
<div style="max-width:640px;margin:0 auto;background:#fff;">
<div style="background:linear-gradient(135deg,${c.primary} 0%,${c.primaryDark} 100%);padding:24px 28px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td><p style="color:rgba(255,255,255,0.9);margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Security Advisory</p>
<h1 style="color:#fff;margin:0;font-size:20px;font-weight:600;line-height:1.4;">${this.esc(data.titleShort)}</h1></td>
<td width="90" align="right" valign="top"><div style="background:${data.severityBgColor};color:${data.severityColor};padding:8px 14px;border-radius:6px;font-weight:600;font-size:12px;">${data.severityLabel}</div></td>
</tr></table></div>
<div style="background:#1F2937;padding:12px 28px;color:#E5E7EB;font-size:13px;">
<span style="margin-right:16px;"><strong style="color:#9CA3AF;">Source:</strong> ${this.esc(data.source)}</span>
<span style="margin-right:16px;"><strong style="color:#9CA3AF;">Date:</strong> ${data.publishedDate}</span>
${data.category ? `<span><strong style="color:#9CA3AF;">Type:</strong> ${this.esc(data.category)}</span>` : ""}</div>
<div style="padding:28px;">
<div style="background:${c.primaryLight};border-left:4px solid ${c.primary};padding:18px 20px;margin-bottom:24px;border-radius:0 8px 8px 0;">
<h2 style="color:${c.primaryText};margin:0 0 10px;font-size:13px;font-weight:600;text-transform:uppercase;">Summary</h2>
<p style="color:#1F2937;margin:0;font-size:15px;line-height:1.6;">${data.whatHappened || this.esc(data.summary.substring(0, 350))}</p></div>
${data.businessImpact ? `<div style="margin-bottom:24px;"><h3 style="color:#374151;margin:0 0 10px;font-size:13px;font-weight:600;text-transform:uppercase;">Potential Impact</h3><p style="color:#4B5563;margin:0;font-size:14px;line-height:1.6;">${data.businessImpact}</p></div>` : ""}
${this.renderAffectedSystems(data)}
${this.renderCveSection(data)}
${this.renderRecommendations(data)}
${data.isIndiaRelated ? `<div style="background:#FEF3C7;border:1px solid #FCD34D;padding:12px 16px;border-radius:8px;margin-bottom:24px;"><p style="color:#92400E;margin:0;font-size:13px;"><strong>India Relevance:</strong> This advisory may have specific implications for Indian organizations.</p></div>` : ""}
${this.renderTimeline(data)}
</div>
${this.renderFooter(data, c.primary)}
</div>
${this.renderDisclaimer()}
</body></html>`;
  }

  private genExecutiveBrief(data: PreparedData, type: "cert-in" | "general"): string {
    const c = data.colors;
    const label = type === "cert-in" ? "CERT-In Advisory Brief" : "Security Advisory Brief";
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:20px;font-family:Georgia,'Times New Roman',serif;background:#f8f8f8;">
<div style="max-width:600px;margin:0 auto;background:#fff;padding:40px;border:1px solid #e0e0e0;">
<div style="border-bottom:2px solid #1F2937;padding-bottom:16px;margin-bottom:28px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td><h1 style="color:#1F2937;font-size:13px;margin:0;text-transform:uppercase;letter-spacing:2px;font-family:Arial,sans-serif;">${label}</h1>
<p style="color:#6B7280;margin:6px 0 0;font-size:12px;font-family:Arial,sans-serif;">${data.currentDate}</p></td>
<td align="right"><div style="background:${data.severityColor};color:#fff;padding:8px 16px;border-radius:4px;font-family:Arial,sans-serif;font-weight:bold;font-size:11px;text-transform:uppercase;letter-spacing:1px;">${data.severityLabel} Priority</div></td>
</tr></table></div>
<h2 style="color:#1F2937;font-size:22px;margin:0 0 24px;line-height:1.4;font-weight:normal;">${this.esc(data.title)}</h2>
<div style="background:#F9FAFB;border-left:4px solid ${c.primary};padding:20px;margin-bottom:28px;">
<h3 style="color:${c.primary};font-size:11px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;">Executive Summary</h3>
<p style="color:#374151;font-size:15px;line-height:1.8;margin:0;">${data.whatHappened || this.esc(data.summary.substring(0, 400))}</p></div>
<div style="margin-bottom:28px;">
<h3 style="color:#1F2937;font-size:12px;margin:0 0 14px;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;">Key Metrics</h3>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
<tr><td style="padding:12px 0;border-bottom:1px solid #E5E7EB;width:140px;color:#6B7280;font-size:14px;">Risk Level</td><td style="padding:12px 0;border-bottom:1px solid #E5E7EB;color:${data.severityColor};font-size:14px;font-weight:bold;">${data.severityLabel} ${data.cvssScore ? `(CVSS ${data.cvssScore})` : ""}</td></tr>
<tr><td style="padding:12px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:14px;">Reference</td><td style="padding:12px 0;border-bottom:1px solid #E5E7EB;color:#374151;font-size:14px;">${data.advisoryId}</td></tr>
<tr><td style="padding:12px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:14px;">Timeline</td><td style="padding:12px 0;border-bottom:1px solid #E5E7EB;color:#374151;font-size:14px;">${data.actionVerb} ${data.timeline}</td></tr>
${data.hasCves ? `<tr><td style="padding:12px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:14px;">Vulnerabilities</td><td style="padding:12px 0;border-bottom:1px solid #E5E7EB;color:#374151;font-size:14px;">${data.cveIds.length} CVE${data.cveIds.length > 1 ? "s" : ""} identified</td></tr>` : ""}
</table></div>
<div style="margin-bottom:28px;">
<h3 style="color:#1F2937;font-size:12px;margin:0 0 14px;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;">Business Impact</h3>
<p style="color:#374151;font-size:15px;line-height:1.8;margin:0;">${data.businessImpact || "Organizations using affected systems should assess their exposure and prioritize remediation based on their risk tolerance and the criticality of impacted assets."}</p></div>
<div style="background:#ECFDF5;padding:20px;border-radius:8px;margin-bottom:28px;">
<h3 style="color:#065F46;font-size:11px;margin:0 0 14px;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;">Recommended Actions</h3>
<ol style="margin:0;padding-left:20px;color:#047857;font-size:14px;line-height:1.8;">
${this.generateActionItems(data).map((a) => `<li style="margin-bottom:8px;">${a}</li>`).join("")}
</ol></div>
<div style="border-top:1px solid #E5E7EB;padding-top:20px;margin-top:24px;">
<p style="color:#6B7280;font-size:12px;margin:0 0 8px;font-family:Arial,sans-serif;"><a href="${data.sourceUrl}" style="color:${c.primary};text-decoration:none;">View Full Advisory</a></p>
<p style="color:#9CA3AF;font-size:11px;margin:0;font-family:Arial,sans-serif;">Prepared by Security Operations Team</p></div>
</div></body></html>`;
  }

  private genThreatAlert(data: PreparedData): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f5f5f5;">
<div style="max-width:640px;margin:0 auto;background:#fff;">
<div style="background:${data.severityColor};padding:20px 28px;text-align:center;">
<h1 style="color:#fff;margin:0;font-size:18px;font-weight:600;">THREAT ALERT: ${data.severityLabel.toUpperCase()} SEVERITY</h1></div>
<div style="padding:24px 28px;border-bottom:1px solid #E5E7EB;">
<h2 style="color:#111827;margin:0 0 12px;font-size:20px;line-height:1.4;">${this.esc(data.title)}</h2>
<table cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:20px;"><span style="color:#6B7280;font-size:13px;">Source:</span><span style="color:#374151;font-size:13px;font-weight:500;"> ${this.esc(data.source)}</span></td>
<td style="padding-right:20px;"><span style="color:#6B7280;font-size:13px;">Date:</span><span style="color:#374151;font-size:13px;font-weight:500;"> ${data.publishedDate}</span></td>
<td><span style="color:#6B7280;font-size:13px;">Category:</span><span style="color:#374151;font-size:13px;font-weight:500;"> ${this.esc(data.category)}</span></td>
</tr></table></div>
<div style="padding:28px;">
<div style="background:#FEF2F2;border:1px solid #FECACA;padding:18px 20px;margin-bottom:24px;border-radius:8px;">
<h3 style="color:#991B1B;margin:0 0 10px;font-size:13px;font-weight:600;text-transform:uppercase;">Threat Summary</h3>
<p style="color:#7F1D1D;margin:0;font-size:15px;line-height:1.6;">${data.whatHappened || this.esc(data.summary.substring(0, 350))}</p></div>
<div style="background:#1F2937;padding:18px 20px;border-radius:8px;margin-bottom:24px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="50%"><p style="color:#9CA3AF;margin:0 0 4px;font-size:11px;text-transform:uppercase;">Required Action</p><p style="color:#F9FAFB;margin:0;font-size:15px;font-weight:600;">${data.actionVerb}</p></td>
<td width="50%"><p style="color:#9CA3AF;margin:0 0 4px;font-size:11px;text-transform:uppercase;">Timeline</p><p style="color:#F9FAFB;margin:0;font-size:15px;font-weight:600;">${data.timeline}</p></td>
</tr></table></div>
${this.renderAffectedSystems(data)}
${data.hasIocs ? this.renderIOCs(data) : ""}
${this.renderRecommendations(data)}
</div>
${this.renderFooter(data, data.severityColor)}
</div></body></html>`;
  }

  private genThreatDetailed(data: PreparedData): string {
    const c = data.colors;
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f5f5f5;">
<div style="max-width:700px;margin:0 auto;background:#fff;">
<div style="background:#1F2937;padding:24px 28px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td><p style="color:#9CA3AF;margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Threat Intelligence Report</p>
<h1 style="color:#fff;margin:0;font-size:20px;font-weight:600;line-height:1.4;">${this.esc(data.title)}</h1></td>
<td width="100" align="right" valign="top"><div style="background:${data.severityColor};color:#fff;padding:8px 14px;border-radius:6px;font-weight:600;font-size:12px;">${data.severityLabel}</div></td>
</tr></table></div>
<div style="background:#374151;padding:14px 28px;color:#D1D5DB;font-size:12px;">
<span style="margin-right:20px;"><strong>Report ID:</strong> ${data.advisoryId}</span>
<span style="margin-right:20px;"><strong>Date:</strong> ${data.publishedDate}</span>
<span style="margin-right:20px;"><strong>Source:</strong> ${this.esc(data.source)}</span>
<span><strong>Category:</strong> ${this.esc(data.category)}</span></div>
<div style="padding:28px;">
<div style="margin-bottom:28px;">
<h2 style="color:#111827;margin:0 0 14px;font-size:16px;font-weight:600;border-bottom:2px solid ${c.primary};padding-bottom:8px;">Executive Summary</h2>
<p style="color:#374151;margin:0;font-size:15px;line-height:1.7;">${data.whatHappened || this.esc(data.summary)}</p></div>
<div style="margin-bottom:28px;">
<h2 style="color:#111827;margin:0 0 14px;font-size:16px;font-weight:600;border-bottom:2px solid ${c.primary};padding-bottom:8px;">Threat Assessment</h2>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
<tr><td style="padding:12px;background:#F9FAFB;border:1px solid #E5E7EB;width:30%;"><strong>Severity</strong></td><td style="padding:12px;border:1px solid #E5E7EB;color:${data.severityColor};font-weight:600;">${data.severityLabel} ${data.cvssScore ? `(CVSS ${data.cvssScore})` : ""}</td></tr>
<tr><td style="padding:12px;background:#F9FAFB;border:1px solid #E5E7EB;"><strong>Scope</strong></td><td style="padding:12px;border:1px solid #E5E7EB;">${data.scope === "local" ? "India / Regional" : "Global"}</td></tr>
<tr><td style="padding:12px;background:#F9FAFB;border:1px solid #E5E7EB;"><strong>Urgency</strong></td><td style="padding:12px;border:1px solid #E5E7EB;">${data.urgency}</td></tr>
<tr><td style="padding:12px;background:#F9FAFB;border:1px solid #E5E7EB;"><strong>Timeline</strong></td><td style="padding:12px;border:1px solid #E5E7EB;">${data.timeline}</td></tr>
</table></div>
<div style="background:#FEF3C7;border:1px solid #FCD34D;padding:18px 20px;margin-bottom:28px;border-radius:8px;">
<h3 style="color:#92400E;margin:0 0 10px;font-size:13px;font-weight:600;text-transform:uppercase;">Potential Business Impact</h3>
<p style="color:#78350F;margin:0;font-size:14px;line-height:1.6;">${data.businessImpact || "This threat could lead to unauthorized access, data exposure, service disruption, or financial loss depending on the specific attack vector and organizational exposure."}</p></div>
${this.renderAffectedSystems(data)}
${this.renderCveSection(data)}
${data.hasIocs ? this.renderIOCs(data) : ""}
${this.renderRecommendations(data)}
${data.references.length > 0 ? `<div style="margin-bottom:24px;"><h3 style="color:#374151;margin:0 0 12px;font-size:14px;font-weight:600;">References</h3><ul style="margin:0;padding-left:20px;color:#4B5563;font-size:13px;">${data.references.slice(0, 5).map((r) => `<li style="margin-bottom:6px;"><a href="${this.esc(r)}" style="color:${c.primary};word-break:break-all;">${this.esc(r)}</a></li>`).join("")}</ul></div>` : ""}
</div>
${this.renderFooter(data, c.primary)}
</div></body></html>`;
  }

  private genPlainText(data: PreparedData): string {
    const line = "─".repeat(55);
    let text = `SECURITY ADVISORY\n${line}\n\n${data.severityLabel.toUpperCase()} PRIORITY\nReference: ${data.advisoryId}\nSource: ${data.source}\nPublished: ${data.publishedDate}\n${data.cvssScore ? `CVSS Score: ${data.cvssScore} (${data.cvssRating})\n` : ""}\n${line}\n\n${data.title}\n\n${line}\n\nSUMMARY\n${line}\n\n${data.whatHappened || data.summary}\n\n`;
    if (data.businessImpact) text += `POTENTIAL IMPACT\n${line}\n\n${data.businessImpact}\n\n`;
    if (data.hasProducts) text += `AFFECTED SYSTEMS\n${line}\n\n${data.affectedProducts.map((p) => `• ${this.cleanProductName(p)}`).join("\n")}\n\n`;
    if (data.hasCves) text += `CVE REFERENCES\n${line}\n\n${data.cveIds.join(", ")}\n\n`;
    text += `RECOMMENDED ACTIONS\n${line}\n\n${this.generateActionItems(data).map((a, i) => `${i + 1}. ${this.stripHtml(a)}`).join("\n\n")}\n\n${line}\n\nTimeline: ${data.actionVerb} ${data.timeline}\n\n${line}\n\nSource: ${data.sourceUrl}\nGenerated by Security Operations Team\n${data.currentDateTime}`;
    return text.trim();
  }

  private renderAffectedSystems(data: PreparedData): string {
    if (!data.hasProducts) return "";
    return `<div style="margin-bottom:24px;"><h3 style="color:#374151;margin:0 0 12px;font-size:13px;font-weight:600;text-transform:uppercase;">Who Is Affected</h3><p style="color:#6B7280;margin:0 0 10px;font-size:13px;">This advisory applies to organizations using:</p><ul style="margin:0;padding-left:20px;color:#374151;">${data.affectedProducts.slice(0, 5).map((p) => `<li style="margin-bottom:6px;font-size:14px;line-height:1.5;">${this.esc(this.cleanProductName(p))}</li>`).join("")}</ul>${data.affectedProducts.length > 5 ? `<p style="color:#6B7280;font-size:12px;margin:10px 0 0;font-style:italic;">+ ${data.affectedProducts.length - 5} more products. See full advisory.</p>` : ""}</div>`;
  }

  private renderCveSection(data: PreparedData): string {
    if (!data.hasCves) return "";
    return `<div style="margin-bottom:24px;"><h3 style="color:#374151;margin:0 0 12px;font-size:13px;font-weight:600;text-transform:uppercase;">Vulnerability References</h3><div>${data.cveIds.slice(0, 6).map((cve) => `<a href="https://nvd.nist.gov/vuln/detail/${cve}" style="display:inline-block;background:#FEE2E2;color:#991B1B;padding:5px 10px;border-radius:4px;text-decoration:none;font-family:'Courier New',monospace;font-size:11px;font-weight:500;margin:2px;">${cve}</a>`).join("")}</div>${data.cveIds.length > 6 ? `<p style="color:#6B7280;font-size:12px;margin:8px 0 0;">+ ${data.cveIds.length - 6} additional CVEs</p>` : ""}</div>`;
  }

  private renderRecommendations(data: PreparedData): string {
    const actions = this.generateActionItems(data);
    return `<div style="background:#ECFDF5;border:1px solid #A7F3D0;padding:18px 20px;border-radius:8px;margin-bottom:24px;"><h3 style="color:#065F46;margin:0 0 14px;font-size:13px;font-weight:600;text-transform:uppercase;">Recommended Actions</h3><ol style="margin:0;padding-left:20px;color:#047857;">${actions.map((a) => `<li style="margin-bottom:10px;font-size:14px;line-height:1.5;">${a}</li>`).join("")}</ol></div>`;
  }

  private renderTimeline(data: PreparedData): string {
    return `<div style="background:#F9FAFB;padding:16px 20px;border-radius:8px;margin-bottom:24px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td width="50%"><p style="color:#6B7280;margin:0 0 4px;font-size:11px;text-transform:uppercase;">Recommended Timeline</p><p style="color:#111827;margin:0;font-size:15px;font-weight:600;">${data.timeline}</p></td><td width="50%"><p style="color:#6B7280;margin:0 0 4px;font-size:11px;text-transform:uppercase;">Priority</p><p style="color:${data.severityColor};margin:0;font-size:15px;font-weight:600;">${data.urgency}</p></td></tr></table></div>`;
  }

  private renderIOCs(data: PreparedData): string {
    if (!data.iocs) return "";
    const items: string[] = [];
    if (Array.isArray(data.iocs)) {
      const arr = data.iocs as string[];
      if (arr.length > 0) {
        items.push(`<strong>Indicators:</strong> ${arr.slice(0, 8).join(", ")}${arr.length > 8 ? ` (+${arr.length - 8} more)` : ""}`);
      }
    } else {
      const obj = data.iocs as { ips?: string[]; domains?: string[]; hashes?: string[]; urls?: string[] };
      if (obj.ips?.length) items.push(`<strong>IP Addresses:</strong> ${obj.ips.slice(0, 5).join(", ")}${obj.ips.length > 5 ? ` (+${obj.ips.length - 5} more)` : ""}`);
      if (obj.domains?.length) items.push(`<strong>Domains:</strong> ${obj.domains.slice(0, 5).join(", ")}${obj.domains.length > 5 ? ` (+${obj.domains.length - 5} more)` : ""}`);
      if (obj.hashes?.length) items.push(`<strong>File Hashes:</strong> ${obj.hashes.slice(0, 3).join(", ")}${obj.hashes.length > 3 ? ` (+${obj.hashes.length - 3} more)` : ""}`);
      if (obj.urls?.length) items.push(`<strong>URLs:</strong> ${obj.urls.length} malicious URLs identified`);
    }
    if (items.length === 0) return "";
    return `<div style="background:#1F2937;padding:18px 20px;border-radius:8px;margin-bottom:24px;"><h3 style="color:#F9FAFB;margin:0 0 14px;font-size:13px;font-weight:600;text-transform:uppercase;">Indicators of Compromise</h3><ul style="margin:0;padding-left:20px;color:#D1D5DB;font-size:13px;font-family:'Courier New',monospace;">${items.map((i) => `<li style="margin-bottom:8px;">${i}</li>`).join("")}</ul><p style="color:#9CA3AF;font-size:11px;margin:12px 0 0;">Add these indicators to your security monitoring tools.</p></div>`;
  }

  private renderFooter(data: PreparedData, accentColor: string): string {
    return `<div style="background:#1F2937;padding:20px 28px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td><p style="color:#9CA3AF;margin:0 0 6px;font-size:12px;"><a href="${data.sourceUrl}" style="color:${accentColor};text-decoration:none;">View Original Advisory</a></p><p style="color:#6B7280;margin:0;font-size:11px;">Prepared by Security Operations Team • ${data.currentDateTime}</p></td></tr></table></div>`;
  }

  private renderDisclaimer(): string {
    return `<div style="max-width:640px;margin:16px auto;padding:0 28px;"><p style="color:#9CA3AF;font-size:11px;line-height:1.5;margin:0;">This advisory is provided for informational purposes. Please verify all information with official sources before taking action.</p></div>`;
  }

  private generateActionItems(data: PreparedData): string[] {
    const actions: string[] = [];
    if (data.hasProducts) actions.push(`<strong>Verify exposure</strong> — Check if your organization uses the affected software and identify all instances.`);
    actions.push(`<strong>Apply available patches</strong> — Install vendor-provided security updates as soon as possible.`);
    if (data.hasRecommendations) {
      data.recommendations.slice(0, 2).forEach((rec) => {
        const cleaned = this.cleanRecommendation(rec);
        if (cleaned && cleaned.length > 10) actions.push(cleaned);
      });
    }
    if ((data.severity === "CRITICAL" || data.severity === "HIGH") && !actions.some((a) => a.toLowerCase().includes("monitor"))) {
      actions.push(`<strong>Enable enhanced monitoring</strong> — Watch for signs of exploitation in your environment.`);
    }
    if (!actions.some((a) => a.toLowerCase().includes("vendor") || a.toLowerCase().includes("update"))) {
      actions.push(`<strong>Monitor for updates</strong> — Watch for additional guidance from the vendor and security advisories.`);
    }
    return actions.slice(0, 5);
  }

  private analyzeContent(advisory: AdvisoryWithCustomizations): { whatHappened: string; businessImpact: string } {
    const content = ((advisory.summary ?? "") + " " + (advisory.content ?? advisory.description ?? "")).trim();
    const cl = content.toLowerCase();
    let whatHappened = "";
    if (cl.includes("vulnerability") || cl.includes("vulnerabilities")) {
      const match = content.match(/(?:multiple\s+)?vulnerabilit(?:y|ies)[^.]*?(?:allow|could|enable|permit|may)[^.]+\./i);
      if (match) whatHappened = this.cleanText(match[0]);
    }
    if (!whatHappened && advisory.summary) whatHappened = this.cleanText(advisory.summary.substring(0, 350));
    let businessImpact = "";
    if (cl.includes("arbitrary code") || cl.includes("remote code execution") || cl.includes("rce")) {
      businessImpact = "Successful exploitation could allow attackers to execute arbitrary code on affected systems, potentially leading to complete system compromise, data theft, or service disruption.";
    } else if (cl.includes("denial of service") || cl.includes("dos")) {
      businessImpact = "This vulnerability could be exploited to cause service outages, affecting business operations and customer-facing services.";
    } else if (cl.includes("data") && (cl.includes("exposure") || cl.includes("leak") || cl.includes("breach"))) {
      businessImpact = "Exploitation could lead to unauthorized access to sensitive data, potentially resulting in compliance issues and reputational damage.";
    } else if (cl.includes("privilege") || cl.includes("escalation")) {
      businessImpact = "Attackers could gain elevated privileges on affected systems, leading to unauthorized access to sensitive resources.";
    } else if (cl.includes("authentication") || cl.includes("bypass")) {
      businessImpact = "Security controls could be bypassed, allowing unauthorized access to protected resources.";
    }
    return { whatHappened, businessImpact };
  }

  private normalizeIocs(iocs: IocsShape | undefined | null): IocsShape | null {
    if (!iocs) return null;
    if (Array.isArray(iocs)) return iocs.length > 0 ? iocs : null;
    const obj = iocs as Record<string, unknown>;
    if (typeof obj === "object" && (obj.ips || obj.domains || obj.hashes || obj.urls)) return iocs;
    return null;
  }

  private cleanText(text: string): string {
    return text ? text.replace(/\s+/g, " ").replace(/\n+/g, " ").trim() : "";
  }

  private cleanArray(arr: string[]): string[] {
    return arr.map((i) => this.cleanText(i)).filter((i) => i.length > 0);
  }

  private cleanProductName(p: string): string {
    return p ? p.replace(/\s+/g, " ").replace(/versions?\s+prior\s+to/gi, "versions before").trim() : "";
  }

  private cleanRecommendation(rec: string): string {
    if (!rec) return "";
    const c = rec.replace(/\s+/g, " ").replace(/^\d+[.)]\s*/, "").replace(/^[-•]\s*/, "").trim();
    return c.length > 0 ? c.charAt(0).toUpperCase() + c.slice(1) : "";
  }

  private getCvssRating(score: number | string | null | undefined): string {
    if (score == null) return "";
    const s = parseFloat(String(score));
    if (s >= 9) return "Critical";
    if (s >= 7) return "High";
    if (s >= 4) return "Medium";
    return "Low";
  }

  private formatDate(date: Date | string | null | undefined): string {
    return date ? new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "N/A";
  }

  private formatDateTime(date: Date | string | null | undefined): string {
    return date ? new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A";
  }

  private esc(text: string): string {
    return text ? String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : "";
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
  }
}

export const emailTemplateService = new EmailTemplateService();
