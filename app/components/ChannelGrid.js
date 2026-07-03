"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Trophy,
  Flag,
  Sparkles,
  Clapperboard,
  Globe,
  Newspaper,
  Baby,
  Radio,
  Tv,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChannelCard } from "./ChannelCard";

// Map the icon *name* (string, from the server) to a lucide component.
const ICONS = {
  Trophy,
  Flag,
  Sparkles,
  Clapperboard,
  Globe,
  Newspaper,
  Baby,
  Radio,
  Tv,
};

export function ChannelGrid({ items, categories, meta }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const matchCat = active === "all" || it.category.slug === active;
      const matchQ = !q || it.name.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [items, query, active]);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-linear-to-br from-primary/25 via-emerald-500/5 to-transparent" />
        <div className="absolute -left-24 -top-24 size-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-8 size-64 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <Badge
            variant="secondary"
            className="mb-5 gap-1.5 border-border bg-background/60 backdrop-blur"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            {meta.amount} live channels
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Nova <span className="text-primary">TV</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Live TV, beautifully free. Stream news, sports, movies and more.
            {meta.updatedOn ? (
              <span className="block text-sm text-muted-foreground/70 sm:inline sm:ml-1">
                Updated {meta.updatedOn}.
              </span>
            ) : null}
          </p>
        </div>
      </section>

      {/* Sticky toolbar: search + category tabs */}
      <div className="sticky top-16 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto max-w-7xl space-y-3 px-4 py-3 sm:px-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search channels…"
              className="pl-9"
              aria-label="Search channels"
            />
          </div>

          <Tabs value={active} onValueChange={setActive}>
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="all" className="flex-none px-3">
                All
                <span className="ml-1.5 text-xs text-muted-foreground/70">
                  {items.length}
                </span>
              </TabsTrigger>
              {categories.map((c) => {
                const Icon = ICONS[c.icon] || Tv;
                return (
                  <TabsTrigger key={c.slug} value={c.slug} className="flex-none px-3">
                    <Icon className="size-3.5" />
                    {c.label}
                    <span className="ml-1 text-xs text-muted-foreground/70">
                      {c.count}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
            <Search className="size-8 text-muted-foreground/50" />
            <p className="text-lg font-medium">No channels found</p>
            <p className="text-sm text-muted-foreground">
              Try a different search or category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
