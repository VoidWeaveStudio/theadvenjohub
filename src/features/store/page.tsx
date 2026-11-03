"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { apiGet } from "@/core/api/client";
import { DEFAULT_GAME_SLUG } from "@/core/lib/defaultGame";
import { GAME_PLATFORMS } from "@/core/lib/gamePlatforms";
import { PlatformIcon } from "@/features/shared/PlatformIcon";
import { gameStatusRank } from "@/features/shared/GameStatusChip";
import { GameCard } from "./components/GameCard";
import { FeaturedCarousel } from "./components/FeaturedCarousel";
import { CategoryBar } from "./components/CategoryBar";
import type { StoreCategory, StoreGame } from "./types";

export default function StorePage() {
  const { t, language } = useLanguage();
  const [games, setGames] = useState<StoreGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<StoreCategory>("all");
  const [query, setQuery] = useState("");

  const loadGames = useCallback(async () => {
    try {
      const data = await apiGet<{ games: StoreGame[] }>(`/api/games?active=true&lang=${language}`);
      setGames(data.games || []);
    } catch (error) {
      console.error("Failed to load store games:", error);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const sorted = useMemo(
    () =>
      [...games].sort(
        (a, b) => gameStatusRank(a.status) - gameStatusRank(b.status) || a.title.localeCompare(b.title),
      ),
    [games],
  );

  const counts = useMemo(() => {
    const result = { all: sorted.length } as Record<StoreCategory, number>;
    for (const platform of GAME_PLATFORMS) {
      result[platform] = sorted.filter((game) => game.platforms.includes(platform)).length;
    }
    return result;
  }, [sorted]);

  const needle = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      sorted.filter(
        (game) =>
          (category === "all" || game.platforms.includes(category)) &&
          (needle === "" || game.title.toLowerCase().includes(needle)),
      ),
    [sorted, category, needle],
  );

  const slides = useMemo(() => {
    const lead = sorted.find((game) => game.slug === DEFAULT_GAME_SLUG);
    return lead ? [lead, ...sorted.filter((game) => game !== lead)] : sorted;
  }, [sorted]);

  const showCarousel = category === "all" && needle === "";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-surface px-5 py-8 sm:mb-10 sm:px-10 sm:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">{t("store.title")}</h1>
          <p className="mt-3 text-base text-text-secondary sm:text-lg">{t("store.subtitle")}</p>
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse overflow-hidden">
              <div className="aspect-video bg-surface-elevated" />
              <div className="space-y-3 p-4">
                <div className="h-5 w-3/4 rounded bg-surface-elevated" />
                <div className="h-4 w-full rounded bg-surface-elevated" />
                <div className="h-4 w-2/3 rounded bg-surface-elevated" />
              </div>
            </div>
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="py-16 text-center text-text-secondary">
          <p className="mb-2 text-lg">🎮 {t("store.noGames")}</p>
          <p className="text-sm">{t("store.noGamesHint")}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {showCarousel && <FeaturedCarousel games={slides} />}

          <CategoryBar
            active={category}
            counts={counts}
            onChange={setCategory}
            query={query}
            onQueryChange={setQuery}
          />

          {visible.length === 0 ? (
            <div className="card flex flex-col items-center px-6 py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-elevated text-text-muted">
                {category === "all" ? (
                  <Search className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <PlatformIcon platform={category} className="h-6 w-6" />
                )}
              </div>
              <p className="text-lg font-semibold text-foreground">
                {needle !== "" ? t("store.noResults") : t("store.emptyCategory")}
              </p>
              {needle === "" && <p className="mt-1 text-sm text-text-secondary">{t("store.emptyCategoryHint")}</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-12 text-center sm:mt-16">
        <div className="flex flex-col items-center justify-center gap-2 px-2 text-xs text-text-muted sm:flex-row sm:gap-4">
          <span>
            © {new Date().getFullYear()} VoidWeave Studio. {t("store.footer")}
          </span>
          <span className="hidden text-text-muted/30 sm:inline">•</span>
          <Link href="/privacy" className="inline-flex min-h-[44px] items-center transition-colors hover:text-foreground">
            {t("footer.privacy")}
          </Link>
        </div>
      </div>
    </div>
  );
}
