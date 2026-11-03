"use client";

import { LayoutGrid, Search, X } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { GAME_PLATFORMS } from "@/core/lib/gamePlatforms";
import { PLATFORM_LABEL_KEYS, PlatformIcon } from "@/features/shared/PlatformIcon";
import type { StoreCategory } from "../types";

interface CategoryBarProps {
  active: StoreCategory;
  counts: Record<StoreCategory, number>;
  onChange: (category: StoreCategory) => void;
  query: string;
  onQueryChange: (query: string) => void;
}

const CATEGORIES: StoreCategory[] = ["all", ...GAME_PLATFORMS];

export function CategoryBar({ active, counts, onChange, query, onQueryChange }: CategoryBarProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative w-full lg:w-72 lg:shrink-0">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("store.search")}
          aria-label={t("store.search")}
          className="input-field rounded-full pl-10 pr-10"
        />
        {query !== "" && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label={t("actions.close")}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent p-0 text-text-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div
        role="tablist"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
    </div>
  );
}
