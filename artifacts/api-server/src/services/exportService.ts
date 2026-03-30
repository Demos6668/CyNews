/**
 * Advisory HTML Export Service
 * Generates professional HTML reports for security advisories.
 */

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#F85149",
  high: "#FFB74B",
  medium: "#F0C000",
  low: "#3FB950",
  info: "#0095AF",
};

export interface AdvisoryForExport {
  id: number;
  cveId: string;
  title: string;
  description: string;
  cvssScore: number;
  severity: string;
  affectedProducts: string[];
  vendor: string;
  patchAvailable: boolean;
  patchUrl: string | null;
  workarounds: string[];
  references: string[];
  status: string;
  publishedAt: string;
  scope?: "local" | "global";
  isIndiaRelated?: boolean;
  indiaConfidence?: number;
  // CERT-In specific
  sourceUrl?: string;
  source?: string;
  summary?: string;
  content?: string;
  category?: string;
  certInId?: string;
  certInType?: string;
  cveIds?: string[];
  recommendations?: string[];
}

function stripHtmlForExport(html: string): string {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function generateAdvisoryHTML(advisory: AdvisoryForExport): string {
  const severityColor = SEVERITY_COLORS[advisory.severity] ?? SEVERITY_COLORS.info;
  const publishedDate = new Date(advisory.publishedAt).toLocaleDateString();
  const generatedAt = new Date().toLocaleString();

  const title = escapeHtml(advisory.title);
  const description = escapeHtml(advisory.description);
  const cveId = escapeHtml(advisory.certInId ?? advisory.cveId);
  const vendor = escapeHtml(advisory.vendor);

  const affectedProducts = (advisory.affectedProducts ?? []).map((p) => escapeHtml(p));
  const workarounds = (advisory.workarounds ?? []).map((w) => escapeHtml(w));
  const recommendations = (advisory.recommendations ?? []).map((r) => escapeHtml(r));
  const cveIds = advisory.cveIds ?? [];
  const isCertIn = !!(advisory.certInId ?? advisory.content);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cveId} - Security Advisory | CYFY</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0D1117;
      color: #FFFFFF;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 1px solid #243044;
    }
    .logo { font-size: 24px; font-weight: bold; color: #0095AF; }
    .generated { color: #8B949E; font-size: 12px; }
    .severity-banner {
      background: ${severityColor};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .cvss {
      background: rgba(0,0,0,0.2);
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 20px;
    }
    h1 { font-size: 28px; margin-bottom: 8px; }
    .cve-id { color: #0095AF; font-size: 18px; margin-bottom: 24px; }
    .meta {
      display: flex;
      gap: 24px;
      margin-bottom: 32px;
      color: #8B949E;
      font-size: 14px;
      flex-wrap: wrap;
    }
    .section {
      background: #161B22;
      border: 1px solid #243044;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .section h2 {
      color: #0095AF;
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
    }
    .section p { line-height: 1.7; color: #E6EDF3; }
    .affected-list {
      list-style: none;
      padding: 0;
    }
    .affected-list li {
      padding: 8px 12px;
      background: #0D1117;
      border-radius: 6px;
      margin-bottom: 8px;
      border-left: 3px solid #0095AF;
    }
    .mitigation {
      background: #3FB95020;
      border-left: 3px solid #3FB950;
      padding: 16px;
      border-radius: 0 8px 8px 0;
    }
    .references a {
      color: #0095AF;
      text-decoration: none;
    }
    .references a:hover { text-decoration: underline; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #243044;
      text-align: center;
      color: #8B949E;
      font-size: 12px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .status-new { background: #0095AF20; color: #0095AF; }
    .status-patched { background: #3FB95020; color: #3FB950; }
    .status-no-patch { background: #F8514920; color: #F85149; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">CYFY Security Advisory</div>
    <div class="generated">Generated: ${generatedAt}</div>
  </div>

  <div class="severity-banner">
    <span class="cvss">${advisory.cvssScore?.toFixed(1) ?? "N/A"}</span>
    <span>${(advisory.severity ?? "info").toUpperCase()} SEVERITY</span>
  </div>

  <h1>${title}</h1>
  <div class="cve-id">${cveId}${advisory.category ? ` | ${escapeHtml(advisory.category)}` : ""}</div>

  <div class="meta">
    <span>Published: ${publishedDate}</span>
    <span>Source: ${vendor}</span>
    <span>Scope: ${(advisory.scope ?? "global") === "local" ? "India (Local)" : "Global"}</span>
    <span class="status-badge ${advisory.patchAvailable ? "status-patched" : "status-no-patch"}">
      ${advisory.patchAvailable ? "Patch Available" : "No Patch"}
    </span>
  </div>

  <div class="section">
    <h2>Summary</h2>
    <p>${description}</p>
  </div>

  ${isCertIn && advisory.summary ? `
  <div class="section">
    <h2>CERT-In Summary</h2>
    <p>${escapeHtml(stripHtmlForExport(advisory.summary))}</p>
  </div>
  ` : ""}

  ${isCertIn && advisory.content ? `
  <div class="section">
    <h2>Full Content</h2>
    <p style="white-space: pre-wrap;">${escapeHtml(stripHtmlForExport(advisory.content))}</p>
  </div>
  ` : ""}

  ${cveIds.length > 0 ? `
  <div class="section">
    <h2>Related CVEs</h2>
    <ul class="affected-list">
      ${cveIds.map((cve) => `<li><a href="https://nvd.nist.gov/vuln/detail/${escapeHtml(cve)}" target="_blank" rel="noopener">${escapeHtml(cve)}</a></li>`).join("")}
    </ul>
  </div>
  ` : ""}

  ${affectedProducts.length > 0 ? `
  <div class="section">
    <h2>Affected Products</h2>
    <ul class="affected-list">
      ${affectedProducts.map((sys) => `<li>${sys}</li>`).join("")}
    </ul>
  </div>
  ` : ""}

  ${(workarounds.length > 0 || recommendations.length > 0) ? `
  <div class="section">
    <h2>Mitigation &amp; Recommendations</h2>
    <div class="mitigation">
      <ul style="padding-left: 20px;">
        ${workarounds.map((m) => `<li style="margin-bottom: 8px;">${m}</li>`).join("")}
        ${recommendations.map((r) => `<li style="margin-bottom: 8px;">${r}</li>`).join("")}
      </ul>
    </div>
  </div>
  ` : ""}

  <div class="section">
    <h2>References</h2>
    <div class="references">
      ${cveIds.length > 0 ? cveIds.slice(0, 3).map((cve) => `<p><a href="https://nvd.nist.gov/vuln/detail/${escapeHtml(cve)}" target="_blank" rel="noopener">NVD: ${escapeHtml(cve)}</a></p>`).join("") : `<p><a href="https://nvd.nist.gov/vuln/detail/${advisory.cveId}" target="_blank" rel="noopener">NVD Entry</a></p>`}
      ${advisory.patchUrl ? `<p><a href="${escapeHtml(advisory.patchUrl)}" target="_blank" rel="noopener">Patch/Update</a></p>` : ""}
      ${advisory.sourceUrl ? `<p><a href="${escapeHtml(advisory.sourceUrl)}" target="_blank" rel="noopener">View on CERT-In</a></p>` : ""}
      ${(advisory.references ?? []).slice(0, 5).map((ref) => `<p><a href="${escapeHtml(ref)}" target="_blank" rel="noopener">${escapeHtml(ref)}</a></p>`).join("")}
    </div>
  </div>

  <div class="footer">
    <p>This advisory was generated by CYFY News Board</p>
    <p>For internal use only - ${new Date().getFullYear()}</p>
  </div>
</body>
</html>`;
}

export function generateBulkAdvisoryHTML(
  advisories: AdvisoryForExport[],
  title = "Security Advisories Report"
): string {
  const generatedAt = new Date().toLocaleString();
  const tocItems = advisories.map(
    (a, i) => `<li><a href="#advisory-${i}">${escapeHtml(a.certInId ?? a.cveId)} - ${escapeHtml(a.title)}</a></li>`
  );

  const advisorySections = advisories.map((advisory, index) => {
    const severityColor = SEVERITY_COLORS[advisory.severity] ?? SEVERITY_COLORS.info;
    const publishedDate = new Date(advisory.publishedAt).toLocaleDateString();
    const title = escapeHtml(advisory.title);
    const description = escapeHtml(advisory.description);
    const displayId = escapeHtml(advisory.certInId ?? advisory.cveId);
    const vendor = escapeHtml(advisory.vendor);
    const affectedProducts = (advisory.affectedProducts ?? []).map((p) => escapeHtml(p));
    const workarounds = (advisory.workarounds ?? []).map((w) => escapeHtml(w));
    const recommendations = (advisory.recommendations ?? []).map((r) => escapeHtml(r));
    const cveIds = advisory.cveIds ?? [];
    const isCertIn = !!(advisory.certInId ?? advisory.content);

    const certInSummary = isCertIn && advisory.summary ? `<div class="section"><h3>CERT-In Summary</h3><p>${escapeHtml(stripHtmlForExport(advisory.summary))}</p></div>` : "";
    const certInContent = isCertIn && advisory.content ? `<div class="section"><h3>Full Content</h3><p style="white-space: pre-wrap;">${escapeHtml(stripHtmlForExport(advisory.content))}</p></div>` : "";
    const certInCves = cveIds.length > 0 ? `<div class="section"><h3>Related CVEs</h3><ul>${cveIds.map((cve) => `<li><a href="https://nvd.nist.gov/vuln/detail/${escapeHtml(cve)}" target="_blank" rel="noopener">${escapeHtml(cve)}</a></li>`).join("")}</ul></div>` : "";
    const refLinks = cveIds.length > 0
      ? cveIds.slice(0, 3).map((cve) => `<a href="https://nvd.nist.gov/vuln/detail/${escapeHtml(cve)}" target="_blank" rel="noopener">NVD: ${escapeHtml(cve)}</a>`).join(" | ")
      : `<a href="https://nvd.nist.gov/vuln/detail/${advisory.cveId}" target="_blank" rel="noopener">View NVD Entry</a>`;
    const certInLink = advisory.sourceUrl ? ` | <a href="${escapeHtml(advisory.sourceUrl)}" target="_blank" rel="noopener">View on CERT-In</a>` : "";

    return `
  <div id="advisory-${index}" class="advisory-section">
    <div class="severity-banner" style="background: ${severityColor};">
      <span class="cvss">${advisory.cvssScore?.toFixed(1) ?? "N/A"}</span>
      <span>${(advisory.severity ?? "info").toUpperCase()} - ${displayId}${advisory.category ? ` (${escapeHtml(advisory.category)})` : ""}</span>
    </div>
    <h2>${title}</h2>
    <div class="meta">Published: ${publishedDate} | Vendor: ${vendor} | Scope: ${(advisory.scope ?? "global") === "local" ? "India (Local)" : "Global"}</div>
    <div class="section">
      <p>${description}</p>
    </div>
    ${certInSummary}
    ${certInContent}
    ${certInCves}
    ${affectedProducts.length > 0 ? `<div class="section"><h3>Affected Products</h3><ul>${affectedProducts.map((p) => `<li>${p}</li>`).join("")}</ul></div>` : ""}
    ${(workarounds.length > 0 || recommendations.length > 0) ? `<div class="section"><h3>Workarounds &amp; Recommendations</h3><ul>${workarounds.map((w) => `<li>${w}</li>`).join("")}${recommendations.map((r) => `<li>${r}</li>`).join("")}</ul></div>` : ""}
    <p>${refLinks}${certInLink}</p>
    <hr class="section-divider" />
  </div>`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | CYFY</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0D1117; color: #FFFFFF; padding: 40px; max-width: 900px; margin: 0 auto; }
    .header { margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #243044; }
    .logo { font-size: 24px; font-weight: bold; color: #0095AF; }
    .generated { color: #8B949E; font-size: 12px; margin-top: 8px; }
    .toc { background: #161B22; border: 1px solid #243044; border-radius: 12px; padding: 24px; margin-bottom: 32px; }
    .toc h2 { color: #0095AF; font-size: 16px; margin-bottom: 16px; }
    .toc ul { list-style: none; }
    .toc li { margin-bottom: 8px; }
    .toc a { color: #E6EDF3; text-decoration: none; }
    .toc a:hover { color: #0095AF; text-decoration: underline; }
    .advisory-section { margin-bottom: 48px; }
    .severity-banner { color: white; padding: 8px 16px; border-radius: 8px; display: inline-flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .cvss { background: rgba(0,0,0,0.2); padding: 4px 12px; border-radius: 6px; font-weight: bold; }
    .section { background: #161B22; border: 1px solid #243044; border-radius: 12px; padding: 20px; margin: 16px 0; }
    .section h3 { color: #0095AF; font-size: 14px; margin-bottom: 12px; }
    .meta { color: #8B949E; font-size: 14px; margin-bottom: 16px; }
    .section-divider { border: none; border-top: 1px solid #243044; margin: 32px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #243044; text-align: center; color: #8B949E; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">CYFY Security Advisories Report</div>
    <div class="generated">Generated: ${generatedAt} | ${advisories.length} advisories</div>
  </div>

  <div class="toc">
    <h2>Table of Contents</h2>
    <ul>${tocItems.join("")}</ul>
  </div>

  ${advisorySections.join("")}

  <div class="footer">
    <p>This report was generated by CYFY News Board - For internal use only - ${new Date().getFullYear()}</p>
  </div>
</body>
</html>`;
}
