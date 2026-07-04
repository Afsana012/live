"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Tv } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Map the parsed cookie-expiry epoch (ms) to a status pill { dot, pulse, label } with countdown.
 */
function getCountdown(ms) {
  if (!ms) return { dot: "bg-amber-400", pulse: true, label: "No expiry date" };
  
  const diff = ms - Date.now();
  if (diff <= 0) {
    return { dot: "bg-red-500", pulse: true, label: "Cookie expired" };
  }

  const totalSecs = Math.floor(diff / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  const label = `Expires in ${parts.join(" ")}`;

  const remainingDays = diff / 86400000;
  let dot = "bg-emerald-400";
  let pulse = false;
  
  if (remainingDays < 1) {
    dot = "bg-red-500";
    pulse = true;
  } else if (remainingDays < 3) {
    dot = "bg-amber-400";
    pulse = true;
  }

  return { dot, pulse, label };
}

export function SiteHeader({ expiryMs }) {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState({ dot: "bg-zinc-600", pulse: false, label: "Checking..." });
  const [onlineCount, setOnlineCount] = useState(1);

  useEffect(() => {
    setMounted(true);
    setStatus(getCountdown(expiryMs));

    if (!expiryMs) return;

    const interval = setInterval(() => {
      setStatus(getCountdown(expiryMs));
    }, 1000);

    return () => clearInterval(interval);
  }, [expiryMs]);

  useEffect(() => {
    if (!mounted) return;

    const fetchOnlineCount = async () => {
      try {
        const res = await fetch("/api/presence");
        if (res.ok) {
          const data = await res.json();
          setOnlineCount(data.total || 1);
        }
      } catch {}
    };

    fetchOnlineCount();
    const interval = setInterval(fetchOnlineCount, 8000);
    return () => clearInterval(interval);
  }, [mounted]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Nova TV home">
          <span className="grid size-9 place-items-center rounded-xl bg-primary bg-linear-to-br from-primary to-emerald-400 text-primary-foreground shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
            <Tv className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Nova<span className="text-primary"> TV</span>
          </span>
        </Link>

        {mounted && (
          <div className="flex items-center gap-2">
            {/* Active Users Counter */}
            <div 
              className="flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground"
              title={`${onlineCount} active user(s) on the site`}
            >
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono">{onlineCount}</span> online
            </div>

            {/* Cookie Expiration Status */}
            <div
              className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium transition-all"
              title={`Stream cookie status: ${status.label}`}
            >
              <span className={cn("size-2 rounded-full", status.dot, status.pulse && "animate-pulse")} />
              <span className="text-muted-foreground font-mono">{status.label}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
