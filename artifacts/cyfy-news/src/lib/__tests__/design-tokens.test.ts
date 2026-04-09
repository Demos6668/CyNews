import { describe, it, expect } from "vitest";
import {
  getSeverityToken,
  getCvssHex,
  getCvssTailwind,
  getCvssSeverityLabel,
  SEVERITY_TOKENS,
} from "../design-tokens";

describe("getSeverityToken", () => {
  it("returns critical token for 'critical'", () => {
    const t = getSeverityToken("critical");
    expect(t.hex).toBe("#F85149");
    expect(t.label).toBe("Critical");
  });

  it("is case-insensitive", () => {
    expect(getSeverityToken("CRITICAL").hex).toBe(getSeverityToken("critical").hex);
    expect(getSeverityToken("High").hex).toBe(getSeverityToken("high").hex);
  });

  it("returns info token for unknown severity", () => {
    const t = getSeverityToken("unknown-severity");
    expect(t).toBe(SEVERITY_TOKENS.info);
  });

  it("returns info token for empty string", () => {
    expect(getSeverityToken("")).toBe(SEVERITY_TOKENS.info);
  });

  it("covers all 5 defined severities", () => {
    for (const key of ["critical", "high", "medium", "low", "info"]) {
      expect(getSeverityToken(key)).toBe(SEVERITY_TOKENS[key]);
    }
  });
});

describe("getCvssHex", () => {
  it("returns critical color at 9.0", () => {
    expect(getCvssHex(9.0)).toBe("#F85149");
  });

  it("returns critical color at 10.0", () => {
    expect(getCvssHex(10.0)).toBe("#F85149");
  });

  it("returns high color at 7.0", () => {
    expect(getCvssHex(7.0)).toBe("#FFB74B");
  });

  it("returns high color at 8.9", () => {
    expect(getCvssHex(8.9)).toBe("#FFB74B");
  });

  it("returns medium color at 4.0", () => {
    expect(getCvssHex(4.0)).toBe("#F0C000");
  });

  it("returns medium color at 6.9", () => {
    expect(getCvssHex(6.9)).toBe("#F0C000");
  });

  it("returns low color at 3.9", () => {
    expect(getCvssHex(3.9)).toBe("#3FB950");
  });

  it("returns low color at 0", () => {
    expect(getCvssHex(0)).toBe("#3FB950");
  });
});

describe("getCvssTailwind", () => {
  it("returns destructive class for critical score", () => {
    expect(getCvssTailwind(9.5)).toBe("text-destructive");
  });

  it("returns accent class for high score", () => {
    expect(getCvssTailwind(7.5)).toBe("text-accent");
  });

  it("returns warning class for medium score", () => {
    expect(getCvssTailwind(5.0)).toBe("text-warning");
  });

  it("returns success class for low score", () => {
    expect(getCvssTailwind(2.0)).toBe("text-success");
  });
});

describe("getCvssSeverityLabel", () => {
  it("labels 9.0+ as critical", () => {
    expect(getCvssSeverityLabel(9.0)).toBe("critical");
    expect(getCvssSeverityLabel(10)).toBe("critical");
  });

  it("labels 7.0–8.9 as high", () => {
    expect(getCvssSeverityLabel(7.0)).toBe("high");
    expect(getCvssSeverityLabel(8.9)).toBe("high");
  });

  it("labels 4.0–6.9 as medium", () => {
    expect(getCvssSeverityLabel(4.0)).toBe("medium");
    expect(getCvssSeverityLabel(6.9)).toBe("medium");
  });

  it("labels below 4.0 as low", () => {
    expect(getCvssSeverityLabel(3.9)).toBe("low");
    expect(getCvssSeverityLabel(0)).toBe("low");
  });
});
