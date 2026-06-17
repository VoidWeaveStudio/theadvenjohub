// src/features/marketplace/components/MarketplaceItemModal.tsx
"use client";

import { Modal } from "@/core/ui/Modal";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { formatLotPrice } from "../lib/utils";
import { PurchaseButton } from "@/features/shared/PurchaseButton";
import { LoginButton } from "@/core/auth/components/LoginButton";
import { useAuth } from "@/core/auth/AuthProvider";
import type { LotWithGame } from "../types";

interface MarketplaceItemModalProps {
  item: LotWithGame;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MarketplaceItemModal({
  item,
  onClose,
  onSuccess,
}: MarketplaceItemModalProps) {
  const { t } = useLanguage();
  const { isAuthorized } = useAuth();

  const typeColors: Record<string, string> = {
    standard: "border-gray-400 text-gray-400",
    premium: "border-blue-500 text-blue-500",
    rare: "border-purple-500 text-purple-500",
    legendary: "border-yellow-500 text-yellow-500",
  };

  const typeColor = typeColors[item.type] || typeColors.standard;
  const fullDescription = t("marketplace.lots.legendary.description") || t("marketplace.noDescription");

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
            <span className={`px-3 py-1 text-xs font-bold rounded border uppercase tracking-wide ${typeColor}`}>
              {t(`marketplace.type.${item.type}`)}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded ${item.status === "available"
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
              }`}>
              {t(`marketplace.status.${item.status}`)}
            </span>
          </div>

          <p className="text-text-secondary text-sm leading-relaxed flex-1">
            {fullDescription}
          </p>

          <div className="p-4 bg-surface rounded-lg border border-border">
            <div className="text-xs text-text-secondary mb-1 uppercase tracking-wide">{t("marketplace.priceLabel")}</div>
            <div className="text-2xl font-bold text-primary">
              {formatLotPrice(item.price)} TNJ
            </div>
          </div>

          {item.status === "available" ? (
            isAuthorized ? (
              <PurchaseButton
                lotId={item.id}
                price={item.price}
                isLot={true}
                onSuccess={() => {
                  onSuccess?.();
                  onClose();
                }}
              />
            ) : (
              <div className="space-y-2">
                <LoginButton className="w-full" />
                <p className="text-xs text-text-secondary text-center">
                  {t("purchase.connectWalletHint") || "Connect your wallet to purchase"}
                </p>
              </div>
            )
          ) : (
            <button
              disabled
              className="btn-primary w-full py-3 text-base font-bold opacity-50 cursor-not-allowed"
            >
              {t("marketplace.soldOut")}
            </button>
          )}

        </div>
      </div>
    </Modal>
  );
}