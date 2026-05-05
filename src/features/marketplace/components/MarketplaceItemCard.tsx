//src\features\marketplace\components\MarketplaceItemCard.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { formatPrice } from "../lib/utils";
import type { ItemWithGame } from "../types";

interface MarketplaceItemCardProps {
  item: ItemWithGame;
  viewMode: "grid" | "list";
  onItemClick: (item: ItemWithGame) => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: "border-gray-400 bg-gray-400/10 text-gray-400",
  rare: "border-blue-500 bg-blue-500/10 text-blue-500",
  epic: "border-purple-500 bg-purple-500/10 text-purple-500",
  legendary: "border-yellow-500 bg-yellow-500/10 text-yellow-500",
};

export function MarketplaceItemCard({
  item,
  viewMode,
  onItemClick
}: MarketplaceItemCardProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [imageError, setImageError] = useState(false);

  const handleClick = () => onItemClick(item);

  const handleGameClick = (e: React.MouseEvent, gameSlug: string) => {
    e.stopPropagation();
    router.push(`/games/${gameSlug}`);
  };

  const rarityColor = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;

  if (viewMode === "list") {
    return (
      <div
        onClick={handleClick}
        className="card p-4 border-border hover:border-primary/50 cursor-pointer transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 bg-surface rounded-lg overflow-hidden flex-shrink-0">
            {!imageError && item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl" aria-label={t("marketplace.noImage")}>
                📦
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {item.name}
            </h3>
            {item.game && (
              <button
                onClick={(e) => handleGameClick(e, item.game!.slug)}
                className="text-sm text-text-secondary hover:text-primary transition-colors"
              >
                {item.game.title}
              </button>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${rarityColor}`}>
                {t(`marketplace.rarity.${item.rarity}`)}
              </span>
              <span className="text-xs text-text-muted capitalize">{t(`marketplace.type.${item.type}`)}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xl font-bold text-primary">
              {formatPrice(item.price)} TNJ
            </div>
            {item.stock === 1 && (
              <div className="text-xs text-orange-400">{t("marketplace.lastOne")}</div>
            )}
            {item.stock === 0 && (
              <div className="text-xs text-green-400">{t("marketplace.unlimited")}</div>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleClick(); }}
            className="btn-primary px-6 py-2"
            aria-label={t("marketplace.buy")}
          >
            {t("marketplace.buy")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="card border-border hover:border-primary/50 overflow-hidden cursor-pointer transition-all group hover:shadow-lg hover:shadow-primary/10"
    >
      <div className="aspect-square bg-surface relative overflow-hidden">
        {!imageError && item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl" aria-label={t("marketplace.noImage")}>
            📦
          </div>
        )}

        <div className={`absolute top-2 right-2 px-2 py-1 text-xs font-bold rounded border ${rarityColor}`}>
          {t(`marketplace.rarity.${item.rarity}`)}
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors mb-1">
          {item.name}
        </h3>

        {item.game && (
          <button
            onClick={(e) => handleGameClick(e, item.game!.slug)}
            className="text-xs text-text-secondary hover:text-primary transition-colors block mb-3"
          >
            {item.game.title}
          </button>
        )}

        <div className="flex items-center justify-between">
          <div className="text-lg font-bold text-primary">
            {formatPrice(item.price)}
          </div>
          <span className="text-xs text-text-muted">TNJ</span>
        </div>

        {item.stock === 1 && (
          <div className="mt-2 text-xs text-orange-400 text-center">{t("marketplace.lastOne")}</div>
        )}
      </div>
    </div>
  );
}