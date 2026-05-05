//src\core\init.ts
import { testConnection } from "@/core/blockchain/solana";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set and at least 32 characters long");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

if (!process.env.CSRF_SECRET || process.env.CSRF_SECRET.length < 32) {
  throw new Error("CSRF_SECRET must be set and at least 32 characters long");
}

if (typeof window === "undefined" && process.env.NODE_ENV !== "production") {
  testConnection().then((ok) => {
    if (!ok) {
      console.warn("⚠️ Solana RPC connection failed. Check SOLANA_RPC_PRIVATE in .env");
    }
  });
}