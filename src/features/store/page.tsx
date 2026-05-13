//src\features\store\page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { GameCard } from "./components/GameCard";
import { apiGet } from "@/core/api/client";

interface StoreGame {
  id: string;
  slug: string;
  title: string;
  coverImage: string | null;
  price: number;
  publisher?: string | null;
  isActive: boolean;
}

export default function StorePage() {
  const { t } = useLanguage();
  const [games, setGames] = useState<StoreGame[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGames = useCallback(async () => {
    try {
      const data = await apiGet<{ games: StoreGame[] }>("/api/games?active=true");
      setGames(data.games || []);
    } catch (error) {
      console.error("Failed to load store games:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16">

      <div className="mb-8 sm:mb-12">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          {t("store.title")}
        </h1>
        <p className="text-text-secondary">
          {t("store.subtitle")}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden animate-pulse">
              <div className="h-48 bg-zinc-800" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-zinc-800 rounded w-3/4" />
                <div className="h-4 bg-zinc-800 rounded w-full" />
                <div className="h-4 bg-zinc-800 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="text-center py-16 text-text-secondary">
          <p className="text-lg mb-2">🎮 {t("store.noGames")}</p>
          <p className="text-sm">{t("store.noGamesHint")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <GameCard
              key={game.id}
              id={game.id}
              slug={game.slug}
              title={game.title}
              coverImage={game.coverImage}
              price={game.price}
              publisher={game.publisher}
            />
          ))}
        </div>
      )}

      <div className="mt-12 sm:mt-16 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-text-muted px-2">
          <span>
            © {new Date().getFullYear()} VoidWeave Studio. {t("store.footer")}
          </span>
          <span className="hidden sm:inline text-text-muted/30">•</span>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            {t("footer.privacy")}
          </Link>
        </div>
      </div>
    </div>
  );
}