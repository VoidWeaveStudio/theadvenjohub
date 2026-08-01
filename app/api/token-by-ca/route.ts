// app/api/token-by-ca/route.ts
import { NextResponse } from "next/server";
import { getTokenByCa } from "@/core/lib/dexscreener";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const ca = searchParams.get("ca");

    if (!ca) return NextResponse.json(null);

    const data = await getTokenByCa(ca);
    return NextResponse.json(data);
}
