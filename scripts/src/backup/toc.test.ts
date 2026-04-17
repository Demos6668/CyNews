import { describe, expect, it } from "vitest";
import { countTocEntries } from "./toc";

describe("countTocEntries", () => {
  it("counts typical pg_restore --list lines", () => {
    const listing = `;
; Archive created at 2026-04-17 10:00:00 UTC
;     dbname: cyfy
;     TOC Entries: 42
;
;
; Selected TOC Entries:
;
3458; 1262 16384 DATABASE - cyfy cyfy
3459; 1259 16404 TABLE public news_items cyfy
3460; 1259 16411 TABLE public advisories cyfy
`;
    expect(countTocEntries(listing)).toBe(3);
  });

  it("returns 0 for an empty string", () => {
    expect(countTocEntries("")).toBe(0);
  });

  it("ignores comment and blank lines", () => {
    const listing = `;
; only comments
;

`;
    expect(countTocEntries(listing)).toBe(0);
  });

  it("tolerates leading whitespace on entry lines", () => {
    const listing = `  3458; 1262 16384 DATABASE - cyfy cyfy\n`;
    expect(countTocEntries(listing)).toBe(1);
  });
});
