"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { imgProxy } from "@/lib/urls";

export function ChannelCard({ channel }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <Link
      href={`/channel/${channel.id}`}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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

          {!loaded && <div className="absolute inset-0 animate-pulse bg-muted" />}

          <Badge
            variant="destructive"
            className="absolute left-2 top-2 gap-1 px-1.5 shadow-sm"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            LIVE
          </Badge>
        </div>

        <div className="border-t border-border/60 p-3">
          <div className="truncate text-sm font-semibold">{channel.name}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {channel.category.label}
          </div>
        </div>
      </Card>
    </Link>
  );
}
