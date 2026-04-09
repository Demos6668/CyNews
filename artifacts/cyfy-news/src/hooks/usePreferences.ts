import { useState, useEffect, useCallback } from "react";
import {
  type Preferences,
  readPreference,
  writePreference,
  KEY_MAP,
} from "@/lib/preferences";

// Re-export KEY_MAP to allow tests and components to key on storage events
export { KEY_MAP };

/**
 * Hook to read and write a single preference value.
 * Automatically syncs with changes made in other components or tabs.
 */
export function usePreference<K extends keyof Preferences>(
  key: K
): [Preferences[K], (value: Preferences[K]) => void] {
  const [value, setValue] = useState<Preferences[K]>(() => readPreference(key));

  // Sync if another component or tab changes the same key
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY_MAP[key]) {
        setValue(readPreference(key));
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [key]);

  const setAndPersist = useCallback(
    (newValue: Preferences[K]) => {
      setValue(newValue);
      writePreference(key, newValue);
    },
    [key]
  );

  return [value, setAndPersist];
}
