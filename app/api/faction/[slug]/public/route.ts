// app/api/faction/[slug]/public/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPublicFaction } from "@/core/lib/factionPublic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const faction = await getPublicFaction(slug);
  if (!faction) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      slug: faction.slug,
      name: faction.name,
      symbol: faction.symbol,
      memberCount: faction.memberCount,
      level: faction.level,
      rank: faction.rank,
      market: faction.market,
      promo: faction.promo,
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
