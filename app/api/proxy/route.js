import { getHeadersFor, describeFetchError } from "@/lib/channels";
import { isToffeeHost } from "@/lib/urls";
import { upstreamFetch } from "@/lib/upstream";

// The proxy runs on the Node.js runtime (server-side) so we can attach the
// signed cookie + user-agent that browsers are forbidden from setting, and we
// sidestep the CDN's cross-origin (CORS) restrictions.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return respond("missing 'u' param", 400);

  let upstream;
  try {
    upstream = new URL(u);
  } catch {
    return respond("invalid 'u' param", 400);
  }

  // Safety: only ever proxy to Toffee's CDN hosts (exact apex or a real
  // subdomain — rejects lookalikes like "eviltoffeelive.com").
  if (!isToffeeHost(upstream.host)) {
    return respond(`forbidden host: ${upstream.host}`, 403);
  }

  const headers = getHeadersFor(u);
  if (!headers) return respond(`no headers known for host ${upstream.host}`, 404);

  let upstreamRes;
  try {
    upstreamRes = await upstreamFetch(u, {
      headers: {
        "user-agent": headers["user-agent"] || "okhttp/4.11.0",
        cookie: headers.cookie || "",
        accept: "*/*",
        // Ask for uncompressed so we can parse/rewrite playlist text.
        "accept-encoding": "identity",
      },
      // Bypass Next's fetch caching for the upstream.
      cache: "no-store",
    });
  } catch (e) {
    // The fetch threw — almost always a network/TLS/DNS failure to the CDN.
    // Surface the real undici cause code (ECONNRESET, ENOTFOUND, …) so the
    // 502 body and the server logs actually say WHY it failed.
    const { code, message } = describeFetchError(e);
    console.error("[proxy] upstream fetch failed", { url: u, code, message });
    return respond(
      `upstream fetch error: ${message}${code ? ` (code=${code})` : ""}`,
      502,
    );
  }

  if (!upstreamRes.ok) {
    return respond(`upstream responded ${upstreamRes.status}`, upstreamRes.status);
  }

  const ct = upstreamRes.headers.get("content-type") || "";
  const isPlaylist =
    /\.m3u8($|\?)/i.test(upstream.pathname) || ct.includes("mpegurl");

  if (isPlaylist) {
    const text = await upstreamRes.text();
    const rewritten = rewritePlaylist(text, upstream);
    return new Response(rewritten, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
    });
  }

  // Media segment / key / init: deliver the fully-buffered body so no bytes
  // are lost to stream truncation mid-transfer.
  const buffer = await upstreamRes.arrayBuffer();
  return new Response(buffer, {
    headers: {
      "content-type": ct || "video/mp2t",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  });
}

/**
 * Rewrite every URL inside an HLS playlist so the player fetches each piece back
 * through this proxy (with the right headers). Handles both bare URL lines and
 * URI="..." attributes inside tags such as #EXT-X-KEY / #EXT-X-MAP.
 */
function rewritePlaylist(text, base) {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_, p1) => {
          const abs = resolve(base, p1);
          return `URI="${proxyOf(abs)}"`;
        });
      }
      return proxyOf(resolve(base, trimmed));
    })
    .join("\n");
}

function resolve(base, rel) {
  try {
    return new URL(rel, base).toString();
  } catch {
    return rel;
  }
}

function proxyOf(absUrl) {
  return "/api/proxy?u=" + encodeURIComponent(absUrl);
}

function respond(message, status) {
  return new Response(message + "\n", {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
