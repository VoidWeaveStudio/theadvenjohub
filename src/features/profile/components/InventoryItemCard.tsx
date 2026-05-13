//src\features\profile\components\InventoryItemCard.tsx
"use client";

import { useLanguage } from "@/core/i18n/LanguageContext";

interface InventoryItemCardProps {
  item: {
    id: string;
    lotId: string | null;
    itemName: string;
    itemImage: string | null;
    gameTitle?: string;
    status: string;
  };
}

export function InventoryItemCard({ item }: InventoryItemCardProps) {
  const { t } = useLanguage();

  return (
    <div className="card p-3 border-border bg-surface hover:border-primary/30 transition-all group">
      <div className="aspect-square bg-zinc-800 rounded-lg mb-2 flex items-center justify-center text-4xl overflow-hidden">
        {item.itemImage ? (
          <img
            src={item.itemImage}
            alt={item.itemName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <span>📦</span>
        )}
      </div>

      <p className="text-xs font-medium text-foreground truncate mb-1">
        {item.itemName}
      </p>

      {item.gameTitle && (
        <p className="text-[10px] text-text-secondary truncate mb-2">
          {item.gameTitle}
        </p>
      )}

      <span className={`text-[10px] px-2 py-0.5 rounded inline-block ${item.status === "confirmed"
        ? "bg-green-500/10 text-green-400"
        : item.status === "pending"
          ? "bg-yellow-500/10 text-yellow-400"
          : "bg-red-500/10 text-red-400"
        }`}>
        {t(`profile.status.${item.status}`) || item.status}
      </span>
    </div>
  );
}