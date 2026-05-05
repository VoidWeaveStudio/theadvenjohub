//src\games\warden-abyss\components\BottomActions.tsx
"use client";
import { useState } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface BottomActionsProps {
  onReset: () => void;
}

export function BottomActions({ onReset }: BottomActionsProps) {
  const { t } = useLanguage();
  const [confirming, setConfirming] = useState<string | null>(null);

  const actions = [
    { id: "withdraw", labelKey: "actions.withdraw", color: "from-emerald-700 to-emerald-900", icon: "💰" },
    { id: "burn", labelKey: "actions.burn", color: "from-orange-700 to-orange-900", icon: "🔥" },
    { id: "block", labelKey: "actions.block", color: "from-red-700 to-red-900", icon: "🔒" },
  ];

  const handleAction = (id: string) => {
    if (!confirming) {
      setConfirming(id);
      setTimeout(() => setConfirming(null), 3000);
    } else if (confirming === id) {
      onReset();
      setConfirming(null);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {actions.map(a => (
        <button
          key={a.id}
          onClick={() => handleAction(a.id)}
          className={`group relative py-3 px-2 rounded-xl font-bold text-xs sm:text-sm text-white transition-all transform active:scale-95 bg-gradient-to-b ${a.color} shadow-lg border-2 border-zinc-600 hover:border-zinc-500 overflow-hidden`}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
          <div className="relative flex flex-col items-center gap-1">
            <span className="text-lg sm:text-xl drop-shadow-lg">{a.icon}</span>
            <span className="uppercase tracking-wide">{confirming === a.id ? "⚠️" : t(a.labelKey)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}