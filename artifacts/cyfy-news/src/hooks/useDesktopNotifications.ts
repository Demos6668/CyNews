import { useEffect, useRef } from "react";
import { readPreference } from "@/lib/preferences";

interface RefreshCompleteDetail {
  criticalCount?: number;
  newItems?: number;
}

/**
 * Fires browser Notification when a cyfy:refresh-complete event is received,
 * provided the user has enabled desktop notifications in Settings.
 * Honors criticalOnly by skipping notifications with no critical items.
 * De-duplicates by event timestamp to avoid double-firing on reconnect.
 */
export function useDesktopNotifications() {
  const lastTimestampRef = useRef<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const enabled = readPreference("desktopNotifications");
      if (!enabled) return;
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;

      const detail = (e as CustomEvent<RefreshCompleteDetail>).detail ?? {};
      const criticalOnly = readPreference("criticalOnly");
      const criticalCount = detail.criticalCount ?? 0;

      if (criticalOnly && criticalCount === 0) return;

      // De-duplicate: skip if we already fired for this exact timestamp
      const ts = (e as CustomEvent & { timeStamp: number }).timeStamp?.toString();
      if (ts && ts === lastTimestampRef.current) return;
      lastTimestampRef.current = ts ?? null;

      const newItems = detail.newItems ?? 0;
      const body =
        criticalCount > 0
          ? `${criticalCount} critical alert${criticalCount > 1 ? "s" : ""} detected`
          : newItems > 0
          ? `${newItems} new item${newItems > 1 ? "s" : ""} available`
          : "Feed refreshed";

      try {
        new Notification("CyNews — Feed Updated", {
          body,
          icon: "/favicon.ico",
          tag: "cyfy-refresh",
        });
      } catch {
        // Notification may fail silently in some environments
      }
    };

    window.addEventListener("cyfy:refresh-complete", handler);
    return () => window.removeEventListener("cyfy:refresh-complete", handler);
  }, []);
}
