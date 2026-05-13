//src\features\store\components\GameCard.tsx
"use client";

import { useState } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { GameDetailModal } from "./GameDetailsModal";

interface GameCardProps {
  id: string;
  slug: string;
  title: string;
  coverImage: string | null;
  price: number;
  publisher?: string | null;
  isOwned?: boolean;
}

const normalizeSlug = (slug: string) => slug.replace(/-/g, '_');

export function GameCard({
  id,
  slug,
  title,
  coverImage,
  price,
  publisher,
  isOwned = false,
}: GameCardProps) {
  const { t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formatPrice = (price: number) => {
    if (price <= 0) return t("game.free");
    return `${price.toLocaleString("en-US")} TNJ`;
  };

  const shortDescription = t(`games.${normalizeSlug(slug)}.shortDescription`) || t("game.inDevelopment");

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className="group bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden hover:border-primary/50 transition-all cursor-pointer hover:shadow-[0_0_25px_rgba(59,130,246,0.15)]"
      >
        <div className="h-48 bg-zinc-800 relative overflow-hidden">
          {coverImage ? (
            <img
              src={coverImage}
              alt={title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl text-zinc-600">
              {t("game.placeholderIcon")}
            </div>
          )}

          {isOwned && (
            <div className="absolute top-3 right-3 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md">
              ✓ {t("game.owned")}
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 to-transparent" />
        </div>

        <div className="p-4 flex flex-col h-full">
          <h3 className="text-lg font-bold text-foreground mb-1 truncate" title={title}>
            {title}
          </h3>

          {publisher && (
            <p className="text-xs text-text-secondary mb-2 truncate" title={publisher}>
              {t("game.publisher")}: {publisher}
            </p>
          )}

          <p className="text-xs text-text-secondary line-clamp-2 mb-4 flex-grow">
            {shortDescription}
          </p>

          <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-800/50">
            <span className="text-sm font-bold text-primary">
              {formatPrice(price)}
            </span>
          </div>
        </div>
      </div>

      <GameDetailModal
        slug={slug}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPurchaseSuccess={() => {}}
      />
    </>
  );
}