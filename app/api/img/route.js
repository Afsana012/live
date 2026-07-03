import { isToffeeHost } from "@/lib/urls";

// Cookieless image proxy for Toffee's public artwork (channel logos / posters).
// The browser loads these directly today, which breaks on a deployed domain
// where the asset host rejects non-Toffee Referers (ERR_CONNECTION_CLOSED) and
// also leaks the viewer's IP. Fetching server-side sidesteps both. Logos never
// change, so we cache them hard.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return respond("missing 'u' param", 400);

  let upstream;
  try {
    upstream = new URL(u);
  } catch {
    return respond("invalid 'u' param", 400);
  }

  if (!isToffeeHost(upstream.host)) {
    return respond(`forbidden host: ${upstream.host}`, 403);
  }

  let res;
  try {
    res = await fetch(u, {
      // Logos are public — no signed cookie needed, just a normal image request.
      headers: { accept: "image/*,*/*;q=0.8" },
      cache: "no-store",
    });
  } catch {
    // Don't bother surfacing undici codes for images; a broken logo is cosmetic.
    return respond("image fetch error", 502);
  }

  if (!res.ok) return respond(`upstream responded ${res.status}`, res.status);

  const ct = res.headers.get("content-type") || "image/png";
  return new Response(res.body, {
    headers: {
      "content-type": ct,
      // 24h + immutable: logos are content-addressed, safe to cache forever.
      "cache-control": "public, max-age=86400, immutable",
      "access-control-allow-origin": "*",
    },
  });
}

function respond(message, status) {
  return new Response(message + "\n", {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
