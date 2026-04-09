import { beforeEach, describe, expect, it, vi } from "vitest";

const insertedRows: Array<Record<string, unknown>> = [];
let existingRows: Array<Record<string, unknown>> = [];
let responsePayload: unknown;

vi.mock("@workspace/india-detector", () => ({
  indiaDetector: {
    getIndiaDetails: () => ({
      isIndia: false,
      confidence: 0,
      state: null,
      stateName: null,
      city: null,
      sector: null,
    }),
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
    },
  };
});

import { createEmptyResult } from "./feedUtils";
import { buildThreatInsert, type RssSource } from "./fetcherRss";
import { fetchThreatFox } from "./fetcherThreatFox";
import { fetchURLhaus } from "./fetcherUrlhaus";
import { fetchFeodoTracker } from "./fetcherFeodo";
import { fetchRansomwareLive } from "./fetcherRansomware";

describe("threat source link semantics", () => {
  beforeEach(() => {
    insertedRows.length = 0;
    existingRows = [];
    responsePayload = null;
    process.env.THREATFOX_AUTH_KEY = "test-key";
    process.env.URLHAUS_AUTH_KEY = "test-key";
  });

  it("builds RSS threat inserts with sourceUrl as primary source and no duplicate references", () => {
    const source: RssSource = {
      name: "Intel 471",
      url: "https://intel471.com/blog/feed/",
      category: "THREAT",
    };

    const threat = buildThreatInsert(
      source,
      "Threat Actor Campaign",
      "Summary",
      "Description",
      "https://intel471.com/blog/threat-actor-campaign",
      new Date("2026-04-04T00:00:00Z"),
      "global",
      "high",
      {
        isIndiaRelated: false,
        indiaConfidence: 0,
      },
    );

    expect(threat.source).toBe("Intel 471");
    expect(threat.sourceUrl).toBe("https://intel471.com/blog/threat-actor-campaign");
    expect(threat.references).toEqual([]);
  });

  it("stores ThreatFox rows without repeating sourceUrl in references", async () => {
    responsePayload = {
      data: [
        {
          id: 12345,
          ioc: "evil.example",
          malware_printable: "StealerX",
          threat_type_desc: "Credential theft",
          confidence_level: 90,
          first_seen: "2026-04-04T00:00:00Z",
          ioc_type: "domain",
        },
      ],
    };

    const result = createEmptyResult();
    await fetchThreatFox(result);

    expect(insertedRows[0]).toMatchObject({
      source: "ThreatFox",
      sourceUrl: "https://threatfox.abuse.ch/ioc/12345/",
      references: [],
    });
  });

  it("stores URLhaus rows without repeating sourceUrl in references", async () => {
    responsePayload = {
      urls: [
        {
          id: "999",
          url: "https://malicious.example/payload",
          threat: "malware_download",
          date_added: "2026-04-04T00:00:00Z",
          url_info_from_api: { host: "malicious.example" },
        },
      ],
    };

    const result = createEmptyResult();
    await fetchURLhaus(result);

    expect(insertedRows[0]).toMatchObject({
      source: "URLhaus",
      sourceUrl: "https://urlhaus.abuse.ch/url/999/",
      references: [],
    });
  });

  it("stores Feodo rows without repeating sourceUrl in references", async () => {
    responsePayload = [
      {
        ip_address: "10.0.0.5",
        port: 443,
        malware: "Feodo",
        country: "DE",
        first_seen: "2026-04-04T00:00:00Z",
      },
    ];

    const result = createEmptyResult();
    await fetchFeodoTracker(result);

    expect(insertedRows[0]).toMatchObject({
      source: "Feodo Tracker",
      sourceUrl: "https://feodotracker.abuse.ch/browse/host/10.0.0.5/",
      references: [],
    });
  });

  it("stores Ransomware.live rows without repeating sourceUrl in references", async () => {
    responsePayload = [
      {
        post_title: "Victim Org",
        group_name: "krybit",
        country: "US",
        published: "2026-04-04T00:00:00Z",
        post_url: "http://exampleonion.onion/post/123",
      },
    ];

    const result = createEmptyResult();
    await fetchRansomwareLive(result);

    expect(insertedRows[0]).toMatchObject({
      source: "Ransomware.live",
      sourceUrl: "http://exampleonion.onion/post/123",
      references: [],
    });
  });
});
