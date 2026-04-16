import { describe, it, expect } from "vitest";
import {
  tierAtLeast,
  PLAN_LIMITS,
  FEATURE_GATES,
  buildUpgradePayload,
  type PlanTier,
  type FeatureKey,
} from "./plans";

describe("tierAtLeast", () => {
  it("returns true when tiers are equal", () => {
    expect(tierAtLeast("pro", "pro")).toBe(true);
  });

  it("returns true when actual is higher than required", () => {
    expect(tierAtLeast("team", "pro")).toBe(true);
    expect(tierAtLeast("enterprise", "free")).toBe(true);
    expect(tierAtLeast("owner" as unknown as PlanTier, "free" as PlanTier)).toBe(false); // guard: unknown tier
  });

  it("returns false when actual is below required", () => {
    expect(tierAtLeast("free", "pro")).toBe(false);
    expect(tierAtLeast("pro", "team")).toBe(false);
    expect(tierAtLeast("free", "enterprise")).toBe(false);
  });

  it("free satisfies free", () => {
    expect(tierAtLeast("free", "free")).toBe(true);
  });
});

describe("PLAN_LIMITS", () => {
  const tiers: PlanTier[] = ["free", "pro", "team", "enterprise"];

  it("every tier has all required limit keys", () => {
    const keys: (keyof typeof PLAN_LIMITS.free)[] = [
      "seats",
      "workspaces",
      "alertRules",
      "apiKeys",
      "savedViews",
      "dataRetentionDays",
      "searchResultsMax",
    ];
    for (const tier of tiers) {
      for (const key of keys) {
        expect(
          PLAN_LIMITS[tier][key],
          `${tier}.${key} should be a number`
        ).toBeTypeOf("number");
      }
    }
  });

  it("limits are non-decreasing across tiers", () => {
    const numericKeys: (keyof typeof PLAN_LIMITS.free)[] = [
      "seats",
      "workspaces",
      "alertRules",
      "apiKeys",
      "savedViews",
      "dataRetentionDays",
      "searchResultsMax",
    ];
    for (const key of numericKeys) {
      expect(PLAN_LIMITS.free[key]).toBeLessThanOrEqual(PLAN_LIMITS.pro[key]);
      expect(PLAN_LIMITS.pro[key]).toBeLessThanOrEqual(PLAN_LIMITS.team[key]);
      expect(PLAN_LIMITS.team[key]).toBeLessThanOrEqual(PLAN_LIMITS.enterprise[key]);
    }
  });

  it("free tier has 0 alertRules (no alert rules on free)", () => {
    expect(PLAN_LIMITS.free.alertRules).toBe(0);
  });

  it("team/enterprise have unlimited seats", () => {
    expect(PLAN_LIMITS.team.seats).toBe(Infinity);
    expect(PLAN_LIMITS.enterprise.seats).toBe(Infinity);
  });
});

describe("FEATURE_GATES", () => {
  it("every gate value is a valid tier or null", () => {
    const validTiers = new Set<string | null>(["free", "pro", "team", "enterprise", null]);
    for (const [key, value] of Object.entries(FEATURE_GATES)) {
      expect(
        validTiers.has(value),
        `FEATURE_GATES.${key} has invalid value "${String(value)}"`
      ).toBe(true);
    }
  });
});

describe("buildUpgradePayload", () => {
  it("builds a correct 402 payload", () => {
    const payload = buildUpgradePayload("SAVED_VIEWS" as FeatureKey, "free", "https://app.cynews.io");
    expect(payload.code).toBe("UPGRADE_REQUIRED");
    expect(payload.feature).toBe("SAVED_VIEWS");
    expect(payload.currentPlan).toBe("free");
    expect(payload.requiredPlan).toBe("pro");
    expect(payload.upgradeUrl).toBe("https://app.cynews.io/settings/billing");
  });

  it("throws for a null-gated feature (should never 402)", () => {
    expect(() =>
      buildUpgradePayload("CERT_IN_READ" as FeatureKey, "free")
    ).toThrow("no gate");
  });
});
