"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { PlatformBadges } from "@/features/shared/PlatformBadge";
import { GameStatusChip, normalizeGameStatus } from "@/features/shared/GameStatusChip";
import { GamePrice } from "./GamePrice";
import type { StoreGame } from "../types";

const SLIDE_INTERVAL_MS = 6500;
const SWIPE_THRESHOLD_PX = 48;

function FeaturedSlide({ game, active, priority }: { game: StoreGame; active: boolean; priority: boolean }) {
  const { t } = useLanguage();
  const showStatus = normalizeGameStatus(game.status) !== "released";

  return (
    <Link
      href={`/games/${game.slug}`}
      tabIndex={active ? 0 : -1}
      aria-hidden={!active}
      className={`group col-start-1 row-start-1 grid transition-opacity duration-700 ease-in-out lg:grid-cols-5 ${
        active ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="relative aspect-video overflow-hidden bg-surface-elevated lg:col-span-3 lg:aspect-auto lg:min-h-[340px]">
        {game.coverImage ? (
          <Image
            src={game.coverImage}
            alt={game.title}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-7xl">🎮</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-surface/60" />
      </div>

      <div className="flex flex-col justify-center gap-4 p-6 sm:p-8 lg:col-span-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {t("store.featured")}
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{game.title}</h2>
          {game.shortDescription && (
            <p className="line-clamp-3 leading-relaxed text-text-secondary">{game.shortDescription}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PlatformBadges platforms={game.platforms} size="md" />
          {showStatus && <GameStatusChip status={game.status} />}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <GamePrice
            price={game.price}
            priceCurrency={game.priceCurrency}
            priceUsdCents={game.priceUsdCents}
            priceUnavailable={game.priceUnavailable}
            large
          />
          <span className="btn-primary inline-flex items-center gap-2">
            {t("store.viewGame")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function FeaturedCarousel({ games }: { games: StoreGame[] }) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const count = games.length;
  const current = count === 0 ? 0 : index % count;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reducedMotion) return;

    const timer = window.setTimeout(() => setIndex((current + 1) % count), SLIDE_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [current, count, paused, reducedMotion]);

  const onTouchEnd = (clientX: number) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null || count < 2) return;

    const delta = clientX - start;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;

    setIndex(delta < 0 ? (current + 1) % count : (current - 1 + count) % count);
  };

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("store.featured")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0].clientX;
      }}
      onTouchEnd={(event) => onTouchEnd(event.changedTouches[0].clientX)}
    >
      <div className="card grid overflow-hidden transition-colors hover:border-primary/50">
        {games.map((game, position) => (
          <FeaturedSlide key={game.id} game={game} active={position === current} priority={position === 0} />
        ))}
      </div>

      {count > 1 && (
        <div className="mt-3 flex items-center justify-center">
          {games.map((game, position) => (
            <button
              key={game.id}
              type="button"
              onClick={() => setIndex(position)}
              aria-label={game.title}
              aria-current={position === current}
              className="border-0 bg-transparent p-1.5 hover:bg-transparent"
            >
              <span
                className={`block h-2 rounded-full transition-all duration-500 ${
                  position === current ? "w-7 bg-primary" : "w-2 bg-text-muted/40"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
