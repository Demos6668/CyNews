import { beforeEach, describe, expect, it, vi } from "vitest";

const insertedRows: Array<Record<string, unknown>> = [];
let existingRows: Array<Record<string, unknown>> = [];
let responsePayload: unknown;

vi.mock("@workspace/india-detector", () => ({
  indiaDetector: {
    getIndiaDetails: () => ({ isIndia: false, confidence: 0 }),
  },
}));

vi.mock("./logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./fetchWithTimeout", () => ({
  fetchWithTimeout: vi.fn(async () => ({
    ok: true,
    json: async () => responsePayload,
  })),
}));

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();

  return {
    ...actual,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(existingRows),
          }),
        }),
      }),
      insert: () => ({
        values: async (row: Record<string, unknown>) => {
          insertedRows.push(row);
        },
      }),
      update: () => ({
        set: () => ({
          where: async () => undefined,
        }),
      }),
    },
  };
});

import { fetchCisaKev } from "./fetcherCisaKev";
import { fetchNVD } from "./fetcherNvd";
import { createEmptyResult } from "./feedUtils";

describe("advisory source and patch link semantics", () => {
  beforeEach(() => {
    insertedRows.length = 0;
    existingRows = [];
    responsePayload = null;
  });

  it("stores CISA KEV advisories with CISA as source and NVD only as a reference", async () => {
    responsePayload = {
      vulnerabilities: [
        {
          cveID: "CVE-2026-1111",
          vendorProject: "Acme",
          product: "Gateway",
          vulnerabilityName: "Actively Exploited Gateway Flaw",
          dateAdded: "2026-04-01",
          shortDescription: "CISA added this vulnerability to KEV.",
        },
      ],
    };

    const result = createEmptyResult();
    await fetchCisaKev(result);

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      cveId: "CVE-2026-1111",
      source: "CISA KEV",
      sourceUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      patchUrl: null,
    });
    expect(insertedRows[0].references).toEqual([
      "https://nvd.nist.gov/vuln/detail/CVE-2026-1111",
      "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    ]);
  });

  it("stores NVD advisories with NVD as source and without inventing a patch link", async () => {
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((callback: (...args: unknown[]) => void) => {
      callback();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout;

    try {
      responsePayload = {
        vulnerabilities: [
          {
            cve: {
              id: "CVE-2026-2222",
              descriptions: [
                { lang: "en", value: "Remote attackers can trigger a denial of service." },
              ],
              metrics: {
                cvssMetricV31: [{ cvssData: { baseScore: 7.5 } }],
              },
              published: "2026-04-02T00:00:00Z",
            },
          },
        ],
      };

      const result = createEmptyResult();
      await fetchNVD(result);

      expect(insertedRows).toHaveLength(1);
      expect(insertedRows[0]).toMatchObject({
        cveId: "CVE-2026-2222",
        source: "NVD",
        sourceUrl: "https://nvd.nist.gov/vuln/detail/CVE-2026-2222",
        patchUrl: null,
      });
      expect(insertedRows[0].references).toEqual([]);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });
});
