// Pure URL helpers shared by server routes AND client components.
// IMPORTANT: this module must NOT import "node:fs" / "node:path" or anything
// server-only — it is imported by client components (ChannelCard), so a
// server-only import here would drag the Node polyfill into the browser bundle.

/**
 * Is `host` Toffee-owned? Exact apex or any subdomain of toffeelive.com.
 * Strict enough to reject lookalikes like "eviltoffeelive.com" while still
 * admitting every real CDN/asset subdomain (bldcmprod-cdn, images,
 * assets-prod.services, …). `URL` already lowercases host, but we normalize
 * defensively in case a raw string is passed.
 */
export function isToffeeHost(host) {
  if (!host) return false;
  const h = host.toLowerCase();
  return h === "toffeelive.com" || h.endsWith(".toffeelive.com");
}

/**
 * Route a Toffee image/logo through our server-side image proxy so the browser
 * never talks to Toffee directly (avoids Referer/hotlink blocks and leaks of
 * the viewer IP). Non-Toffee URLs (e.g. encrypted-tbn0.gstatic.com) are passed
 * through untouched — we only proxy hosts on our allowlist.
 */
export function imgProxy(url) {
  if (!url) return url;
  let host;
  try {
    host = new URL(url).host;
  } catch {
    return url;
  }
  if (!isToffeeHost(host)) return url;
  return "/api/img?u=" + encodeURIComponent(url);
}
