"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { PlatformBadges } from "@/features/shared/PlatformBadge";
import { GameStatusChip, normalizeGameStatus } from "@/features/shared/GameStatusChip";
import { GamePrice } from "./GamePrice";
import type { StoreGame } from "../types";

export function FeaturedGame({ game }: { game: StoreGame }) {
  const { t } = useLanguage();
  const showStatus = normalizeGameStatus(game.status) !== "released";

  return (
    <Link
      href={`/games/${game.slug}`}
      className="group card block overflow-hidden transition-colors hover:border-primary/50"
    >
      <div className="grid lg:grid-cols-5">
        <div className="relative aspect-video overflow-hidden bg-surface-elevated lg:col-span-3 lg:aspect-auto lg:min-h-[340px]">
          {game.coverImage ? (
            <Image
              src={game.coverImage}
              alt={game.title}
              fill
              priority
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
      </div>
    </Link>
  );
}
