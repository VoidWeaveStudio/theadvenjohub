// app/api/faction/[slug]/view/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";
import { resolveFactionRef } from "@/core/lib/factionPublic";
import { bumpPageStatOnce } from "@/core/lib/factionStats";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip = getClientIp(req);

    const rl = await checkRateLimit(`faction:view:${ip}`, {
      maxAttempts: 30,
      windowMs: 60_000,
      prefix: "api:faction:view",
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: "too_many_attempts" }, { status: 429, headers: formatRateLimitHeaders(rl) });
    }

    const { slug } = await params;
    const faction = await resolveFactionRef(slug);
    if (!faction) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const visitor = createHash("sha256").update(`${faction.id}:${ip}`).digest("hex").slice(0, 24);
    const counted = await bumpPageStatOnce(faction.id, "views", visitor);

    return NextResponse.json({ counted }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[faction/view] Error:", error);
    return NextResponse.json({ error: "view_failed" }, { status: 500 });
  }
}
