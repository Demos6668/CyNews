import { describe, expect, it } from "vitest";
import { planRetention, timestampForFilename, type BackupFileInfo } from "./retention";

function file(path: string, mtimeMs: number, size = 1): BackupFileInfo {
  return { path, mtimeMs, size };
}

describe("planRetention", () => {
  it("keeps the newest N and marks older ones for deletion", () => {
    const files = [
      file("a", 100),
      file("b", 300),
      file("c", 200),
      file("d", 500),
      file("e", 400),
    ];
    const plan = planRetention(files, 2);
    expect(plan.keep.map((f) => f.path)).toEqual(["d", "e"]);
    expect(plan.delete.map((f) => f.path)).toEqual(["b", "c", "a"]);
  });

  it("keeps nothing when keepCount is 0", () => {
    const plan = planRetention([file("a", 100), file("b", 200)], 0);
    expect(plan.keep).toEqual([]);
    expect(plan.delete).toHaveLength(2);
  });

  it("keeps everything when keepCount exceeds input size", () => {
    const plan = planRetention([file("a", 100), file("b", 200)], 10);
    expect(plan.keep.map((f) => f.path)).toEqual(["b", "a"]);
    expect(plan.delete).toEqual([]);
  });

  it("handles empty input", () => {
    const plan = planRetention([], 5);
    expect(plan.keep).toEqual([]);
    expect(plan.delete).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const files = [file("a", 100), file("b", 200)];
    const snapshot = [...files];
    planRetention(files, 1);
    expect(files).toEqual(snapshot);
  });

  it("throws when keepCount is negative", () => {
    expect(() => planRetention([], -1)).toThrow(/keepCount/);
  });
});

describe("timestampForFilename", () => {
  it("formats a Date as compact UTC timestamp", () => {
    const d = new Date("2026-04-17T09:07:03.000Z");
    expect(timestampForFilename(d)).toBe("20260417T090703Z");
  });

  it("zero-pads single-digit months/days/hours", () => {
    const d = new Date("2026-01-02T03:04:05.000Z");
    expect(timestampForFilename(d)).toBe("20260102T030405Z");
  });
});
