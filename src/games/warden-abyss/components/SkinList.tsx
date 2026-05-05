//src\games\warden-abyss\components\SkinList.tsx
"use client";

import { useLanguage } from "@/core/i18n/LanguageContext";
import { Skin, calculateSkinCost } from "../data/skins";
import { ICONS } from "../data/icons";

interface Props {
  skins: Skin[];
  balance: number;
  onBuy: (id: string) => void;
}

export function SkinList({ skins, balance, onBuy }: Props) {
  const { t } = useLanguage();

  return (
    <div className="space-y-3">
      <h3 className="game-section-title">
        <img src={ICONS.skins} alt="" className="w-5 h-5" />
        {t("tabs.skins")}
      </h3>
      <div className="flex flex-col gap-2">
        {skins.map((skin) => {
          const isOwned = skin.owned;
          const cost = isOwned ? -1 : calculateSkinCost(skin.baseCost);
          const canAfford = balance >= cost;

          return (
            <button
              key={skin.id}
              onClick={() => {
                if (!isOwned && canAfford) onBuy(skin.id);
              }}
              disabled={isOwned || !canAfford}
              className={`game-skin-card-list ${isOwned ? "owned" : ""} ${skin.rarity === "legendary" ? "legendary" : ""}`}
              title={isOwned ? t("skins.owned") : !canAfford ? t("skins.notEnough") : t("actions.buy")}
            >
              <div className="game-skin-preview-list" style={{ backgroundColor: skin.color }} />
              <div className="game-skin-info">
                <div className="game-skin-name">{t(skin.nameKey)}</div>
                <div className="game-skin-bonus">+{skin.bonusPercent}% {t("stats.damage")}</div>
                <div className="game-skin-desc">{t(skin.descriptionKey)}</div>
              </div>
              <div className="game-skin-action">
                {isOwned ? (
                  <span className="text-emerald-400 font-bold text-sm">{t("skins.owned")}</span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-400 font-bold text-sm">
                    {cost.toLocaleString()}
                    <img src={ICONS.tnjToken} alt="TNJ" className="w-4 h-4" />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}