//src\core\types\game.ts
export interface GameModuleContract {
  id: string;
  title: string;
  price: number;
  version: string;
  status: "active" | "maintenance" | "deprecated";
  requirements: {
    walletConnected?: boolean;
    minBalance?: number;
  };
}

export interface GameProgressData {
  userId: string;
  totalEarned: number;
  balance: number;
  burned: number;
  withdrawn: number;
  blocked: number;
  burnBonusPercent: number;
  upgrades: Record<string, number>;
  skins: Record<string, { owned: boolean }>;
}

export type GameAction = "burn" | "withdraw" | "block" | "upgrade" | "skin";