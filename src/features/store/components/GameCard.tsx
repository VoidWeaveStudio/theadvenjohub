// src/features/store/components/GameCard.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface GameCardProps {
  id: string;
  slug: string;
  title: string;
  coverImage: string | null;
  publisher: string | null;
  price: number;
}

export function GameCard({ id, slug, title, coverImage, publisher, price }: GameCardProps) {
  const { t } = useLanguage();

  const formatPrice = (price: number) => {
    if (price <= 0) return t("game.free") || "Free";
    return `${price.toLocaleString("en-US")} TNJ`;
  };

  return (
    <Link
      href={`/games/${slug}`}
      className="group card overflow-hidden hover:border-primary/50 transition-all"
    >
      <div className="aspect-video relative overflow-hidden">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-surface flex items-center justify-center text-6xl">
            🎮
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="p-4 space-y-2">
        <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
          {title}
        </h3>

        {publisher && (
          <p className="text-sm text-text-secondary">{publisher}</p>
        )}

        <div className="flex items-center justify-between pt-2">
          <span className="text-lg font-bold text-primary">
            {formatPrice(price)}
          </span>
        </div>
      </div>
    </Link>
  );
}