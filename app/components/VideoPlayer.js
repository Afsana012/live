"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONE = {
  muted: "border-border bg-black/60 text-muted-foreground",
  ok: "border-emerald-500/30 bg-emerald-500/20 text-emerald-300",
  warn: "border-amber-500/30 bg-amber-500/20 text-amber-300",
  danger: "border-destructive/40 bg-destructive/20 text-red-300",
};

// Optional ABR cap. By default both local and production use full auto quality.
// Set NEXT_PUBLIC_MAX_BITRATE at build time only if you want to force a ceiling.
// NOTE: NEXT_PUBLIC_* is inlined at BUILD time, so changing it needs a rebuild.
const MAX_BITRATE = Number(process.env.NEXT_PUBLIC_MAX_BITRATE) || Infinity;

export function VideoPlayer({ proxyUrl }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  // Exponential-backoff state for fatal NETWORK_ERROR recovery, so a server
  // hiccup (or a blocked Dokploy egress) doesn't hammer the proxy in a loop.
  const retryRef = useRef({ count: 0, timer: null });
  // Incremented by the watchdog to trigger a full HLS destroy + reinitialize.
  // React re-runs the effect when this changes, creating a fresh HLS instance.
  const [streamKey, setStreamKey] = useState(0);
  const [status, setStatus] = useState({ label: "Connecting…", tone: "muted" });
  const [hudStats, setHudStats] = useState({
    bufferLen: 0,
    resolution: "N/A",
    level: "N/A",
    lastSegMs: 0,
    cfCache: "N/A"
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Native HLS is only strictly required on Apple Safari (iOS/macOS) where
    // MediaSource support is limited. On Chrome/Edge (Windows/Android), Hls.js
    // is highly optimized and enables our watchdog, key retries, and ABR.
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = proxyUrl;
      setStatus({ label: "Playing (Native)", tone: "ok" });
      video.play().catch(() => setStatus({ label: "Tap play to start", tone: "warn" }));
      return;
    }

    // Everything else uses hls.js, loaded through our proxy.
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        // Toffee serves standard (non-LL) HLS. lowLatencyMode:true chases
        // the live edge with a thin buffer — any slow proxied .ts causes a
        // rebuffer loop. Keep it off and rely on a healthy forward buffer.
        lowLatencyMode: false,
        // ── Buffer tuning for continuous live-stream fetching ──
        // 24 s buffer ≈ 4 segments. Gives a larger safety cushion to completely
        // absorb network transit latency spikes over the VPS-to-CDN path (which
        // we measured can occasionally spike up to 1.8 s).
        maxBufferLength: 24,       // stop pre-fetching once 24 s ahead
        maxMaxBufferLength: 40,    // hard cap — prevent runaway memory use
        backBufferLength: 5,       // keep 5 s of played video in RAM (live TV
                                   // doesn't need backward seek)
        // Stay close to live edge without chasing it too tightly
        liveSyncDurationCount: 3,         // ~3 segments behind live edge
        liveMaxLatencyDurationCount: 6,   // catch up if we drift > 6 segs
        // ── Stream Gap/Hole Recovery ──
        maxBufferHole: 0.5,        // skip timeline gaps smaller than 0.5 s
        nudgeOffset: 0.1,          // nudge playhead by 0.1 s when stuck
        nudgeMax: 10,              // retry up to 10 times before failing
        // NOTE: startLevel is intentionally omitted. We cap the level automatically
        // using autoLevelCapping on MANIFEST_PARSED. Setting startLevel:0
        // would make hls.js start downloading the 720p variant, then abort when
        // autoLevelCapping overrides it — that abort triggers a spurious NETWORK_ERROR.
        // Tolerate proxy hiccups instead of dying on the first retry.
        fragLoadingMaxRetry: 8,
        fragLoadingRetryDelay: 500,
        fragLoadingMaxRetryTimeoutMs: 8000,
        manifestLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 1000,
        levelLoadingMaxRetry: 6,
        levelLoadingRetryDelay: 1000,
        // Rolling CDN AES-128 keys can take a moment to propagate to all edge
        // nodes after rotation (~every 90 s for Toffee). Without retries a single
        // momentary 404 on the new key URL is immediately fatal. Four retries
        // with 500 ms spacing cover the typical propagation window.
        keyLoadingMaxRetry: 4,
        keyLoadingRetryDelay: 500,
        keyLoadingMaxRetryTimeoutMs: 8000,
        startFragPrefetch: true, // fetch first segment during manifest parse
        enableSoftwareAES: true, // survives missing WebCrypto/AES edge cases
        liveDurationInfinity: true,
      });
      hlsRef.current = hls;
      retryRef.current.count = 0;

      hls.loadSource(proxyUrl);
      hls.attachMedia(video);
      const WATCHDOG_MS = 20_000; // 20 s ≈ 3× segment duration
      let watchdogTimer = null;
      let lastCurrentTime = -1;

      const kickWatchdog = () => {
        if (watchdogTimer) clearTimeout(watchdogTimer);
        watchdogTimer = setTimeout(() => {
          const currentTime = video.currentTime;

          // If the playhead has advanced, the stream is healthy.
          if (currentTime !== lastCurrentTime) {
            lastCurrentTime = currentTime;
            kickWatchdog();
            return;
          }

          // Playhead has not moved for 20 seconds. Check if the user paused
          // intentionally. If the browser has healthy buffer ahead of the playhead,
          // it is an intentional pause (or loading is complete). Do not reload.
          let hasBuffer = false;
          const buffered = video.buffered;
          for (let i = 0; i < buffered.length; i++) {
            if (currentTime >= buffered.start(i) && currentTime < buffered.end(i)) {
              // If we have at least 1.0 s of buffered video ahead, it's a normal pause
              if (buffered.end(i) - currentTime > 1.0) {
                hasBuffer = true;
                break;
              }
            }
          }

          if (hasBuffer) {
            kickWatchdog();
            return;
          }

          // Stuck with empty buffer — reload!
          setStatus({ label: "Reconnecting…", tone: "warn" });
          setStreamKey((k) => k + 1);
        }, WATCHDOG_MS);
      };

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Cap auto ABR only when NEXT_PUBLIC_MAX_BITRATE is set. With the default
        // Infinity cap, hls.js can choose the best available level in production too.
        let cap = 0;
        let capBitrate = -1;
        for (let i = 0; i < hls.levels.length; i++) {
          const br = hls.levels[i].bitrate || 0;
          if (br <= MAX_BITRATE && br > capBitrate) {
            capBitrate = br;
            cap = i;
          }
        }
        hls.autoLevelCapping = cap;
        hls.currentLevel = -1; // enable auto-ABR up to capped level

        retryRef.current.count = 0; // stream is healthy — reset backoff
        setStatus({ label: "Playing", tone: "ok" });
        video.play().catch(() => setStatus({ label: "Tap play to start", tone: "warn" }));
        kickWatchdog(); // arm watchdog — first segment load will reset it
      });

      // Periodically update the HUD buffer stats (every 500 ms)
      const hudInterval = setInterval(() => {
        let bufferLen = 0;
        const time = video.currentTime;
        const buffered = video.buffered;
        for (let i = 0; i < buffered.length; i++) {
          if (time >= buffered.start(i) && time < buffered.end(i)) {
            bufferLen = buffered.end(i) - time;
            break;
          }
        }
        
        // Fetch current resolution and level
        let resolution = "N/A";
        let levelName = "Auto (Adaptive)";
        if (hls.currentLevel !== -1 && hls.levels[hls.currentLevel]) {
          const lvl = hls.levels[hls.currentLevel];
          resolution = lvl.attrs.RESOLUTION || `${lvl.width}x${lvl.height}`;
          levelName = `${hls.currentLevel} (${resolution})`;
        } else if (hls.loadLevel !== -1 && hls.levels[hls.loadLevel]) {
          // ABR is choosing the level
          const lvl = hls.levels[hls.loadLevel];
          resolution = lvl.attrs.RESOLUTION || `${lvl.width}x${lvl.height}`;
          levelName = `Auto (${resolution})`;
        }

        setHudStats((prev) => ({
          ...prev,
          bufferLen: parseFloat(bufferLen.toFixed(1)),
          resolution,
          level: levelName,
        }));
      }, 500);

      // Any segment OR key loaded = connection is alive — reset retry counters.
      hls.on(Hls.Events.FRAG_LOADED, (_, data) => {
        kickWatchdog(); // reset the 20-s stall timer
        retryRef.current.count = 0;
        retryRef.current.mediaRecoveries = 0;

        // Extract latency and CDN caching status from load stats.
        // Hls.js v1.0+ stores stats in data.frag.stats.
        const stats = data.stats || data.frag?.stats;
        const latency = stats?.loading?.end 
          ? Math.round(stats.loading.end - stats.loading.start) 
          : 0;
        
        // Extract Cloudflare header from HTTP response if available
        let cfCache = "DYNAMIC (origin)";
        const details = data.networkDetails;
        if (details instanceof XMLHttpRequest) {
          const cf = details.getResponseHeader("cf-cache-status");
          if (cf) cfCache = cf.toUpperCase();
        } else if (details && details.response && typeof details.response.headers === "object") {
          // Fetch API response fallback
          const cf = details.response.headers.get?.("cf-cache-status");
          if (cf) cfCache = cf.toUpperCase();
        }

        setHudStats((prev) => ({
          ...prev,
          lastSegMs: latency,
          cfCache,
        }));
      });

      hls.on(Hls.Events.KEY_LOADED, () => {
        kickWatchdog(); // key rotation succeeded — fresh budget for next rotation
        retryRef.current.count = 0;
        retryRef.current.mediaRecoveries = 0;
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR: {
            const st = retryRef.current;
            if (st.count >= 5) {
              setStatus({ label: "Stream unavailable", tone: "danger" });
              toast.error("Stream unavailable", {
                description:
                  "The server may be blocked, or the stream cookie expired.",
              });
              hls.destroy();
              break;
            }
            const delay = Math.min(30000, 1000 * 2 ** st.count); // 1,2,4,8,16s
            setStatus({
              label: `Reconnecting in ${Math.round(delay / 1000)}s…`,
              tone: "warn",
            });
            toast.error("Network error", {
              description: `Reconnecting in ${Math.round(delay / 1000)}s…`,
            });
            st.timer = setTimeout(() => {
              st.count += 1;
              // Restart from live edge (-1), not the stale buffered position.
              hls.startLoad(-1);
            }, delay);
            break;
          }
          case Hls.ErrorTypes.MEDIA_ERROR: {
            const mst = retryRef.current;
            mst.mediaRecoveries = (mst.mediaRecoveries || 0) + 1;
            setStatus({ label: "Media error — recovering…", tone: "warn" });
            if (mst.mediaRecoveries <= 1) {
              hls.recoverMediaError();
            } else {
              // Second attempt: swap codec hint then recover (hls.js best practice)
              hls.swapAudioCodec();
              hls.recoverMediaError();
            }
            break;
          }
          default:
            setStatus({ label: "Stream unavailable", tone: "danger" });
            toast.error("Stream unavailable", {
              description: "The stream cookie may have expired. Update the channel data.",
            });
            hls.destroy();
            break;
        }
      });

      return () => {
        clearInterval(hudInterval);
        if (watchdogTimer) clearTimeout(watchdogTimer);
        if (retryRef.current.timer) clearTimeout(retryRef.current.timer);
        hls.destroy();
      };
    }

    setStatus({ label: "HLS not supported in this browser", tone: "danger" });
    return undefined;
  }, [proxyUrl, streamKey]);

  return (
    <div className="relative w-full">
      <div className="relative aspect-video w-full bg-black">
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          className="block size-full bg-black"
        />
        <Badge
          variant="outline"
          className={cn(
            "pointer-events-none absolute bottom-3 left-3 gap-1.5 border backdrop-blur",
            TONE[status.tone]
          )}
        >
          {status.tone === "ok" ? (
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
          ) : null}
          {status.label}
        </Badge>

        {/* Real-time Diagnostics HUD */}
        <div className="hidden sm:block absolute right-3 top-3 select-none rounded-lg border border-white/10 bg-black/75 px-3 py-2 text-[10px] font-mono text-zinc-300 backdrop-blur-md">
          <div className="font-bold text-white mb-1 border-b border-white/10 pb-1">⚡ DIAGNOSTICS HUD</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span className="text-zinc-500">Buffer:</span>
            <span className={cn(hudStats.bufferLen < 6 ? "text-amber-400 font-bold" : "text-emerald-400")}>
              {hudStats.bufferLen}s
            </span>
            <span className="text-zinc-500">Level:</span>
            <span className="text-white">{hudStats.level}</span>
            <span className="text-zinc-500">Fetch Latency:</span>
            <span className={cn(hudStats.lastSegMs > 1200 ? "text-amber-400 font-bold" : "text-zinc-300")}>
              {hudStats.lastSegMs ? `${hudStats.lastSegMs}ms` : "N/A"}
            </span>
            <span className="text-zinc-500">CF-Cache:</span>
            <span className="text-zinc-400">{hudStats.cfCache}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
