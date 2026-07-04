// In-memory store that survives Next.js hot-reloads in development mode
const PRESENCE_STORE_KEY = Symbol.for("nova.tv.presence.store");
if (!global[PRESENCE_STORE_KEY]) {
  global[PRESENCE_STORE_KEY] = new Map();
}

const store = global[PRESENCE_STORE_KEY];
const SESSION_TTL_MS = 15000; // 15 seconds expiry

/** Prune inactive users from the active session map. */
function sweep() {
  const now = Date.now();
  for (const [sessionId, session] of store.entries()) {
    if (now - session.lastSeen > SESSION_TTL_MS) {
      store.delete(sessionId);
    }
  }
}

// Periodically run sweeps in the background
if (!global._presence_sweeper) {
  global._presence_sweeper = setInterval(sweep, 10000);
}

/** Record a heartbeat ping for a session at a specific page location. */
export function pingPresence(sessionId, channelId) {
  sweep();
  store.set(sessionId, {
    channelId: String(channelId),
    lastSeen: Date.now(),
  });
}

/** Retrieve total active visitors and per-channel active viewer counts. */
export function getPresenceStats() {
  sweep();
  const stats = {
    total: store.size,
    channels: {},
  };

  for (const session of store.values()) {
    const cid = session.channelId;
    if (cid !== "home") {
      stats.channels[cid] = (stats.channels[cid] || 0) + 1;
    }
  }

  return stats;
}
