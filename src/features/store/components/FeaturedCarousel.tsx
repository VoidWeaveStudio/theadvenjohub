"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { PlatformBadges } from "@/features/shared/PlatformBadge";
import { GameStatusChip, normalizeGameStatus } from "@/features/shared/GameStatusChip";
import { GamePrice } from "./GamePrice";
import type { StoreGame } from "../types";

type Direction = 1 | -1;
type SlideState = "idle" | "active" | "leaving";

interface Transition {
  from: number;
  dir: Direction;
}

const SLIDE_INTERVAL_MS = 6500;
const TRANSITION_MS = 1000;
const SWIPE_THRESHOLD_PX = 48;

interface FeaturedSlideProps {
  game: StoreGame;
  state: SlideState;
  turning: boolean;
  dir: Direction;
  priority: boolean;
}

function FeaturedSlide({ game, state, turning, dir, priority }: FeaturedSlideProps) {
  const { t } = useLanguage();
  const showStatus = normalizeGameStatus(game.status) !== "released";
  const active = state === "active";

  return (
    <Link
      href={`/games/${game.slug}`}
      tabIndex={active ? 0 : -1}
      aria-hidden={!active}
      data-state={state}
      data-flip={turning ? "on" : "off"}
      data-dir={dir}
      className="fc-slide group col-start-1 row-start-1 grid lg:grid-cols-5"
    >
      <div className="relative aspect-video overflow-hidden bg-surface-elevated lg:col-span-3 lg:aspect-auto lg:min-h-[340px]">
        {game.coverImage ? (
          <Image
            src={game.coverImage}
            alt={game.title}
            fill
            priority={priority}
            loading="eager"
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-7xl">🎮</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-surface/60" />
      </div>

      <div className="flex flex-col justify-center gap-4 bg-surface p-6 sm:p-8 lg:col-span-2">
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
  const [current, setCurrent] = useState(0);
  const [transition, setTransition] = useState<Transition | null>(null);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const count = games.length;
  const shown = count === 0 ? 0 : current % count;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const go = useCallback(
    (target: number, dir: Direction) => {
      if (count < 2 || target === shown || transition) return;

      setTransition({ from: shown, dir });
      setCurrent(target);
    },
    [count, shown, transition],
  );

  useEffect(() => {
    if (!transition) return;

    const timer = window.setTimeout(() => setTransition(null), TRANSITION_MS + 60);
    return () => window.clearTimeout(timer);
  }, [transition]);

  useEffect(() => {
    if (count < 2 || paused || reducedMotion || transition) return;

    const timer = window.setTimeout(() => go((shown + 1) % count, 1), SLIDE_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [shown, count, paused, reducedMotion, transition, go]);

  const onTouchEnd = (clientX: number) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null || count < 2) return;

    const delta = clientX - start;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;

    if (delta < 0) go((shown + 1) % count, 1);
    else go((shown - 1 + count) % count, -1);
  };

  const stateOf = (position: number): SlideState => {
    if (position === shown) return "active";
    return transition && position === transition.from ? "leaving" : "idle";
  };

  if (count === 0) return null;

  const stageStyle = { "--fc-duration": `${TRANSITION_MS}ms` } as CSSProperties;

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
      <div
        className="fc-stage card grid overflow-hidden transition-colors hover:border-primary/50"
        style={stageStyle}
      >
        {games.map((game, position) => (
          <FeaturedSlide
            key={game.id}
            game={game}
            state={stateOf(position)}
            turning={transition !== null}
            dir={transition?.dir ?? 1}
            priority={position === 0}
          />
        ))}
      </div>

      {count > 1 && (
        <div className="mt-3 flex items-center justify-center">
          {games.map((game, position) => (
            <button
              key={game.id}
              type="button"
              onClick={() => go(position, position > shown ? 1 : -1)}
              aria-label={game.title}
              aria-current={position === shown}
              className="border-0 bg-transparent p-1.5 hover:bg-transparent"
            >
              <span
                className={`block h-2 rounded-full transition-all duration-500 ${
                  position === shown ? "w-7 bg-primary" : "w-2 bg-text-muted/40"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
