//src\games\warden-abyss\components\ActionConfirmModal.tsx
"use client";

import { useLanguage } from "@/core/i18n/LanguageContext";
import { ICONS } from "../data/icons";

interface ActionConfirmModalProps {
  action: "burn" | "withdraw" | "block";
  amount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ActionConfirmModal({ action, amount, onConfirm, onCancel }: ActionConfirmModalProps) {
  const { t } = useLanguage();
  
  const ACTION_DATA = {
    burn: {
      titleKey: "modal.confirm.burnTitle",
      icon: "🔥",
      color: "var(--color-red)",
      descriptionKey: amount >= 50000 ? "modal.confirm.burnDescBonus" : "modal.confirm.burnDesc",
      confirmKey: "actions.burn",
    },
    withdraw: {
      titleKey: "modal.confirm.withdrawTitle",
      icon: "💰",
      color: "var(--color-green)",
      descriptionKey: "modal.confirm.withdrawDesc",
      confirmKey: "actions.withdraw",
    },
    block: {
      titleKey: "modal.confirm.blockTitle",
      icon: "🔒",
      color: "var(--color-blue)",
      descriptionKey: amount >= 50000 ? "modal.confirm.blockDescBonus" : "modal.confirm.blockDesc",
      confirmKey: "actions.block",
    },
  };

  const data = ACTION_DATA[action];
  const qualifiesForBonus = amount >= 50000;

  return (
    <div className="game-modal-overlay" onClick={onCancel}>
      <div className="game-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="game-confirm-icon" style={{ color: data.color }}>{data.icon}</div>
        <h3 className="game-confirm-title">{t(data.titleKey)}</h3>
        
        <div className="game-confirm-amount">
          <span className="game-confirm-amount-label">{t("modal.confirm.amountLabel")}</span>
          <span className="game-confirm-amount-value">
            {amount.toFixed(1)}
            <img src={ICONS.tnjToken} alt="TNJ" className="w-4 h-4 ml-1" />
          </span>
        </div>

        <p className="game-confirm-description">{t(data.descriptionKey)}</p>

        {qualifiesForBonus && (
          <div className="game-confirm-bonus-badge">
            🎁 {t("modal.confirm.bonusActive")}
          </div>
        )}

        <div className="game-confirm-actions">
          <button className="game-confirm-btn cancel" onClick={onCancel}>
            {t("actions.cancel")}
          </button>
          <button 
            className="game-confirm-btn confirm" 
            onClick={onConfirm}
            style={{ backgroundColor: data.color }}
          >
            {t(data.confirmKey)}
          </button>
        </div>
      </div>
    </div>
  );
}