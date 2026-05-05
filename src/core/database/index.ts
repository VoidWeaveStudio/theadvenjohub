//src\core\database\index.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { getCache, setCache, deleteCache } from "../lib/cache";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

export { getCache, setCache, deleteCache };

export async function safeQuery<T>(
  fn: () => Promise<T>, 
  maxRetries = 2, 
  baseDelay = 200
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => 
          setTimeout(() => reject(new Error("DB_TIMEOUT")), 8000)
        )
      ]);
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      if (err.message?.includes("ECONNRESET") || 
          err.message?.includes("fetch failed") || 
          err.message?.includes("DB_TIMEOUT")) {
        await new Promise(res => setTimeout(res, baseDelay * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
}

export * from "./schema";