//src\features\marketplace\components\MarketplaceItemModal.tsx
"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/core/ui/Modal";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { formatPrice } from "../lib/utils";
import type { ItemWithGame } from "../types";

interface MarketplaceItemModalProps {
  item: ItemWithGame;
  onClose: () => void;
  onBuy: (item: ItemWithGame) => Promise<void>;
  buying: boolean;
  modalMessage: string;
  modalStatus: "idle" | "success" | "error";
}

interface ItemStats {
  totalSales: number;
  avgPrice: number;
  lastSalePrice: number;
  floorPrice: number;
  volume24h: number;
}

export function MarketplaceItemModal({
  item,
  onClose,
  onBuy,
  buying,
  modalMessage,
  modalStatus,
}: MarketplaceItemModalProps) {
  const { t } = useLanguage();
  const [stats, setStats] = useState<ItemStats>({
    totalSales: 0,
    avgPrice: 0,
    lastSalePrice: 0,
    floorPrice: item.price,
    volume24h: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        setLoadingStats(true);
        const res = await fetch(`/api/marketplace/items/${item.id}/stats`);

        if (!res.ok) throw new Error("Failed to fetch stats");

        const data = await res.json();

        if (!cancelled) {
          setStats({
            totalSales: data.totalSales || 0,
            avgPrice: data.avgPrice || 0,
            lastSalePrice: data.lastSalePrice || 0,
            floorPrice: data.floorPrice || item.price,
            volume24h: data.volume24h || 0,
          });
        }
      } catch (error) {
        console.debug("Stats not available yet:", error);
        if (!cancelled) {
          setStats({
            totalSales: 0,
            avgPrice: item.price,
            lastSalePrice: 0,
            floorPrice: item.price,
            volume24h: 0,
          });
        }
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    };

    loadStats();

    return () => { cancelled = true; };
  }, [item.id, item.price]);

  const handleBuy = async () => await onBuy(item);

  const rarityColors: Record<string, string> = {
    common: "border-gray-400 text-gray-400",
    rare: "border-blue-500 text-blue-500",
    epic: "border-purple-500 text-purple-500",
    legendary: "border-yellow-500 text-yellow-500",
  };

  const rarityColor = rarityColors[item.rarity] || rarityColors.common;

  return (
    <Modal isOpen={true} onClose={onClose} title={item.name} size="xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[85vh] overflow-y-auto pr-2">
        <div className="aspect-square bg-surface rounded-lg overflow-hidden flex-shrink-0">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div className={`w-full h-full flex items-center justify-center text-8xl ${item.imageUrl ? "hidden" : ""}`} aria-label={t("marketplace.noImage")}>
            📦
          </div>
        </div>

        <div className="space-y-4 flex flex-col">
          {item.game && (
            <div className="text-sm text-text-secondary">
              {t("marketplace.gameLabel")}:{" "}
              <span className="text-foreground font-medium hover:text-primary cursor-pointer transition-colors">
                {item.game.title}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 text-xs font-bold rounded border uppercase tracking-wide ${rarityColor}`}>
              {t(`marketplace.rarity.${item.rarity}`)}
            </span>
            <span className="px-3 py-1 text-xs text-text-secondary border border-border rounded capitalize">
              {t(`marketplace.type.${item.type}`)}
            </span>
          </div>

          <p className="text-text-secondary text-sm leading-relaxed flex-1">
            {item.description || t("marketplace.noDescription")}
          </p>

          <div className="p-4 bg-surface rounded-lg border border-border">
            <div className="text-xs text-text-secondary mb-1 uppercase tracking-wide">{t("marketplace.priceLabel")}</div>
            <div className="text-2xl font-bold text-primary">
              {formatPrice(item.price)} TNJ
            </div>
            {stats.floorPrice !== item.price && stats.floorPrice > 0 && (
              <div className="text-xs text-text-muted mt-1">
                {t("marketplace.floorPriceLabel")}: {formatPrice(stats.floorPrice)} {t("marketplace.currencyShort")}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-surface rounded-lg border border-border">
              <div className="text-xs text-text-secondary mb-1">{t("marketplace.stats.totalSales")}</div>
              {loadingStats ? (
                <div className="h-5 w-12 bg-surface-elevated rounded animate-pulse" />
              ) : (
                <div className="text-lg font-bold text-foreground">{stats.totalSales.toLocaleString()}</div>
              )}
            </div>
            <div className="p-3 bg-surface rounded-lg border border-border">
              <div className="text-xs text-text-secondary mb-1">{t("marketplace.stats.avgPrice")}</div>
              {loadingStats ? (
                <div className="h-5 w-16 bg-surface-elevated rounded animate-pulse" />
              ) : (
                <div className="text-lg font-bold text-foreground">{formatPrice(stats.avgPrice)}</div>
              )}
            </div>
            <div className="p-3 bg-surface rounded-lg border border-border">
              <div className="text-xs text-text-secondary mb-1">{t("marketplace.stats.lastSale")}</div>
              {loadingStats ? (
                <div className="h-5 w-16 bg-surface-elevated rounded animate-pulse" />
              ) : stats.lastSalePrice > 0 ? (
                <div className="text-lg font-bold text-foreground">{formatPrice(stats.lastSalePrice)}</div>
              ) : (
                <div className="text-sm text-text-muted">—</div>
              )}
            </div>
            <div className="p-3 bg-surface rounded-lg border border-border">
              <div className="text-xs text-text-secondary mb-1">{t("marketplace.stats.volume24h")}</div>
              {loadingStats ? (
                <div className="h-5 w-16 bg-surface-elevated rounded animate-pulse" />
              ) : (
                <div className="text-lg font-bold text-foreground">{formatPrice(stats.volume24h)}</div>
              )}
            </div>
          </div>

          {item.stock > 0 && item.stock < 5 && (
            <div className="text-xs text-orange-400 font-medium">
              🔥 {item.stock} {t("marketplace.leftInStock")}
            </div>
          )}
          {item.stock === 0 && (
            <div className="text-xs text-green-400 font-medium">
              {t("marketplace.unlimitedStock")}
            </div>
          )}

          {modalMessage && (
            <div className={`p-3 rounded text-sm font-medium ${modalStatus === "success" ? "bg-green-500/10 text-green-400 border border-green-500/30" :
                modalStatus === "error" ? "bg-red-500/10 text-red-400 border border-red-500/30" :
                  "bg-primary/10 text-primary border border-primary/30"
              }`}>
              {modalStatus === "idle" ? t("marketplace.confirmWallet") : modalMessage}
            </div>
          )}

          <button
            onClick={handleBuy}
            disabled={buying || item.stock === 0}
            className="btn-primary w-full py-3 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
            aria-label={item.stock === 0 ? t("marketplace.outOfStock") : `${t("marketplace.buy")} ${formatPrice(item.price)} TNJ`}
          >
            {buying ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t("marketplace.processing")}
              </span>
            ) : item.stock === 0 ? (
              t("marketplace.outOfStock")
            ) : (
              `${t("marketplace.buy")} ${formatPrice(item.price)} TNJ`
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}