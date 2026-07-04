import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getChannel,
  getChannels,
  normalizeCategory,
  isPrivateChannel,
} from "@/lib/channels";
import { imgProxy } from "@/lib/urls";
import { VideoPlayer } from "@/app/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChannelCard } from "@/app/components/ChannelCard";

export const dynamic = "force-dynamic";

export default function ChannelPage({ params }) {
  const channel = getChannel(params.id);
  if (!channel) notFound();

  const id = Number(params.id);
  const proxyUrl = "/api/proxy?u=" + encodeURIComponent(channel.link);
  const category = normalizeCategory(channel.category_name);

  // Related channels: same category, excluding the current one, and filtering out private channels.
  const related = getChannels()
    .map((c, i) => ({ id: i, name: c.name, logo: c.logo, cat: normalizeCategory(c.category_name) }))
    .filter((x) => x.cat.slug === category.slug && x.id !== id && !isPrivateChannel(x.name))
    .slice(0, 12)
    .map(({ id, name, logo, cat }) => ({ id, name, logo, category: cat }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <Link href="/">
          <ArrowLeft className="size-4" />
          All channels
        </Link>
      </Button>

      {/* Channel header */}
      <div className="mb-5 flex items-center gap-4">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-card p-2">
          {channel.logo ? (
            <img src={imgProxy(channel.logo)} alt="" className="size-full object-contain" />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{channel.name}</h1>
            <Badge variant="destructive" className="gap-1">
              <span className="size-1.5 animate-pulse rounded-full bg-white" />
              LIVE
            </Badge>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{category.label}</div>
        </div>
      </div>

      {/* Player */}
      <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-2xl shadow-black/40">
        <VideoPlayer proxyUrl={proxyUrl} />
      </div>

      {/* Related channels */}
      {related.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            More in {category.label}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
            {related.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
