//src\games\registry.ts

export interface GameModule {
  id: string;
  title: string;
  price: number;
  version: string;
  status: "active" | "maintenance" | "deprecated";
  module: () => Promise<any>;
  assetsManifest: () => Promise<any>;
}

export const gamesRegistry: Record<string, GameModule> = {
  "warden-abyss": {
    id: "warden-abyss",
    title: "Warden Abyss",
    price: 0,
    version: "1.0.0",
    status: "active",
    module: () => import("@/games/warden-abyss/WardenAbyssPage"),
    assetsManifest: () => import("@/games/warden-abyss/assets/manifest.json"),
  },
};