"use client";

import { ExternalLink } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { platformStoreUrl, type GamePlatform, type GameStoreLinks } from "@/core/lib/gamePlatforms";
import { PlatformIcon } from "./PlatformIcon";

const LINK_PLATFORMS: GamePlatform[] = ["steam", "telegram", "google_play", "app_store"];

const OPEN_LABEL_KEYS: Record<string, string> = {
  steam: "store.open.steam",
  telegram: "store.open.telegram",
  google_play: "store.open.google_play",
  app_store: "store.open.app_store",
};

export function hasStoreLinks(links: GameStoreLinks): boolean {
  return LINK_PLATFORMS.some((platform) => platformStoreUrl(platform, links) !== null);
}

export function StoreLinkButtons({ links, primary = false }: { links: GameStoreLinks; primary?: boolean }) {
  const { t } = useLanguage();

  const entries = LINK_PLATFORMS.flatMap((platform) => {
    const url = platformStoreUrl(platform, links);
    return url ? [{ platform, url }] : [];
  });

  return (
    <div className="space-y-2">
      {entries.map(({ platform, url }, index) => (
        <a
          key={platform}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${primary && index === 0 ? "btn-primary" : "btn-secondary"} flex w-full items-center justify-center gap-2 py-3`}
        >
          <PlatformIcon platform={platform} className="h-5 w-5" />
          {t(OPEN_LABEL_KEYS[platform])}
          <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}
