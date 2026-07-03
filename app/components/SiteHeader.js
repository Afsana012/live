import Link from "next/link";
import { Tv } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Map the parsed cookie-expiry epoch (ms) to a status pill { dot, pulse, label }.
 * Server-rendered, so "now" is request time — fine for this local app.
 */
function cookieStatus(ms) {
  if (!ms) return { dot: "bg-amber-400", pulse: true, label: "No expiry date" };
  const days = (ms - Date.now()) / 86400000;
  if (days < 0) return { dot: "bg-red-500", pulse: true, label: "Cookie expired" };
  if (days < 1) return { dot: "bg-red-500", pulse: true, label: "Expires today" };
  if (days < 3) {
    const d = Math.max(1, Math.floor(days));
    return { dot: "bg-amber-400", pulse: true, label: `Expires in ${d} day${d === 1 ? "" : "s"}` };
  }
  return { dot: "bg-emerald-400", pulse: false, label: "Cookie active" };
}

export function SiteHeader({ expiryMs }) {
  const status = cookieStatus(expiryMs);

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

        <div
          className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium"
          title={`Stream cookie status: ${status.label}`}
        >
          <span className={cn("size-2 rounded-full", status.dot, status.pulse && "animate-pulse")} />
          <span className="text-muted-foreground">{status.label}</span>
        </div>
      </div>
    </header>
  );
}
