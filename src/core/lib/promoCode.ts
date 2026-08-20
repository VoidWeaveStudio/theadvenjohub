// src/core/lib/promoCode.ts
import { randomInt } from "node:crypto";

// Excludes visually ambiguous characters (0/O, 1/I).
const PROMO_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PROMO_CODE_LENGTH = 8;

export function generatePromoCode(): string {
  let code = "";
  for (let i = 0; i < PROMO_CODE_LENGTH; i++) {
    code += PROMO_CODE_ALPHABET[randomInt(PROMO_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase();
}
