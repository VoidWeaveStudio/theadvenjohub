//app\api\games\route.ts
import { NextResponse } from "next/server";
import { gamesRegistry } from "@/games/registry";

export async function GET() {
  const games = Object.values(gamesRegistry).map(({ id, title, price, version, status }) => ({
    id,
    title,
    price,
    version,
    status,
  }));

  return NextResponse.json({ games });
}