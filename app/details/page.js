import Link from "next/link";
import { ArrowLeft, Calendar, FileText, Tv, ShieldAlert, Lock } from "lucide-react";
import { getMeta, getExpiryMs, getChannels, isPrivateChannel, normalizeCategory } from "@/lib/channels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PrivateChannelsGrid } from "./PrivateChannelsGrid";

export const dynamic = "force-dynamic";

export default function DetailsPage() {
  const meta = getMeta();
  const expiryMs = getExpiryMs();
  const allChannels = getChannels();

  const formattedExpiry = expiryMs 
    ? new Date(expiryMs).toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      })
    : "No expiry information available";

  // Filter private channels, preserving original index as id for link routing.
  const privateChannels = allChannels
    .map((c, i) => ({
      id: i,
      name: c.name,
      logo: c.logo,
      category: normalizeCategory(c.category_name),
    }))
    .filter((ch) => isPrivateChannel(ch.name));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <Link href="/">
          <ArrowLeft className="size-4 mr-2" />
          Back to Channels
        </Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left/Main column for Metadata & Warnings */}
        <div className="lg:col-span-1 space-y-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              System <span className="text-primary">Details</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Metadata and diagnostic details for the live streaming system.
            </p>
          </div>

          <Card className="border-border bg-card/50 backdrop-blur-md">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                Playlist Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-col gap-1 border-b border-border/40 pb-4">
                <span className="text-xs font-medium text-muted-foreground">Source Name</span>
                <span className="text-sm font-semibold text-foreground">{meta.name}</span>
              </div>

              <div className="flex flex-col gap-1 border-b border-border/40 pb-4">
                <span className="text-xs font-medium text-muted-foreground">Last Updated On</span>
                <span className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Calendar className="size-4" />
                  {meta.updatedOn || "Unknown"}
                </span>
              </div>

              <div className="flex flex-col gap-1 border-b border-border/40 pb-4">
                <span className="text-xs font-medium text-muted-foreground">Public Channels</span>
                <Badge variant="secondary" className="w-fit text-xs font-semibold px-2.5 py-0.5">
                  <Tv className="size-3.5 mr-1" />
                  {meta.amount} Channels
                </Badge>
              </div>

              <div className="flex flex-col gap-1 pt-2">
                <span className="text-xs font-medium text-muted-foreground">Cookie Expiry</span>
                <span className="text-sm font-semibold text-foreground block leading-relaxed">
                  {formattedExpiry}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  (All channels share this expiration boundary)
                </span>
              </div>
            </CardContent>
          </Card>

          {expiryMs && expiryMs - Date.now() < 86400000 * 2 && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-start gap-3">
              <ShieldAlert className="size-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-destructive">Cookie Refresh Needed</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  The session cookies are nearing expiration. Replace <code className="text-foreground bg-muted px-1.5 py-0.5 rounded text-[11px]">toffee_channel_data.json</code> with a fresh one to keep the streams active.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right column for Private Channels list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border-b border-border pb-4 flex items-center gap-2">
            <Lock className="size-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Private Channels</h2>
            <Badge variant="outline" className="ml-2 border-primary/20 bg-primary/5 text-primary font-mono">
              {privateChannels.length} hidden
            </Badge>
          </div>

          {privateChannels.length > 0 ? (
            <PrivateChannelsGrid items={privateChannels} />
          ) : (
            <p className="text-sm text-muted-foreground">No private channels configured.</p>
          )}
        </div>
      </div>
    </div>
  );
}
