import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  readPreference,
  writePreference,
  readAllPreferences,
  PREFERENCE_DEFAULTS,
} from "../preferences";

// We need window.dispatchEvent for writePreference — it's fine in jsdom
// but we mock storage so tests are isolated.

let store: Record<string, string> = {};

beforeEach(() => {
  store = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  });
  // Stub dispatchEvent to avoid JSDOM storage event issues in unit tests
  vi.stubGlobal("dispatchEvent", vi.fn());
});

describe("readPreference", () => {
  it("returns default when key is absent", () => {
    expect(readPreference("autoRefresh")).toBe(PREFERENCE_DEFAULTS.autoRefresh);
    expect(readPreference("refreshInterval")).toBe(PREFERENCE_DEFAULTS.refreshInterval);
    expect(readPreference("profileName")).toBe(PREFERENCE_DEFAULTS.profileName);
  });

  it("parses boolean 'true' correctly", () => {
    store["cyfy-desktop-notifications"] = "true";
    expect(readPreference("desktopNotifications")).toBe(true);
  });

  it("parses boolean 'false' correctly", () => {
    store["cyfy-auto-refresh"] = "false";
    expect(readPreference("autoRefresh")).toBe(false);
  });

  it("parses number correctly", () => {
    store["cyfy-refresh-interval"] = "120";
    expect(readPreference("refreshInterval")).toBe(120);
  });

  it("clamps number to min 10", () => {
    store["cyfy-refresh-interval"] = "5";
    expect(readPreference("refreshInterval")).toBe(10);
  });

  it("clamps number to max 300", () => {
    store["cyfy-refresh-interval"] = "9999";
    expect(readPreference("refreshInterval")).toBe(300);
  });

  it("returns default for NaN number", () => {
    store["cyfy-refresh-interval"] = "not-a-number";
    expect(readPreference("refreshInterval")).toBe(PREFERENCE_DEFAULTS.refreshInterval);
  });

  it("returns default when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("storage unavailable"); },
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    expect(readPreference("autoRefresh")).toBe(PREFERENCE_DEFAULTS.autoRefresh);
  });
});

describe("writePreference", () => {
  it("persists boolean", () => {
    writePreference("autoRefresh", false);
    expect(store["cyfy-auto-refresh"]).toBe("false");
  });

  it("persists number", () => {
    writePreference("refreshInterval", 90);
    expect(store["cyfy-refresh-interval"]).toBe("90");
  });

  it("persists string", () => {
    writePreference("profileName", "Alice");
    expect(store["cyfy-profile-name"]).toBe("Alice");
  });
});

describe("readAllPreferences", () => {
  it("returns object with all keys", () => {
    const prefs = readAllPreferences();
    expect(Object.keys(prefs)).toEqual(expect.arrayContaining([
      "autoRefresh",
      "refreshInterval",
      "desktopNotifications",
      "criticalOnly",
      "profileName",
      "department",
    ]));
  });

  it("returns stored values", () => {
    store["cyfy-auto-refresh"] = "false";
    store["cyfy-refresh-interval"] = "30";
    const prefs = readAllPreferences();
    expect(prefs.autoRefresh).toBe(false);
    expect(prefs.refreshInterval).toBe(30);
  });
});
