import { describe, it, expect } from "vitest";
import { CyberSecurityRelevanceDetector } from "./index";

describe("CyberSecurityRelevanceDetector", () => {
  const detector = new CyberSecurityRelevanceDetector();

  describe("isRelevant", () => {
    it("returns false for empty input", () => {
      const result = detector.isRelevant("");
      expect(result.isRelevant).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it("detects ransomware content as relevant", () => {
      const result = detector.isRelevant("New ransomware strain encrypts hospital systems demanding Bitcoin payment");
      expect(result.isRelevant).toBe(true);
      expect(result.category).toBe("Ransomware");
    });

    it("detects CVE references as relevant", () => {
      const result = detector.isRelevant("CVE-2024-12345 allows remote code execution in Apache server");
      expect(result.isRelevant).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(50);
    });

    it("detects phishing content", () => {
      const result = detector.isRelevant("Massive phishing campaign targets banking customers with fake login pages");
      expect(result.isRelevant).toBe(true);
      expect(result.category).toBe("Phishing");
    });

    it("detects data breach content", () => {
      const result = detector.isRelevant("Major data breach exposes 10 million user records from cloud database");
      expect(result.isRelevant).toBe(true);
    });

    it("rejects cricket/sports content", () => {
      const result = detector.isRelevant("India won the cricket match against Australia at the Melbourne Cricket Ground");
      expect(result.isRelevant).toBe(false);
      expect(result.reason).toBe("Non-cybersecurity content detected");
    });

    it("rejects movie/entertainment content", () => {
      const result = detector.isRelevant("New Bollywood movie starring popular actor won best film at festival");
      expect(result.isRelevant).toBe(false);
    });

    it("does not false-positive on words containing cyber substrings", () => {
      // "actor" contains "tor", "monitor" contains "tor", "rapid" contains "api"
      const result = detector.isRelevant("The actor was seen on a monitor during the rapid deployment ceremony");
      expect(result.isRelevant).toBe(false);
    });

    it("rejects weather content", () => {
      const result = detector.isRelevant("Heavy rainfall forecast for Mumbai with temperature dropping to 25 degrees");
      expect(result.isRelevant).toBe(false);
    });

    it("keeps cyber content even when mixed with non-relevant patterns", () => {
      const result = detector.isRelevant("Cricket website hacked, ransomware deployed on match score servers");
      expect(result.isRelevant).toBe(true);
    });

    it("trusts security sources", () => {
      const result = detector.isRelevant("New advisory released today", { source: "BleepingComputer" });
      expect(result.isRelevant).toBe(true);
      expect(result.matches!.some((m) => m.type === "source")).toBe(true);
    });

    it("detects APT content", () => {
      const result = detector.isRelevant("Nation-state APT group launches sophisticated cyber espionage campaign");
      expect(result.isRelevant).toBe(true);
      expect(result.category).toBe("APT");
    });

    it("detects DDoS content", () => {
      const result = detector.isRelevant("Massive DDoS attack takes down government websites");
      expect(result.isRelevant).toBe(true);
      expect(result.category).toBe("DDoS");
    });

    it("caps confidence at 100", () => {
      const result = detector.isRelevant(
        "CVE-2024-99999 ransomware malware phishing zero-day exploit vulnerability data breach hacked compromised",
        { source: "BleepingComputer" }
      );
      expect(result.confidence).toBeLessThanOrEqual(100);
    });
  });
});
