import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

type WsMessage = { type: string; data?: unknown; timestamp?: string };

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const LIVE_QUERY_PREFIXES = [
  "/api/dashboard/stats",
  "/api/news",
  "/api/threats",
  "/api/advisories",
  "/api/advisories/cert-in",
  "/api/workspaces/",
] as const;

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [nextUpdate, setNextUpdate] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const disposedRef = useRef(false);
  const queryClient = useQueryClient();

  const invalidateLiveQueries = useCallback(() => {
    return queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && LIVE_QUERY_PREFIXES.some((prefix) => key.startsWith(prefix));
      },
    });
  }, [queryClient]);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      attemptRef.current = 0;
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        switch (msg.type) {
          case "CONNECTED":
            setNextUpdate((msg.data as { nextUpdate?: string })?.nextUpdate ?? null);
            window.dispatchEvent(new CustomEvent("cyfy:scheduler-status", { detail: msg.data ?? null }));
            break;
          case "REFRESH_STARTED":
            setIsRefreshing(true);
            window.dispatchEvent(new CustomEvent("cyfy:refresh-started", { detail: msg.data ?? null }));
            break;
          case "REFRESH_COMPLETE":
            setIsRefreshing(false);
            setLastUpdate(msg.timestamp ?? new Date().toISOString());
            setNextUpdate(null);
            void invalidateLiveQueries();
            window.dispatchEvent(new CustomEvent("cyfy:refresh-complete", { detail: msg.data ?? null }));
            break;
          case "STATS_UPDATE":
            void invalidateLiveQueries();
            window.dispatchEvent(new CustomEvent("cyfy:stats-update", { detail: msg.data ?? null }));
            break;
          case "REFRESH_ERROR":
            setIsRefreshing(false);
            window.dispatchEvent(new CustomEvent("cyfy:refresh-error", { detail: msg.data ?? null }));
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (!disposedRef.current && attemptRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(
          BASE_RECONNECT_DELAY * Math.pow(2, attemptRef.current) + Math.random() * 1000,
          MAX_RECONNECT_DELAY
        );
        attemptRef.current++;
        reconnectRef.current = setTimeout(() => connect(), delay);
      }
    };

    ws.onerror = () => {
      // connection will trigger onclose
    };

    wsRef.current = ws;
  }, [invalidateLiveQueries]);

  useEffect(() => {
    disposedRef.current = false;
    connect();
    return () => {
      disposedRef.current = true;
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect]);

  return { isConnected, isRefreshing, lastUpdate, nextUpdate };
}
