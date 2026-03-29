import { describe, it, expect } from "vitest";
import { parseMultiFilter } from "./pagination";

describe("parseMultiFilter", () => {
  it("returns empty array for undefined", () => {
    expect(parseMultiFilter(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseMultiFilter("")).toEqual([]);
  });

  it("parses single value", () => {
    expect(parseMultiFilter("critical")).toEqual(["critical"]);
  });

  it("parses comma-separated values", () => {
    expect(parseMultiFilter("critical,high,medium")).toEqual(["critical", "high", "medium"]);
  });

  it("trims whitespace and lowercases", () => {
    expect(parseMultiFilter(" Critical , HIGH , Medium ")).toEqual(["critical", "high", "medium"]);
  });

  it("filters out empty segments", () => {
    expect(parseMultiFilter("critical,,high,")).toEqual(["critical", "high"]);
  });
});
