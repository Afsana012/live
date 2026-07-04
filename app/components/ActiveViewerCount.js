"use client";

import { usePresence } from "@/app/components/usePresence";

/**
 * Client-side component to register the user's heartbeat on a channel
 * and display the live active viewer count.
 */
export function ActiveViewerCount({ channelId }) {
  const presence = usePresence(channelId);
  const count = presence.channels[channelId] || 1; // default to 1 (the current user)

  return (
    <span 
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-semibold font-mono bg-muted/60 px-2.5 py-1 rounded-full border border-border/40"
      title={`${count} user(s) currently watching this channel`}
    >
      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
      {count} watching
    </span>
  );
}
