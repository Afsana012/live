"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { imgProxy } from "@/lib/urls";

export function ChannelCard({ channel, viewerCount = 0, isFavorite = false, onToggleFavorite }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <Link
      href={`/channel/${channel.id}`}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background animate-fadeInUp"
      aria-label={`Watch ${channel.name}`}
    >
      <Card className="gap-0 overflow-hidden p-0 transition-all duration-200 group-hover:-translate-y-1 group-hover:border-primary/60 group-hover:shadow-xl group-hover:shadow-primary/10">
        <div className="relative aspect-[4/3] overflow-hidden bg-linear-to-br from-muted/70 to-card">
          {channel.logo ? (
            <img
              src={imgProxy(channel.logo)}
              alt=""
              loading="lazy"
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
              className={cn(
                "absolute inset-0 size-full object-contain p-5 transition-opacity duration-300",
                loaded ? "opacity-100" : "opacity-0"
              )}
            />
          ) : null}

          {!loaded && <div className="absolute inset-0 skeleton-shimmer" />}

          <Badge
            variant="destructive"
            className="absolute left-2 top-2 gap-1 px-1.5 shadow-sm"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            LIVE
          </Badge>

          {/* Favorite heart toggle */}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(channel.id);
              }}
              className={cn(
                "absolute right-2 top-2 grid size-7 place-items-center rounded-full transition-all duration-200",
                "bg-black/40 backdrop-blur-sm hover:bg-black/60 hover:scale-110",
                isFavorite ? "text-red-400" : "text-white/60 hover:text-white"
              )}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart
                className={cn("size-3.5 transition-all", isFavorite && "fill-red-400")}
              />
            </button>
          )}
        </div>

        <div className="border-t border-border/60 p-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{channel.name}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {channel.category.label}
            </div>
          </div>
          {viewerCount > 0 && (
            <div 
              className="shrink-0 flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 font-mono"
              title={`${viewerCount} active viewer(s)`}
            >
              <span className="size-1 bg-emerald-400 animate-pulse rounded-full" />
              {viewerCount}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
