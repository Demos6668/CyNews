import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

type WsMessage = { type: string; data?: unknown; timestamp?: string };

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [nextUpdate, setNextUpdate] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
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
          case "REFRESH_COMPLETE":
            setIsRefreshing(false);
            setLastUpdate(msg.timestamp ?? new Date().toISOString());
            setNextUpdate(null);
            queryClient.invalidateQueries();
            break;
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
      reconnectRef.current = setTimeout(() => connect(), 5000);
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
