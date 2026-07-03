import fs from "node:fs";
import path from "node:path";

const DATA_FILE = path.join(process.cwd(), "data", "toffee_channel_data.json");

/**
 * Extract the real error code from a fetch failure. undici wraps the underlying
 * network/TLS error in a `TypeError("fetch failed")` whose `.cause` (sometimes
 * nested twice) carries the actionable `.code` — e.g. ENOTFOUND (DNS),
 * ECONNRESET / UND_ERR_CONNECT_TIMEOUT (blocked/geo), UNABLE_TO_VERIFY_LEAF_SIGNATURE
 * / CERT_HAS_EXPIRED (TLS). Walk the chain so callers get the truth, not "fetch failed".
 */
export function describeFetchError(e) {
  let code = null;
  let cur = e;
  for (let i = 0; cur && i < 5; i++) {
    if (cur.code) {
      code = cur.code;
      break;
    }
    cur = cur.cause;
  }
  return { code, message: (e && e.message) || String(e) };
}

// In production we cache the parsed file; in dev we re-read every call so the user
// can drop in a freshly-downloaded JSON (new cookie) without restarting the server.
let _cache = null;

function load() {
  if (process.env.NODE_ENV === "production" && _cache) return _cache;
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  const data = JSON.parse(raw);
  if (process.env.NODE_ENV === "production") _cache = data;
  return data;
}

/** All channels as-is from the JSON. */
export function getChannels() {
  return load().channels || [];
}

/** Channel by array index (used as the URL id). */
export function getChannel(id) {
  const channels = getChannels();
  const idx = Number(id);
  if (Number.isNaN(idx) || idx < 0 || idx >= channels.length) return null;
  return channels[idx];
}

/** Top-level metadata from the JSON (name, updated_on, channels_amount). */
export function getMeta() {
  const d = load();
  return {
    name: d.name || "Toffee",
    updatedOn: d.updated_on || "",
    amount: d.channels_amount ?? getChannels().length,
  };
}

/**
 * Find the correct headers (cookie + user-agent) for an upstream URL by matching
 * its host to a channel on that host. Toffee uses different CDN hosts, each with
 * its own signed cookie, so we must look up per host.
 */
export function getHeadersFor(upstreamUrl) {
  let host;
  try {
    host = new URL(upstreamUrl).host;
  } catch {
    return null;
  }
  const match = getChannels().find((c) => {
    try {
      return new URL(c.link).host === host;
    } catch {
      return false;
    }
  });
  return (match && match.headers) || null;
}

/** Cookie expiry as JS epoch ms (parsed from Expires=<unix> in any channel cookie). */
export function getExpiryMs() {
  const ch = getChannels()[0];
  if (!ch || !ch.headers || !ch.headers.cookie) return null;
  const m = ch.headers.cookie.match(/Expires=(\d+)/);
  return m ? Number(m[1]) * 1000 : null;
}

// ---------------------------------------------------------------------------
// Category normalization
//
// The data file mixes languages and naming ("Sports Channels", "News Channel",
// "বাংলাদেশী চ্যানেল", …). We map every raw category to a clean English label,
// a URL-safe slug, and a lucide icon name (string) for the client to render.
// The data file itself is never edited — it is user-refreshed.
// ---------------------------------------------------------------------------

const CATEGORY_MAP = {
  "sports channels": { label: "Sports", slug: "sports", icon: "Trophy" },
  "বাংলাদেশী চ্যানেল": { label: "Bangladesh", slug: "bangladesh", icon: "Flag" },
  "entertainment channels": {
    label: "Entertainment",
    slug: "entertainment",
    icon: "Sparkles",
  },
  "movie channels": { label: "Movies", slug: "movies", icon: "Clapperboard" },
  infotainment: { label: "Infotainment", slug: "infotainment", icon: "Globe" },
  "news channel": { label: "News", slug: "news", icon: "Newspaper" },
  kids: { label: "Kids", slug: "kids", icon: "Baby" },
  live: { label: "Live", slug: "live", icon: "Radio" },
};

function slugify(s) {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "other"
  );
}

function titleCase(s) {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Normalize a raw category_name into { label, slug, icon }.
 * Unknown categories fall back to a title-cased version of the raw name.
 */
export function normalizeCategory(rawName) {
  const raw = (rawName || "").trim();
  const hit = CATEGORY_MAP[raw.toLowerCase()];
  if (hit) return { ...hit };
  const label = titleCase(raw) || "Other";
  return { label, slug: slugify(label), icon: "Tv" };
}

/**
 * Ordered list of categories with channel counts (first-seen order preserved).
 * Each entry: { slug, label, icon, count }.
 */
export function getCategories() {
  const order = [];
  const map = new Map();
  for (const c of getChannels()) {
    const cat = normalizeCategory(c.category_name);
    if (!map.has(cat.slug)) {
      map.set(cat.slug, { ...cat, count: 0 });
      order.push(cat.slug);
    }
    map.get(cat.slug).count += 1;
  }
  return order.map((slug) => map.get(slug));
}
