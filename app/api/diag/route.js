import * as dns from "node:dns/promises";
import { getChannels, getHeadersFor, describeFetchError } from "@/lib/channels";
import { upstreamFetch } from "@/lib/upstream";

// Server-side reachability probe. Helps diagnose why /api/proxy returns 502 on
// a given host (local vs Dokploy): is it DNS, TLS, a blocked/reset connection,
// or simply an expired cookie? Output is JSON you can read in the browser.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The CDN host that serves the playlists, and the asset host that serves the
// poster logos — both worth probing because they can be blocked independently.
const PLAYLIST_HOST = "bldcmprod-cdn.toffeelive.com";
const POSTER_HOST = "assets-prod.services.toffeelive.com";

export async function GET(req) {
  // Gate the endpoint: disabled entirely unless DIAG_TOKEN is set, and the
  // caller must supply a matching ?token=. Keeps upstream topology + cookie
  // presence out of the open in production.
  const token = process.env.DIAG_TOKEN;
  if (!token) return json({ enabled: false }, 404);
  const provided = req.nextUrl.searchParams.get("token");
  if (provided !== token) return json({ error: "forbidden" }, 403);

  const out = {
    time: new Date().toISOString(),
    node: process.version,
    dns: {},
    playlist: {},
    poster: {},
  };

  // (a) DNS resolution for both hosts. We use dns.lookup (getaddrinfo) — the
  // SAME resolution path the real fetch() uses at connect time — so the DNS
  // probe agrees with the fetch probe. (dns.resolve4 talks to a configured
  // resolver directly and can disagree with getaddrinfo, e.g. on VPNs/containers.)
  for (const host of [PLAYLIST_HOST, POSTER_HOST]) {
    try {
      const entries = await dns.lookup(host, { all: true });
      out.dns[host] = { ok: true, addrs: entries.map((e) => e.address) };
    } catch (e) {
      out.dns[host] = { ok: false, code: e.code, message: e.message };
    }
  }

  // (a.2) For the playlist host, also probe with explicit public resolvers. This
  // distinguishes "the container's default resolver is broken for this name"
  // (public resolver succeeds -> infra DNS fix) from "the name genuinely does
  // not resolve from here" (public resolver also fails -> geo/authoritative
  // block -> needs IP pinning or a BD egress).
  out.dnsMultiResolver = await probeDns(PLAYLIST_HOST);

  // (b) A real playlist fetch WITH the signed cookie (same path the proxy uses).
  const ch = getChannels().find((c) => c.link && c.link.includes(PLAYLIST_HOST));
  if (!ch) {
    out.playlist = { skipped: "no channel on " + PLAYLIST_HOST };
  } else {
    const h = getHeadersFor(ch.link) || {};
    try {
      const r = await fetch(ch.link, {
        headers: {
          "user-agent": h["user-agent"] || "okhttp/4.11.0",
          cookie: h.cookie || "",
          accept: "*/*",
          "accept-encoding": "identity",
        },
        cache: "no-store",
      });
      out.playlist = {
        ok: r.ok,
        status: r.status,
        ct: r.headers.get("content-type"),
        url: ch.link,
      };
    } catch (e) {
      const { code, message } = describeFetchError(e);
      out.playlist = { ok: false, code, message, url: ch.link };
    }
  }

  // (c) A poster fetch WITHOUT a cookie (logos are public). Tells us whether
  // /api/img can serve logos server-side from this host.
  const logoCh = getChannels().find((c) => c.logo && c.logo.includes(POSTER_HOST));
  if (!logoCh) {
    out.poster = { skipped: "no channel logo on " + POSTER_HOST };
  } else {
    try {
      const r = await fetch(logoCh.logo, { cache: "no-store" });
      out.poster = {
        ok: r.ok,
        status: r.status,
        ct: r.headers.get("content-type"),
        url: logoCh.logo,
      };
    } catch (e) {
      const { code, message } = describeFetchError(e);
      out.poster = { ok: false, code, message, url: logoCh.logo };
    }
  }

  // (d) Pinned-IP probe: if CDN_PIN_IP is set, try fetching the playlist by
  // connecting straight to that IP (bypassing the geo-DNS that NODATAs the
  // hostname abroad). A 200 here means IP-pinning is the fix — no BD proxy
  // needed. Absent/unset -> skipped.
  if (!process.env.CDN_PIN_IP) {
    out.pinnedIp = { skipped: "CDN_PIN_IP not set" };
  } else if (!ch) {
    out.pinnedIp = { skipped: "no channel to test" };
  } else {
    const h = getHeadersFor(ch.link) || {};
    try {
      const r = await upstreamFetch(ch.link, {
        headers: {
          "user-agent": h["user-agent"] || "okhttp/4.11.0",
          cookie: h.cookie || "",
          accept: "*/*",
          "accept-encoding": "identity",
        },
        cache: "no-store",
      });
      out.pinnedIp = {
        ok: r.ok,
        status: r.status,
        ct: r.headers.get("content-type"),
        pin: process.env.CDN_PIN_IP,
      };
    } catch (e) {
      const { code, message } = describeFetchError(e);
      out.pinnedIp = { ok: false, code, message, pin: process.env.CDN_PIN_IP };
    }
  }

  return json(out);
}

/** Try resolving `host` through several resolvers and report each outcome. */
async function probeDns(host) {
  const attempts = {
    "default(getaddrinfo)": () =>
      dns.lookup(host, { all: true }).then((es) => es.map((e) => e.address)),
    "default(c-ares)": () => dns.resolve4(host),
    "8.8.8.8(Google)": async () => {
      const r = new dns.Resolver();
      r.setServers(["8.8.8.8"]);
      return r.resolve4(host);
    },
    "1.1.1.1(Cloudflare)": async () => {
      const r = new dns.Resolver();
      r.setServers(["1.1.1.1"]);
      return r.resolve4(host);
    },
  };
  const out = {};
  for (const [name, fn] of Object.entries(attempts)) {
    try {
      out[name] = { ok: true, addrs: await fn() };
    } catch (e) {
      out[name] = { ok: false, code: e.code, message: e.message };
    }
  }
  return out;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
