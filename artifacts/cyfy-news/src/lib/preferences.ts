/**
 * Pure, framework-free preferences store backed by localStorage.
 * All functions are immutable (return new values, never mutate).
 */

export interface Preferences {
  autoRefresh: boolean;
  refreshInterval: number; // seconds, 10–300
  desktopNotifications: boolean;
  criticalOnly: boolean;
  profileName: string;
  department: string;
}

export const PREFERENCE_DEFAULTS: Preferences = {
  autoRefresh: true,
  refreshInterval: 60,
  desktopNotifications: false,
  criticalOnly: false,
  profileName: "Lead Analyst 01",
  department: "Global Threat Intelligence",
};

export const KEY_MAP: Record<keyof Preferences, string> = {
  autoRefresh: "cyfy-auto-refresh",
  refreshInterval: "cyfy-refresh-interval",
  desktopNotifications: "cyfy-desktop-notifications",
  criticalOnly: "cyfy-critical-only",
  profileName: "cyfy-profile-name",
  department: "cyfy-department",
};

function parseValue<K extends keyof Preferences>(
  key: K,
  raw: string | null
): Preferences[K] {
  const def = PREFERENCE_DEFAULTS[key];
  if (raw === null) return def;
  try {
    if (typeof def === "boolean") return (raw === "true") as Preferences[K];
    if (typeof def === "number") {
      const n = Number(raw);
      if (Number.isNaN(n)) return def;
      return Math.min(300, Math.max(10, n)) as Preferences[K];
    }
    return raw as Preferences[K];
  } catch {
    return def;
  }
}

export function readPreference<K extends keyof Preferences>(key: K): Preferences[K] {
  try {
    const raw = localStorage.getItem(KEY_MAP[key]);
    return parseValue(key, raw);
  } catch {
    return PREFERENCE_DEFAULTS[key];
  }
}

export function writePreference<K extends keyof Preferences>(
  key: K,
  value: Preferences[K]
): void {
  try {
    localStorage.setItem(KEY_MAP[key], String(value));
    // Notify other tabs / same-tab listeners
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: KEY_MAP[key],
        newValue: String(value),
        storageArea: localStorage,
      })
    );
  } catch {
    // localStorage may be unavailable (private mode, storage quota)
  }
}

export function readAllPreferences(): Preferences {
  return (Object.keys(PREFERENCE_DEFAULTS) as (keyof Preferences)[]).reduce(
    (acc, key) => ({ ...acc, [key]: readPreference(key) }),
    {} as Preferences
  );
}
