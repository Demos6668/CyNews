import { describe, it, expect } from "vitest";
import { getSeverityColors, getSeverityBadgeColors, stripHtml } from "../utils";

describe("getSeverityColors", () => {
  it("critical returns destructive classes", () => {
    const c = getSeverityColors("critical");
    expect(c).toContain("text-destructive");
    expect(c).toContain("bg-destructive");
  });

  it("high returns accent classes", () => {
    const c = getSeverityColors("high");
    expect(c).toContain("text-accent");
  });

  it("medium returns warning classes", () => {
    const c = getSeverityColors("medium");
    expect(c).toContain("text-warning");
  });

  it("low returns success classes", () => {
    const c = getSeverityColors("low");
    expect(c).toContain("text-success");
  });

  it("unknown falls back to info (primary) classes", () => {
    const c = getSeverityColors("unknown");
    expect(c).toContain("text-primary");
  });

  it("is case-insensitive", () => {
    expect(getSeverityColors("CRITICAL")).toEqual(getSeverityColors("critical"));
  });
});

describe("getSeverityBadgeColors", () => {
  it("critical returns distinct classes from getSeverityColors", () => {
    const badge = getSeverityBadgeColors("critical");
    const full = getSeverityColors("critical");
    // Badge doesn't have the shadow pattern
    expect(badge).not.toContain("shadow");
    expect(full).toContain("shadow");
  });

  it("high returns accent classes", () => {
    expect(getSeverityBadgeColors("high")).toContain("text-accent");
  });

  it("unknown falls back to info", () => {
    expect(getSeverityBadgeColors("nope")).toContain("text-primary");
  });
});

describe("stripHtml", () => {
  it("strips basic tags", () => {
    expect(stripHtml("<p>Hello</p>")).toBe("Hello");
  });

  it("converts br to newline", () => {
    expect(stripHtml("line1<br/>line2")).toContain("\n");
  });

  it("decodes &amp;", () => {
    expect(stripHtml("a &amp; b")).toBe("a & b");
  });

  it("returns empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });

  it("handles non-string input gracefully", () => {
    expect(stripHtml(null as unknown as string)).toBe("");
  });
});
