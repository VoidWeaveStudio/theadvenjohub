//src\features\profile\components\InventoryItemCard.tsx
"use client";

import { useLanguage } from "@/core/i18n/LanguageContext";

interface InventoryItemCardProps {
  item: {
    id: string;
    lotId: string | null;
    status: string;
    acquiredAt: string;
  };
}

export function InventoryItemCard({ item }: InventoryItemCardProps) {
  const { t } = useLanguage();

  return (
    <div className="card p-3 border-border bg-surface hover:border-primary/30 transition-all">
      <div className="aspect-square bg-zinc-800 rounded-lg mb-2 flex items-center justify-center text-4xl">
        📦
      </div>
      <p className="text-xs text-text-secondary truncate">
        {t("profile.acquiredLabel")} {new Date(item.acquiredAt).toLocaleDateString()}
      </p>
      <span className={`text-[10px] px-2 py-0.5 rounded mt-1 inline-block ${
        item.status === "confirmed" ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"
      }`}>
        {item.status}
      </span>
    </div>
  );
}