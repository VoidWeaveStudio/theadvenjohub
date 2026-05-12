// src/features/store/components/GameCard.tsx
"use client";

import { useState } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { GameDetailModal } from "./GameDetailsModal";

interface GameCardProps {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  price: number;
  isOwned?: boolean;
}

export function GameCard({
  id,
  slug,
  title,
  description,
  coverImage,
  price,
  isOwned = false,
}: GameCardProps) {
  const { t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className="group bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden hover:border-primary/50 transition-all cursor-pointer hover:shadow-[0_0_25px_rgba(59,130,246,0.15)]"
      >
        <div className="h-48 bg-zinc-800 relative overflow-hidden">
          {coverImage ? (
            <img 
              src={coverImage} 
              alt={title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl text-zinc-600">
              🎮
            </div>
          )}
          
          {isOwned && (
            <div className="absolute top-3 right-3 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md">
              ✓ {t("store.owned")}
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 to-transparent" />
        </div>

        <div className="p-4">
          <h3 className="text-lg font-bold text-foreground mb-2 truncate">
            {title}
          </h3>
          
          <p className="text-xs text-text-secondary line-clamp-2 mb-4 min-h-[2.5rem]">
            {description || t("store.noDescription")}
          </p>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-primary">
              {price > 0 ? `${(price / 1_000_000).toFixed(2)} TNJ` : "Free"}
            </span>
            <span className="text-[10px] text-text-muted flex items-center gap-1">
              💻 {t("store.desktopOnly")}
            </span>
          </div>
        </div>
      </div>

      <GameDetailModal
        slug={slug}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPurchaseSuccess={() => {}}
      />
    </>
  );
}