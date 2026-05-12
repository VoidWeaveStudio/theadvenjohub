//src\features\profile\components\InventoryTabs.tsx
"use client";

import { useState, useEffect } from "react";
import { apiGet } from "@/core/api/client";
import { Spinner } from "@/core/ui/Spinner"; 
import { InventoryItemCard } from "./InventoryItemCard"; 
import { useLanguage } from "@/core/i18n/LanguageContext";

interface InventoryTabsProps {
  games: Array<{ id: string; slug: string; title: string }>;
}

export function InventoryTabs({ games }: InventoryTabsProps) {
  const { t } = useLanguage();
  const [selectedGame, setSelectedGame] = useState<string>(games[0]?.id || "");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedGame) return;
    setLoading(true);
    apiGet(`/api/user/inventory?gameId=${selectedGame}`)
      .then((data: any) => setItems(data.items || []))
      .finally(() => setLoading(false));
  }, [selectedGame]);

  return (
    <div>
      <select 
        value={selectedGame} 
        onChange={(e) => setSelectedGame(e.target.value)}
        className="input-field mb-4"
      >
        {games.map(g => (
          <option key={g.id} value={g.id}>{g.title}</option>
        ))}
      </select>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <p className="text-text-secondary">{t("profile.noItems")}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {items.map((item) => (
            <InventoryItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}