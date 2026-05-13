//src\features\marketplace\components\MarketplaceItemCard.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { formatLotPrice } from "../lib/utils";
import type { LotWithGame } from "../types";

interface MarketplaceItemCardProps {
  item: LotWithGame;
  viewMode: "grid" | "list";
  onItemClick: (item: LotWithGame) => void;
}

const RARITY_COLORS: Record<string, string> = {
  standard: "border-gray-400 bg-gray-400/10 text-gray-400",
  premium: "border-blue-500 bg-blue-500/10 text-blue-500",
  rare: "border-purple-500 bg-purple-500/10 text-purple-500",
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

  const shortDescription = t("marketplace.lots.legendary.shortDescription") || "";
  const typeColor = RARITY_COLORS[item.type] || RARITY_COLORS.standard;

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


            {shortDescription && (
              <p className="text-xs text-text-secondary line-clamp-1 mt-1">
                {shortDescription}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${typeColor}`}>
                {t(`marketplace.type.${item.type}`)}
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xl font-bold text-primary">
              {formatLotPrice(item.price)} TNJ
            </div>
            {item.status === "available" && (
              <div className="text-xs text-green-400">{t("marketplace.available")}</div>
            )}
            {item.status === "sold" && (
              <div className="text-xs text-red-400">{t("marketplace.soldOut")}</div>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleClick(); }}
            disabled={item.status !== "available"}
            className="btn-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

        <div className={`absolute top-2 right-2 px-2 py-1 text-xs font-bold rounded border ${typeColor}`}>
          {t(`marketplace.type.${item.type}`)}
        </div>

        {item.status === "sold" && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white font-bold text-sm">{t("marketplace.soldOut")}</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors mb-1">
          {item.name}
        </h3>

        {shortDescription && (
          <p className="text-xs text-text-secondary line-clamp-2 mb-3">
            {shortDescription}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="text-lg font-bold text-primary">
            {formatLotPrice(item.price)}
          </div>
          <span className="text-xs text-text-muted">TNJ</span>
        </div>

        {item.status === "available" && (
          <div className="mt-2 text-xs text-green-400 text-center">
            {t("marketplace.available")}
          </div>
        )}
      </div>
    </div>
  );
}