export const GAME_PLATFORMS = ["web", "pc", "telegram", "google_play", "app_store"] as const;
export type GamePlatform = (typeof GAME_PLATFORMS)[number];

export const STORE_LINK_KEYS = ["telegram", "googlePlay", "appStore"] as const;
export type StoreLinkKey = (typeof STORE_LINK_KEYS)[number];
export type GameStoreLinks = Partial<Record<StoreLinkKey, string>>;

const LINK_TO_PLATFORM: Record<StoreLinkKey, GamePlatform> = {
  telegram: "telegram",
  googlePlay: "google_play",
  appStore: "app_store",
};

const PLATFORM_TO_LINK: Partial<Record<GamePlatform, StoreLinkKey>> = {
  telegram: "telegram",
  google_play: "googlePlay",
  app_store: "appStore",
};

export function isGamePlatform(value: unknown): value is GamePlatform {
  return typeof value === "string" && (GAME_PLATFORMS as readonly string[]).includes(value);
}

export function normalizePlatform(value: unknown): GamePlatform | null {
  if (typeof value !== "string") return null;

  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return isGamePlatform(key) ? key : null;
}

export function sanitizeStoreLinks(raw: unknown): GameStoreLinks {
  if (typeof raw !== "object" || raw === null) return {};

  const source = raw as Record<string, unknown>;
  const links: GameStoreLinks = {};

  for (const key of STORE_LINK_KEYS) {
    const value = source[key];
    if (typeof value !== "string") continue;

    const url = value.trim();
    if (url.length === 0 || url.length > 512 || !url.startsWith("https://")) continue;

    links[key] = url;
  }

  return links;
}

export function resolvePlatforms(platform: string | null | undefined, links: GameStoreLinks): GamePlatform[] {
  const found = new Set<GamePlatform>();

  const primary = normalizePlatform(platform);
  if (primary) found.add(primary);

  for (const key of STORE_LINK_KEYS) {
    if (links[key]) found.add(LINK_TO_PLATFORM[key]);
  }

  return GAME_PLATFORMS.filter((entry) => found.has(entry));
}

export function platformStoreUrl(platform: GamePlatform, links: GameStoreLinks): string | null {
  const key = PLATFORM_TO_LINK[platform];
  return key ? links[key] ?? null : null;
}

export function needsLicense(platforms: GamePlatform[]): boolean {
  return platforms.length === 0 || platforms.some((entry) => entry === "web" || entry === "pc");
}
