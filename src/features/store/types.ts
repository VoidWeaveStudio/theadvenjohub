import type { GamePlatform, GameStoreLinks } from "@/core/lib/gamePlatforms";

export interface StoreGame {
  id: string;
  slug: string;
  title: string;
  coverImage: string | null;
  publisher: string | null;
  price: number;
  priceCurrency?: string;
  priceUsdCents?: number;
  priceUnavailable?: boolean;
  status: string;
  platforms: GamePlatform[];
  storeLinks: GameStoreLinks;
  shortDescription: string | null;
}

export type StoreCategory = "all" | GamePlatform;
