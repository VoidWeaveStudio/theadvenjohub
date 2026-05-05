//app\api\user\library\route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/core/auth/lib/auth";

export async function GET(req: NextRequest) {
  const result = await requireAuth(req);
  
  if (result instanceof NextResponse) {
    return result;
  }

  return NextResponse.json([], { status: 200 });
}