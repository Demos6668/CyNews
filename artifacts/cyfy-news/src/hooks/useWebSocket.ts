import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

type WsMessage = { type: string; data?: unknown; timestamp?: string };

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [nextUpdate, setNextUpdate] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const queryClient = useQueryClient();

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
            break;
          case "REFRESH_STARTED":
            setIsRefreshing(true);
            break;
          case "REFRESH_COMPLETE": {
            setIsRefreshing(false);
            setLastUpdate(msg.timestamp ?? new Date().toISOString());
            // Compute next 15-min boundary client-side (mirrors server logic)
            const now = new Date();
            const nextMin = Math.ceil((now.getMinutes() + 1) / 15) * 15;
            const next = new Date(now);
            next.setMinutes(nextMin, 0, 0);
            if (next <= now) next.setMinutes(next.getMinutes() + 15);
            setNextUpdate(next.toISOString());
            queryClient.invalidateQueries();
            break;
          }
          case "STATS_UPDATE":
            queryClient.invalidateQueries();
            break;
          case "REFRESH_ERROR":
            setIsRefreshing(false);
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (attemptRef.current < MAX_RECONNECT_ATTEMPTS) {
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
  }, [queryClient]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect]);

  return { isConnected, isRefreshing, lastUpdate, nextUpdate };
}
