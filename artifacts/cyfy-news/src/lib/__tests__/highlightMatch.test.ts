import { describe, it, expect } from "vitest";
import { highlightMatch } from "../highlightMatch";

describe("highlightMatch", () => {
  it("returns single non-highlighted segment when query is empty", () => {
    const result = highlightMatch("hello world", "");
    expect(result).toEqual([{ text: "hello world", highlight: false }]);
  });

  it("returns single non-highlighted segment when query is whitespace", () => {
    const result = highlightMatch("hello world", "   ");
    expect(result).toEqual([{ text: "hello world", highlight: false }]);
  });

  it("returns single non-highlighted segment when text is empty", () => {
    const result = highlightMatch("", "cve");
    expect(result).toEqual([{ text: "", highlight: false }]);
  });

  it("highlights a single match in the middle", () => {
    const result = highlightMatch("This is critical now", "critical");
    expect(result).toEqual([
      { text: "This is ", highlight: false },
      { text: "critical", highlight: true },
      { text: " now", highlight: false },
    ]);
  });

  it("highlights a match at the start", () => {
    const result = highlightMatch("critical vulnerability", "critical");
    expect(result[0]).toEqual({ text: "critical", highlight: true });
  });

  it("highlights a match at the end", () => {
    const result = highlightMatch("very critical", "critical");
    const last = result[result.length - 1];
    expect(last).toEqual({ text: "critical", highlight: true });
  });

  it("is case-insensitive", () => {
    const result = highlightMatch("CRITICAL vulnerability", "critical");
    const highlighted = result.filter((s) => s.highlight);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].text).toBe("CRITICAL");
  });

  it("highlights multiple occurrences", () => {
    const result = highlightMatch("cve-1 and cve-2", "cve");
    const highlighted = result.filter((s) => s.highlight);
    expect(highlighted).toHaveLength(2);
  });

  it("escapes regex special characters in query", () => {
    // Should not throw — parentheses are special regex chars
    expect(() => highlightMatch("CVE (2024)", "(2024)")).not.toThrow();
    const result = highlightMatch("CVE (2024)", "(2024)");
    expect(result.some((s) => s.highlight)).toBe(true);
  });

  it("returns no empty-string segments", () => {
    const result = highlightMatch("cve", "cve");
    expect(result.every((s) => s.text.length > 0)).toBe(true);
  });
});
