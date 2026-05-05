//src\games\warden-abyss\components\UpgradeList.tsx
"use client";

import { Upgrade, calculateUpgradeCost } from "../data/upgrades";
import { ICONS } from "../data/icons";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface Props {
  upgrades: Upgrade[];
  balance: number;
  onBuy: (id: string) => void;
}

export function UpgradeList({ upgrades, balance, onBuy }: Props) {
  const { t } = useLanguage();
  
  return (
    <div className="space-y-3">
      <h3 className="game-section-title">
        <img src={ICONS.upgrades} alt="" className="w-5 h-5" />
        {t("tabs.upgrades") || "Upgrades"}
      </h3>
      {upgrades.map((upgrade) => {
        const isMaxed = upgrade.level >= upgrade.maxLevel;
        const cost = isMaxed ? -1 : calculateUpgradeCost(upgrade.baseCost, upgrade.costMultiplier, upgrade.level);
        const canAfford = balance >= cost;

        return (
          <div key={upgrade.id} className="game-upgrade-card">
            <div className="game-upgrade-info">
              <h4>
                {t(upgrade.nameKey) || upgrade.nameKey}
                {upgrade.maxLevel > 1 && (
                  <span className="level"> {upgrade.level}/{upgrade.maxLevel}</span>
                )}
              </h4>
              <p>{t(upgrade.descriptionKey) || upgrade.descriptionKey}</p>
              {!upgrade.isAuto && (
                <span className="text-emerald-400 text-xs">+{upgrade.damageBonusPercent}% {t("stats.damage") || "damage"}</span>
              )}
            </div>
            <button
              className={`game-upgrade-buy ${isMaxed ? "maxed" : ""}`}
              onClick={() => !isMaxed && onBuy(upgrade.id)}
              disabled={isMaxed || !canAfford}
              title={isMaxed ? (t("upgrades.maxed") || "Max level") : !canAfford ? (t("upgrades.notEnough") || "Not enough") : (t("actions.buy") || "Buy")}
            >
              {isMaxed ? (
                <span className="text-emerald-400 font-bold">MAX</span>
              ) : (
                <span className="flex items-center gap-1">
                  {cost.toLocaleString()}
                  <img src={ICONS.tnjToken} alt="TNJ" className="w-4 h-4" />
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}