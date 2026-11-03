"use client";

import { useLanguage } from "@/core/i18n/LanguageContext";
import type { GamePlatform } from "@/core/lib/gamePlatforms";
import { PLATFORM_LABEL_KEYS, PLATFORM_TONES, PlatformIcon } from "./PlatformIcon";

type BadgeVariant = "overlay" | "soft";
type BadgeSize = "sm" | "md";

interface PlatformBadgeProps {
  platform: GamePlatform;
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const SIZES: Record<BadgeSize, { box: string; icon: string }> = {
  sm: { box: "gap-1 px-2 py-1 text-[11px]", icon: "w-3.5 h-3.5" },
  md: { box: "gap-1.5 px-3 py-1.5 text-sm", icon: "w-4 h-4" },
};

export function PlatformBadge({ platform, variant = "soft", size = "sm" }: PlatformBadgeProps) {
  const { t } = useLanguage();
  const tone = PLATFORM_TONES[platform];
  const dims = SIZES[size];
  const label = t(PLATFORM_LABEL_KEYS[platform]);

  if (variant === "overlay") {
    return (
      <span
        title={label}
        className={`inline-flex items-center rounded-full border border-white/15 bg-black/65 font-semibold leading-none text-white backdrop-blur-sm ${dims.box}`}
      >
        <PlatformIcon platform={platform} className={`${dims.icon} ${tone.text}`} />
        {label}
      </span>
    );
  }

  return (
    <span
      title={label}
      className={`inline-flex items-center rounded-full border font-semibold leading-none ${tone.soft} ${dims.box}`}
    >
      <PlatformIcon platform={platform} className={dims.icon} />
      {label}
    </span>
  );
}

export function PlatformBadges({ platforms, variant, size }: { platforms: GamePlatform[]; variant?: BadgeVariant; size?: BadgeSize }) {
  if (platforms.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {platforms.map((platform) => (
        <PlatformBadge key={platform} platform={platform} variant={variant} size={size} />
      ))}
    </div>
  );
}
