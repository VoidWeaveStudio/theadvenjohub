"use client";

import { useLanguage } from "@/core/i18n/LanguageContext";

export type GameStatus = "development" | "released" | "coming_soon" | "maintenance";

const STATUS_LABEL_KEYS: Record<GameStatus, string> = {
  development: "game.status.development",
  released: "game.status.released",
  coming_soon: "game.status.coming_soon",
  maintenance: "game.status.maintenance",
};

const STATUS_TONES: Record<GameStatus, string> = {
  development: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  released: "bg-green-500/10 text-green-400 border-green-500/30",
  coming_soon: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  maintenance: "bg-orange-500/10 text-orange-400 border-orange-500/30",
};

const STATUS_DOTS: Record<GameStatus, string> = {
  development: "bg-yellow-400",
  released: "bg-green-400",
  coming_soon: "bg-blue-400",
  maintenance: "bg-orange-400",
};

const STATUS_RANK: Record<GameStatus, number> = {
  released: 0,
  maintenance: 1,
  coming_soon: 2,
  development: 3,
};

export function normalizeGameStatus(status: string | null | undefined): GameStatus {
  if (status === "active") return "released";
  return status && status in STATUS_LABEL_KEYS ? (status as GameStatus) : "development";
}

export function gameStatusRank(status: string | null | undefined): number {
  return STATUS_RANK[normalizeGameStatus(status)];
}

interface GameStatusChipProps {
  status: string | null | undefined;
  size?: "sm" | "md";
  overlay?: boolean;
}

export function GameStatusChip({ status, size = "sm", overlay = false }: GameStatusChipProps) {
  const { t } = useLanguage();
  const normalized = normalizeGameStatus(status);
  const label = t(STATUS_LABEL_KEYS[normalized]);

  if (overlay) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/65 px-2 py-1 text-[11px] font-semibold leading-none text-white backdrop-blur-sm">
        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[normalized]}`} />
        {label}
      </span>
    );
  }

  const dims = size === "sm" ? "rounded-full px-2 py-1 text-[11px]" : "rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base";

  return (
    <span className={`inline-flex items-center border font-semibold leading-none ${STATUS_TONES[normalized]} ${dims}`}>
      {label}
    </span>
  );
}
