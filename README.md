# 📺 Nova TV

A local Next.js app for watching Toffee's live-TV streams in your browser. Browsers
can't attach the signed CDN cookies themselves, so a small server-side **proxy**
fetches the stream with the right cookie + user-agent headers and rewrites the HLS
playlist to flow back through itself.

The UI is built with [shadcn/ui](https://ui.shadcn.com) on Tailwind v4 — dark,
modern, and built to feel like a real live-TV site.

---

## First-time setup

Make sure **Node.js 18+** is installed.

```bash
cd toffee-player
npm install      # one-time, pulls dependencies
npm run dev      # starts the dev server
```

Then open **http://localhost:3000** in your browser and click a channel to start watching.

---

## 🔄 When the cookie expires (important)

Toffee's stream cookie expires every few days. When it does, channels stop playing.
To get them running again:

1. Download a fresh **`toffee_channel_data.json`** from your source.
2. Replace this file with it:
   ```
   toffee-player/data/toffee_channel_data.json
   ```
3. Reload the page in your browser. **No server restart needed** — while
   `npm run dev` is running, the new data is picked up automatically.

The cookie status pill in the top bar shows whether the cookie is active, expiring
soon, or expired — so you know ahead of time.

---

## How it works

```
Browser (hls.js)
   │  /api/proxy?u=<encoded m3u8 url>
   ▼
Next.js proxy (server)  ← adds cookie + user-agent headers
   │
   ▼
Toffee CDN  →  channel m3u8 / .ts segments
```

The proxy rewrites every URL inside the playlist to route back through itself, so the
entire stream is served with the correct headers.

---

## Folder structure

| File | Purpose |
|------|---------|
| `data/toffee_channel_data.json` | **The only file you change** (on cookie refresh) |
| `lib/channels.js` | Reads the JSON, normalizes categories to English, matches host → headers |
| `app/api/proxy/route.js` | HLS proxy (fetches from the CDN with headers) |
| `app/page.js` | Channel list page (hero + category tabs + grid) |
| `app/channel/[id]/page.js` | Player page |
| `app/components/VideoPlayer.js` | hls.js player with status overlay + error toasts |
| `app/components/ChannelGrid.js`, `ChannelCard.js` | Browse UI |
| `components/ui/*` | shadcn/ui primitives |

---

## Troubleshooting

- **A channel won't play?** Check the cookie status pill in the header first.
- **No channels play?** Drop in a fresh JSON.
- **Some play, some don't?** Could be a proxy host allowlist or cookie host
  mismatch — check the server logs in the terminal.
- **`port 3000` busy?** Run it on another port: `npm run dev -- -p 3001`.

> For personal / local use only. Do not host publicly or rebroadcast.
