"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PlatformBadges } from "@/features/shared/PlatformBadge";
import { GameStatusChip, normalizeGameStatus } from "@/features/shared/GameStatusChip";
import { GamePrice } from "./GamePrice";
import type { StoreGame } from "../types";

export function GameCard({ game }: { game: StoreGame }) {
  const showStatus = normalizeGameStatus(game.status) !== "released";

  return (
    <Link
      href={`/games/${game.slug}`}
      className="group card card-hover flex flex-col overflow-hidden hover:border-primary/50 hover:shadow-xl"
    >
      <div className="relative aspect-video overflow-hidden bg-surface-elevated">
        {game.coverImage ? (
          <Image
            src={game.coverImage}
            alt={game.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl">🎮</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" />

        <div className="absolute left-3 top-3 right-3 flex items-start justify-between gap-2">
          <PlatformBadges platforms={game.platforms} variant="overlay" />
          {showStatus && <GameStatusChip status={game.status} overlay />}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="line-clamp-1 text-lg font-bold text-foreground transition-colors group-hover:text-primary">
          {game.title}
        </h3>

        {game.publisher && <p className="text-xs text-text-muted">{game.publisher}</p>}

        {game.shortDescription && (
          <p className="line-clamp-2 pt-1 text-sm leading-relaxed text-text-secondary">{game.shortDescription}</p>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
          <GamePrice
            price={game.price}
            priceCurrency={game.priceCurrency}
            priceUsdCents={game.priceUsdCents}
            priceUnavailable={game.priceUnavailable}
          />
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-text-secondary transition-all group-hover:bg-primary group-hover:text-white">
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
