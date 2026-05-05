// src\core\auth\lib\session.ts
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/core/admin/auth";

export interface Session {
  wallet: string;
  role?: string;
}

export async function verifySession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value ||
    cookieStore.get("admin_token")?.value;

  if (!token) return null;

  const payload = verifyAdminToken(token);
  if (!payload) return null;

  return {
    wallet: payload.wallet,
    role: payload.role,
  };
}