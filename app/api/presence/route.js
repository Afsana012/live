import { pingPresence, getPresenceStats } from "@/lib/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fetch current active users and per-channel counts. */
export async function GET() {
  const stats = getPresenceStats();
  return new Response(JSON.stringify(stats), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** Record user heartbeat and immediately return updated stats to reduce network load. */
export async function POST(req) {
  try {
    const body = await req.json();
    const { sessionId, channelId } = body;
    if (!sessionId || !channelId) {
      return new Response("missing parameters\n", { status: 400 });
    }

    pingPresence(sessionId, channelId);

    const stats = getPresenceStats();
    return new Response(JSON.stringify(stats), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("invalid request body\n", { status: 400 });
  }
}
