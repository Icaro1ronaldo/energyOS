import { useEffect, useRef, useCallback, useState } from "react";

interface WsMessage {
  domain: string;
  zone: string;
}

interface Options {
  onMessage: (msg: WsMessage) => void;
}

export function useWebSocket({ onMessage }: Options) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const wsUrl = `${import.meta.env.VITE_WS_URL || "ws://localhost:8000"}/ws/live`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setConnected(true);

    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 3000);
    };

    ws.onmessage = (e: MessageEvent) => {
      try {
        onMessageRef.current(JSON.parse(e.data as string));
      } catch {
        // ignore malformed frames
      }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  return { connected };
}
