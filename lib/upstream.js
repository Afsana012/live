import https from "node:https";

// The video CDN host. Toffee's authoritative DNS returns NODATA (no A records)
// for this name outside Bangladesh (geo-DNS), so a VPS abroad can't resolve it —
// but the CDN itself serves any IP once connected. When CDN_PIN_IP is set we
// bypass DNS for THIS host and connect straight to the IP, keeping the hostname
// for TLS SNI + the Host header so the cert and the signed cookie still validate.
const CDN_HOST = "bldcmprod-cdn.toffeelive.com";
const MAX_REDIRECTS = 5;
// Abort an upstream fetch that goes silent for this long, so a hung connection
// can never linger. Live TV HLS needs fast delivery: if a segment takes >4 s,
// we fail-fast so the browser player immediately retries on a fresh socket.
const UPSTREAM_TIMEOUT_MS = 4000;

// Reuse TCP+TLS connections across playlist + segment fetches. Node's default
// https agent has keepAlive:false, so every request opens (then tears down) a
// fresh handshake — under sustained live-HLS polling that churns sockets into
// TIME_WAIT until the server runs out of ephemeral ports, which surfaces as
// "plays a while, then freezes" / "some channels stop fetching". Keep-alive
// pools connections to the pinned IP and eliminates that churn.
const agent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 32,
  maxFreeSockets: 8,
  timeout: UPSTREAM_TIMEOUT_MS,
});

/**
 * fetch() for upstream Toffee requests. When CDN_PIN_IP is unset this is
 * byte-identical to the global fetch. When set, requests for the CDN host are
 * issued via node:https directly to the pinned IP (no undici, so no version
 * skew with Node's bundled fetch). Returns a real web Response — same shape the
 * proxy already consumes (.ok/.status/.headers.get/.text/.body).
 */
export async function upstreamFetch(url, init = {}) {
  // Always use pinnedRequest to leverage the keep-alive connection pool
  return pinnedRequest(url, init, 0);
}

function pinnedRequest(url, init, redirects) {
  const pin = process.env.CDN_PIN_IP;
  const u = new URL(url);
  const pinned = pin && u.hostname === CDN_HOST;

  const headers = toHeaderRecord(init.headers);
  const options = {
    method: (init.method || "GET").toUpperCase(),
    path: u.pathname + u.search,
    agent, // keep-alive pooling
    headers,
  };
  if (pinned) {
    options.hostname = pin; // TCP connect to the pinned IPv4
    options.port = u.port || 443;
    options.servername = u.hostname; // TLS SNI + certificate check on the hostname
    headers.host = u.hostname; // HTTP Host header (CDN keys the signed cookie on this)
  } else {
    options.hostname = u.hostname;
    options.port = u.port || 443;
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      // Follow redirects the way fetch would (signed CDN URLs rarely redirect,
      // but match the behaviour just in case).
      if (
        redirects < MAX_REDIRECTS &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        res.resume();
        resolve(pinnedRequest(new URL(res.headers.location, u).toString(), init, redirects + 1));
        return;
      }
      // Buffer the entire response body before resolving. Streaming via
      // Readable.toWeb() can silently truncate segments on socket resets,
      // producing incomplete .ts chunks that stall the HLS decoder. Toffee
      // segments are ≤1 MB so buffering is cheap and guarantees delivery.
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        const responseHeaders = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (v != null) responseHeaders.set(k, Array.isArray(v) ? v.join(", ") : String(v));
        }
        resolve(
          new Response(body, {
            status: res.statusCode || 502,
            statusText: res.statusText,
            headers: responseHeaders,
          }),
        );
      });
      res.on("error", reject);
    });
    // Fail fast on a silent upstream instead of holding the socket forever.
    req.setTimeout(UPSTREAM_TIMEOUT_MS, () => req.destroy(new Error("upstream timeout")));
    req.on("error", reject);
    req.end();
  });
}

function toHeaderRecord(h) {
  if (!h) return {};
  if (h instanceof Headers) return Object.fromEntries(h.entries());
  if (Array.isArray(h)) return Object.fromEntries(h);
  return { ...h };
}
