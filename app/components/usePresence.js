"use client";

import { useEffect, useState } from "react";

/** Get or initialize a session ID that persists across refresh in sessionStorage. */
function getSessionId() {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("nova_tv_session_id");
  if (!id) {
    id = "user_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    sessionStorage.setItem("nova_tv_session_id", id);
  }
  return id;
}

/** Hook to ping the presence server and receive active stats. */
export function usePresence(channelId) {
  const [stats, setStats] = useState({ total: 0, channels: {} });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sessionId = getSessionId();

    const sendPing = async () => {
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, channelId: String(channelId) }),
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Presence ping failed:", err);
      }
    };

    // Heartbeat ping immediately on mount
    sendPing();

    // Interval to ping every 5 seconds
    const interval = setInterval(sendPing, 5000);

    return () => clearInterval(interval);
  }, [channelId]);

  return stats;
}
