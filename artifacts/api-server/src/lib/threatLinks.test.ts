import { describe, expect, it } from "vitest";
import {
  isDisplayableThreat,
  normalizeThreatLinks,
} from "./threatLinks";

describe("threatLinks", () => {
  it("requires both source and sourceUrl for display", () => {
    expect(isDisplayableThreat({ source: "ThreatFox", sourceUrl: "https://example.com/threat" })).toBe(true);
    expect(isDisplayableThreat({ source: "", sourceUrl: "https://example.com/threat" })).toBe(false);
    expect(isDisplayableThreat({ source: "ThreatFox", sourceUrl: null })).toBe(false);
  });

  it("deduplicates references and removes the canonical source URL", () => {
    const links = normalizeThreatLinks({
      source: "Ransomware.live",
      sourceUrl: "http://exampleonion.onion/post/1",
      references: [
        "http://exampleonion.onion/post/1",
        "https://mirror.example.com/post/1",
        " https://mirror.example.com/post/1 ",
      ],
    });

    expect(links.sourceUrl).toBe("http://exampleonion.onion/post/1");
    expect(links.references).toEqual(["https://mirror.example.com/post/1"]);
  });
});
