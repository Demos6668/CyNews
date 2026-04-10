import { describe, it, expect, beforeEach } from "vitest";
import {
  getRecentItems,
  addRecentItem,
  removeRecentItem,
  clearRecentItems,
} from "../recentlyViewed";

beforeEach(() => {
  localStorage.clear();
});

describe("getRecentItems", () => {
  it("returns empty array when storage is empty", () => {
    expect(getRecentItems()).toEqual([]);
  });

  it("returns empty array on corrupt storage", () => {
    localStorage.setItem("cyfy:recently-viewed", "not-json");
    expect(getRecentItems()).toEqual([]);
  });
});

describe("addRecentItem", () => {
  it("places new item at head of list", () => {
    addRecentItem({ id: 1, type: "advisory", title: "CVE-2024-1" });
    addRecentItem({ id: 2, type: "threat", title: "APT-29" });
    const items = getRecentItems();
    expect(items[0].id).toBe(2);
    expect(items[0].type).toBe("threat");
  });

  it("deduplicates by id+type — same id+type goes to head", () => {
    addRecentItem({ id: 1, type: "advisory", title: "First visit" });
    addRecentItem({ id: 2, type: "advisory", title: "Middle" });
    addRecentItem({ id: 1, type: "advisory", title: "Second visit" });
    const items = getRecentItems();
    expect(items[0].id).toBe(1);
    expect(items[0].title).toBe("Second visit");
    expect(items.filter((i) => i.id === 1 && i.type === "advisory")).toHaveLength(1);
  });

  it("does not deduplicate same id with different type", () => {
    addRecentItem({ id: 1, type: "advisory", title: "Advisory" });
    addRecentItem({ id: 1, type: "threat", title: "Threat" });
    const items = getRecentItems();
    expect(items).toHaveLength(2);
  });

  it("caps list at 20 items", () => {
    for (let i = 0; i < 25; i++) {
      addRecentItem({ id: i, type: "news", title: `News ${i}` });
    }
    expect(getRecentItems()).toHaveLength(20);
  });

  it("sets visitedAt to a valid ISO string", () => {
    addRecentItem({ id: 1, type: "advisory", title: "Test" });
    const item = getRecentItems()[0];
    expect(() => new Date(item.visitedAt)).not.toThrow();
    expect(new Date(item.visitedAt).getFullYear()).toBeGreaterThan(2020);
  });

  it("does not mutate the original list returned by a previous call", () => {
    addRecentItem({ id: 1, type: "advisory", title: "A" });
    const before = getRecentItems();
    addRecentItem({ id: 2, type: "advisory", title: "B" });
    expect(before).toHaveLength(1);
  });
});

describe("removeRecentItem", () => {
  it("removes item by id+type", () => {
    addRecentItem({ id: 1, type: "advisory", title: "A" });
    addRecentItem({ id: 2, type: "advisory", title: "B" });
    removeRecentItem(1, "advisory");
    const items = getRecentItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(2);
  });

  it("leaves list unchanged when id+type not found", () => {
    addRecentItem({ id: 1, type: "advisory", title: "A" });
    removeRecentItem(99, "advisory");
    expect(getRecentItems()).toHaveLength(1);
  });

  it("only removes matching type, not matching id with different type", () => {
    addRecentItem({ id: 1, type: "advisory", title: "Advisory" });
    addRecentItem({ id: 1, type: "threat", title: "Threat" });
    removeRecentItem(1, "advisory");
    const items = getRecentItems();
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("threat");
  });
});

describe("clearRecentItems", () => {
  it("empties the list", () => {
    addRecentItem({ id: 1, type: "advisory", title: "A" });
    clearRecentItems();
    expect(getRecentItems()).toEqual([]);
  });
});
