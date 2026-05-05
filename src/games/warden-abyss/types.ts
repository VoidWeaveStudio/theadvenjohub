// src/games/warden-abyss/types.ts
export interface GameProgress {
  balance: number;
  totalEarned: number;
  burned: number;
  withdrawn: number;
  blocked: number;
  burnBonusPercent: number;
  upgrades: Record<string, number>;
  skins: Record<string, { owned: boolean }>;
}

export type GameAction = "burn" | "withdraw" | "block" | "upgrade" | "skin";

export interface FloatingDamage {
  id: number;
  value: number;
  x: number;
  y: number;
  createdAt: number;
}