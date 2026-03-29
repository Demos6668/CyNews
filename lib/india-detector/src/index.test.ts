import { describe, it, expect } from "vitest";
import { IndiaDetector } from "./index";

describe("IndiaDetector", () => {
  const detector = new IndiaDetector();

  describe("isIndiaRelated", () => {
    it("returns false for empty text", () => {
      const result = detector.isIndiaRelated("");
      expect(result.isIndia).toBe(false);
      expect(result.scope).toBe("global");
    });

    it("detects CERT-In references as India-related", () => {
      const result = detector.isIndiaRelated("CERT-In issued a security advisory about critical vulnerabilities");
      expect(result.isIndia).toBe(true);
      expect(result.scope).toBe("local");
      expect(result.confidence).toBeGreaterThanOrEqual(20);
    });

    it("detects Indian cities", () => {
      const result = detector.isIndiaRelated("A major cyber attack targeted servers in Mumbai and Bangalore");
      expect(result.isIndia).toBe(true);
      expect(result.matches.some((m) => m.type === "city")).toBe(true);
    });

    it("detects Indian states", () => {
      const result = detector.isIndiaRelated("Cyber fraud ring busted in Maharashtra by police");
      expect(result.isIndia).toBe(true);
      expect(result.matches.some((m) => m.type === "state")).toBe(true);
    });

    it("detects Indian companies", () => {
      const result = detector.isIndiaRelated("Data breach at Infosys exposes customer records");
      expect(result.isIndia).toBe(true);
    });

    it("detects Aadhaar references", () => {
      const result = detector.isIndiaRelated("Aadhaar data of millions leaked online");
      expect(result.isIndia).toBe(true);
    });

    it("excludes Indiana (US state) false positives", () => {
      const result = detector.isIndiaRelated("Indiana University reported a system outage in Bloomington, Indiana");
      expect(result.isIndia).toBe(false);
      expect(result.scope).toBe("global");
    });

    it("excludes Mumbai Indians (cricket team)", () => {
      const result = detector.isIndiaRelated("Mumbai Indians won the IPL match against Chennai");
      expect(result.isIndia).toBe(false);
    });

    it("detects metadata country=India", () => {
      const result = detector.isIndiaRelated("A server was compromised", { country: "India" });
      expect(result.isIndia).toBe(true);
    });

    it("detects Indian source", () => {
      const result = detector.isIndiaRelated("New vulnerability discovered", { source: "The Hindu" });
      expect(result.isIndia).toBe(true);
    });

    it("classifies global content correctly", () => {
      const result = detector.isIndiaRelated("Microsoft releases critical security patches for Windows");
      expect(result.isIndia).toBe(false);
      expect(result.scope).toBe("global");
    });
  });

  describe("detectState", () => {
    it("returns null for empty text", () => {
      expect(detector.detectState("")).toBeNull();
    });

    it("detects state by name", () => {
      const result = detector.detectState("Cyber attack in Maharashtra");
      expect(result).not.toBeNull();
      expect(result!.code).toBe("MH");
    });

    it("detects state by city", () => {
      const result = detector.detectState("Servers in Bangalore were compromised");
      expect(result).not.toBeNull();
      expect(result!.code).toBe("KA");
      expect(result!.city).toBe("bangalore");
    });
  });

  describe("detectSector", () => {
    it("returns null for empty text", () => {
      expect(detector.detectSector("")).toBeNull();
    });

    it("detects banking sector", () => {
      expect(detector.detectSector("RBI issues cyber security guidelines for banks")).toBe("Banking & Financial Services");
    });

    it("detects IT sector", () => {
      expect(detector.detectSector("TCS reports data breach in software division")).toBe("IT & ITES");
    });

    it("detects defence sector", () => {
      expect(detector.detectSector("DRDO systems targeted by cyber espionage")).toBe("Defence");
    });
  });

  describe("isIndianSource", () => {
    it("identifies Indian sources", () => {
      expect(detector.isIndianSource("CERT-In Advisory")).toBe(true);
      expect(detector.isIndianSource("The Hindu")).toBe(true);
    });

    it("rejects non-Indian sources", () => {
      expect(detector.isIndianSource("BleepingComputer")).toBe(false);
    });
  });

  describe("getIndiaDetails", () => {
    it("returns complete details for India-related content", () => {
      const details = detector.getIndiaDetails("CERT-In advisory about vulnerability affecting servers in Mumbai");
      expect(details.isIndia).toBe(true);
      expect(details.state).toBe("MH");
      expect(details.city).toBe("mumbai");
    });

    it("returns null fields for non-India content", () => {
      const details = detector.getIndiaDetails("Microsoft patches Windows vulnerability");
      expect(details.isIndia).toBe(false);
      expect(details.state).toBeNull();
      expect(details.city).toBeNull();
      expect(details.sector).toBeNull();
    });
  });
});
