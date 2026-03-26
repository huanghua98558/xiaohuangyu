"use client";

import { useEffect, useRef, useCallback, useState } from "react";

type MessageHandler = (data: any) => void;

interface WSState {
  connected: boolean;
  onlineCount: number;
  lastMessage: any;
}

let globalWs: WebSocket | null = null;
let globalHandlers = new Map<string, Set<MessageHandler>>();
let globalState: WSState = {
  connected: false,
  onlineCount: 0,
  lastMessage: null,
};
let heartbeatTimer: NodeJS.Timeout | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 10;

function getWsUrl() {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("admin_token")
      : null;
  if (!token) return null;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
}

function doConnect() {
  const url = getWsUrl();
  if (!url) return;
  if (
    globalWs &&
    (globalWs.readyState === WebSocket.OPEN ||
      globalWs.readyState === WebSocket.CONNECTING)
  )
    return;

  try {
    globalWs = new WebSocket(url);

    globalWs.onopen = () => {
      console.log("[AdminWS] 连接成功");
      globalState.connected = true;
      reconnectAttempts = 0;
      notifyStateChange();
      startHeartbeat();
      // 请求服务健康状态
      if (globalWs && globalWs.readyState === WebSocket.OPEN) {
        globalWs.send(JSON.stringify({ type: "request_health" }));
      }
    };

    globalWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        globalState.lastMessage = msg;
        if (msg.type === "heartbeat_ack" && msg.data?.onlineCount) {
          globalState.onlineCount = msg.data.onlineCount;
        }
        const handlers = globalHandlers.get(msg.type);
        if (handlers) {
          handlers.forEach((h) => {
            try {
              h(msg.data);
            } catch (e) {}
          });
        }
        const allHandlers = globalHandlers.get("*");
        if (allHandlers) {
          allHandlers.forEach((h) => {
            try {
              h(msg);
            } catch (e) {}
          });
        }
      } catch (e) {}
    };

    globalWs.onclose = () => {
      globalState.connected = false;
      notifyStateChange();
      stopHeartbeat();
      scheduleReconnect();
    };

    globalWs.onerror = () => {
      globalState.connected = false;
    };
  } catch (e) {
    scheduleReconnect();
  }
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (globalWs?.readyState === WebSocket.OPEN) {
      globalWs.send(
        JSON.stringify({
          type: "heartbeat",
          data: { timestamp: Date.now(), currentPage: window.location.pathname },
        })
      );
    }
  }, 25000);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT) return;
  const delay = Math.min(3000 * Math.pow(1.5, reconnectAttempts), 30000);
  reconnectTimer = setTimeout(() => {
    reconnectAttempts++;
    doConnect();
  }, delay);
}

const stateListeners = new Set<() => void>();
function notifyStateChange() {
  stateListeners.forEach((l) => l());
}

export function useAdminWebSocket(
  messageTypes?: string | string[],
  handler?: MessageHandler
) {
  const [connected, setConnected] = useState(globalState.connected);
  const [onlineCount, setOnlineCount] = useState(globalState.onlineCount);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    doConnect();
    const listener = () => {
      setConnected(globalState.connected);
      setOnlineCount(globalState.onlineCount);
    };
    stateListeners.add(listener);
    return () => {
      stateListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!messageTypes || !handler) return;
    const types = Array.isArray(messageTypes) ? messageTypes : [messageTypes];
    const wrappedHandler: MessageHandler = (data) => {
      handlerRef.current?.(data);
    };
    types.forEach((t) => {
      if (!globalHandlers.has(t)) globalHandlers.set(t, new Set());
      globalHandlers.get(t)!.add(wrappedHandler);
    });
    return () => {
      types.forEach((t) => {
        globalHandlers.get(t)?.delete(wrappedHandler);
      });
    };
  }, [messageTypes ? (Array.isArray(messageTypes) ? messageTypes.join(",") : messageTypes) : ""]);

  const send = useCallback((type: string, data?: any) => {
    if (globalWs?.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify({ type, data }));
    }
  }, []);

  return { connected, onlineCount, send };
}

export default useAdminWebSocket;
