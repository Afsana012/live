"use client";

import { usePresence } from "@/app/components/usePresence";
import { ChannelCard } from "@/app/components/ChannelCard";

/**
 * Client component wrapper for the private channels grid to poll active viewer counts.
 */
export function PrivateChannelsGrid({ items }) {
  const presence = usePresence("details");

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
      {items.map((ch) => (
        <ChannelCard key={ch.id} channel={ch} viewerCount={presence.channels[ch.id] || 0} />
      ))}
    </div>
  );
}
