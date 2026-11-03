"use client";

import { LayoutGrid } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { GAME_PLATFORMS } from "@/core/lib/gamePlatforms";
import { PLATFORM_LABEL_KEYS, PlatformIcon } from "@/features/shared/PlatformIcon";
import type { StoreCategory } from "../types";

interface CategoryBarProps {
  active: StoreCategory;
  counts: Record<StoreCategory, number>;
  onChange: (category: StoreCategory) => void;
}

const CATEGORIES: StoreCategory[] = ["all", ...GAME_PLATFORMS];

export function CategoryBar({ active, counts, onChange }: CategoryBarProps) {
  const { t } = useLanguage();

  return (
    <div
      role="tablist"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {CATEGORIES.map((category) => {
        const selected = category === active;
        const count = counts[category];

        return (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(category)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
              selected
                ? "border-primary bg-primary text-white"
                : count === 0
                  ? "border-border bg-surface text-text-muted"
                  : "border-border bg-surface text-text-secondary hover:border-border-hover hover:text-foreground"
            }`}
          >
            {category === "all" ? (
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PlatformIcon platform={category} className="h-4 w-4" />
            )}
            {category === "all" ? t("store.category.all") : t(PLATFORM_LABEL_KEYS[category])}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs leading-none ${
                selected ? "bg-white/20 text-white" : "bg-surface-elevated text-text-muted"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
