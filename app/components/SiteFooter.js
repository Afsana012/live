import { Tv } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="hidden sm:block border-t border-border bg-background/60">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="grid size-6 place-items-center rounded-lg bg-primary/10 text-primary">
              <Tv className="size-3.5" />
            </span>
            <span className="font-semibold text-foreground">
              Nova<span className="text-primary">TV</span>
            </span>
            <span className="text-muted-foreground/60">•</span>
            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">v1.0.0</span>
          </div>

          <p className="text-xs text-muted-foreground/60 text-center sm:text-right">
            For personal use only. Do not host publicly or rebroadcast.
          </p>
        </div>
      </div>
    </footer>
  );
}
