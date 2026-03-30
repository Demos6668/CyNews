import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getTimeframeStartDate } from "./timeframe";

describe("getTimeframeStartDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 1h ago for 1h", () => {
    const result = getTimeframeStartDate("1h");
    expect(result).toEqual(new Date("2024-06-15T11:00:00Z"));
  });

  it("returns 6h ago for 6h", () => {
    const result = getTimeframeStartDate("6h");
    expect(result).toEqual(new Date("2024-06-15T06:00:00Z"));
  });

  it("returns 24h ago for 24h", () => {
    const result = getTimeframeStartDate("24h");
    expect(result).toEqual(new Date("2024-06-14T12:00:00Z"));
  });

  it("returns 7d ago for 7d", () => {
    const result = getTimeframeStartDate("7d");
    expect(result).toEqual(new Date("2024-06-08T12:00:00Z"));
  });

  it("returns 30d ago for 30d", () => {
    const result = getTimeframeStartDate("30d");
    expect(result).toEqual(new Date("2024-05-16T12:00:00Z"));
  });

  it("returns null for all", () => {
    const result = getTimeframeStartDate("all");
    expect(result).toBeNull();
  });

  it("defaults to 24h for unknown value", () => {
    const result = getTimeframeStartDate("unknown" as "24h");
    expect(result).toEqual(new Date("2024-06-14T12:00:00Z"));
  });
});
