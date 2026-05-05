//src\games\warden-abyss\components\WalletModal.tsx
"use client";

import React from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { ICONS } from "../data/icons";
import { useGameLogic } from "../hooks/useGameLogic";

interface WalletModalProps {
  balance: number;
  onClose: () => void;
  onActionSelect: (action: "burn" | "withdraw" | "block") => void;
}

export function WalletModal({ balance, onClose, onActionSelect }: WalletModalProps) {
  const { t } = useLanguage();
  const game = useGameLogic({ 
    wallet: "", 
    onDbLoading: () => {},
    onError: () => {}
  });
  
  const actions = [
    {
      id: "burn" as const,
      labelKey: "actions.burn",
      icon: "🔥",
      color: "var(--color-red)",
      descriptionKey: "wallet.burnDesc",
      threshold: 0,
      bonusKey: "wallet.burnBonus",
      lastTime: game.lastBurnTime,
    },
    {
      id: "withdraw" as const,
      labelKey: "actions.withdraw",
      icon: "💰",
      color: "var(--color-green)",
      descriptionKey: "wallet.withdrawDesc",
      threshold: 50000,
      bonusKey: "wallet.withdrawMin",
      lastTime: game.lastWithdrawTime,
    },
    {
      id: "block" as const,
      labelKey: "actions.block",
      icon: "🔒",
      color: "var(--color-blue)",
      descriptionKey: "wallet.blockDesc",
      threshold: 0,
      bonusKey: "wallet.blockBonus",
      lastTime: game.lastBlockTime,
    },
  ];

  return (
    <div className="game-modal-overlay" onClick={onClose}>
      <div className="game-wallet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="game-wallet-header">
          <h3 className="game-wallet-title">{t("wallet.title")}</h3>
          <button className="game-wallet-close" onClick={onClose} aria-label={t("actions.close")}>✕</button>
        </div>
        
        <div className="game-wallet-balance">
          <span className="game-wallet-balance-label">{t("wallet.available")}:</span>
          <span className="game-wallet-balance-value">
            {balance.toFixed(1)}
            <img src={ICONS.tnjToken} alt="TNJ" className="w-4 h-4 ml-1" />
          </span>
        </div>

        <div className="game-wallet-actions">
          {actions.map((action) => {
            const canAfford = balance >= action.threshold;
            const cooldownRemaining = game.getCooldownRemaining(action.lastTime);
            const isDisabled = !canAfford || cooldownRemaining > 0;
            const cooldownText = game.getCooldownText(action.lastTime);
            
            return (
              <button
                key={action.id}
                className={`game-wallet-action-btn ${isDisabled ? "disabled" : ""}`}
                onClick={() => !isDisabled && onActionSelect(action.id)}
                disabled={isDisabled}
                style={{ borderColor: action.color, opacity: isDisabled ? 0.6 : 1 }}
              >
                <span className="game-wallet-action-icon" style={{ color: action.color }}>{action.icon}</span>
                <div className="game-wallet-action-info">
                  <span className="game-wallet-action-name">{t(action.labelKey)}</span>
                  <span className="game-wallet-action-desc">
                    {cooldownRemaining > 0 
                      ? t("actionCooldown").replace("{time}", cooldownText)
                      : t(action.descriptionKey)
                    }
                  </span>
                </div>
                <span className="game-wallet-action-arrow">→</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}