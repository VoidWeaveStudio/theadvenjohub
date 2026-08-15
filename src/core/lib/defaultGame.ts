// src/core/lib/defaultGame.ts

export const DEFAULT_GAME_SLUG = "tanjo-shooter";

export const BROWSER_PLAYABLE_SLUGS = [DEFAULT_GAME_SLUG];

export function isBrowserPlayable(slug: string): boolean {
  return BROWSER_PLAYABLE_SLUGS.includes(slug);
}
