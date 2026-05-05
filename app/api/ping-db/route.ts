//app\api\ping-db\route.ts
import { NextResponse } from "next/server";
import { db } from "@/core/database";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const result = await db.execute(sql`SELECT 1 as ping`);
    
    try {
      const tables = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'users'
        ) as users_exists
      `);
      
      const usersExists = (tables as any)[0]?.users_exists;
      
      return NextResponse.json({ 
        ok: true, 
        ping: (result as any)[0]?.ping,
        usersTableExists: usersExists 
      });
    } catch {
      return NextResponse.json({ 
        ok: true, 
        ping: (result as any)[0]?.ping,
        usersTableCheck: "Failed"
      });
    }
    
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}