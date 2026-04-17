import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

interface PageScan {
  name: string;
  path: string;
  waitForSelector?: string;
}

const PAGES: ReadonlyArray<PageScan> = [
  { name: "Dashboard", path: "/", waitForSelector: "main" },
  { name: "Global News", path: "/news/global", waitForSelector: "main" },
  { name: "Local News", path: "/news/local", waitForSelector: "main" },
  { name: "Advisories", path: "/advisories", waitForSelector: "main" },
  { name: "Threat Intel", path: "/threat-intel", waitForSelector: "main" },
  { name: "CERT-In", path: "/cert-in", waitForSelector: "main" },
  { name: "Patches", path: "/patches", waitForSelector: "main" },
  { name: "Bookmarks", path: "/bookmarks", waitForSelector: "main" },
  { name: "Workspaces", path: "/workspaces", waitForSelector: "main" },
  { name: "Settings", path: "/settings", waitForSelector: "main" },
];

// Scan on the tags that correspond to WCAG 2.1 A/AA — the standard baseline
// for product accessibility. Includes best-practice rules for common bugs
// (missing alt text, empty buttons, improper heading order, etc.).
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] as const;

test.describe("Accessibility — WCAG 2.1 A/AA", () => {
  for (const page of PAGES) {
    test(`${page.name} has no critical axe violations`, async ({ page: browserPage }) => {
      await browserPage.goto(page.path);
      if (page.waitForSelector) {
        await browserPage.waitForSelector(page.waitForSelector, { timeout: 15_000 });
      }

      const results = await new AxeBuilder({ page: browserPage })
        .withTags([...WCAG_TAGS])
        // Radix UI primitives render dialog/popover content into portals that
        // briefly have aria-hidden mismatches; these are addressed upstream
        // and are noisy false-positives for our purposes.
        .disableRules(["aria-hidden-focus"])
        .analyze();

      const criticalViolations = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );

      if (criticalViolations.length > 0) {
        const formatted = criticalViolations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          helpUrl: v.helpUrl,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            failureSummary: n.failureSummary,
          })),
        }));
        // eslint-disable-next-line no-console
        console.error(
          `Accessibility violations on ${page.name} (${page.path}):\n${JSON.stringify(formatted, null, 2)}`,
        );
      }

      expect(
        criticalViolations,
        `${page.name} has ${criticalViolations.length} critical/serious violation(s). See console for details.`,
      ).toEqual([]);
    });
  }
});
