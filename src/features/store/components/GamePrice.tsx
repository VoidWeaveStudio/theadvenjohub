"use client";

import { useLanguage } from "@/core/i18n/LanguageContext";

interface GamePriceProps {
  price: number;
  priceCurrency?: string;
  priceUsdCents?: number;
  priceUnavailable?: boolean;
  large?: boolean;
}

export function GamePrice({ price, priceCurrency, priceUsdCents = 0, priceUnavailable = false, large = false }: GamePriceProps) {
  const { t } = useLanguage();

  const inUsdt = priceCurrency === "usdt";
  const free = !priceUnavailable && price <= 0;

  const label = priceUnavailable
    ? t("game.priceUnavailable")
    : free
      ? t("game.free")
      : `${inUsdt ? "≈ " : ""}${price.toLocaleString("en-US")} TNJ`;

  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={`font-bold ${large ? "text-2xl" : "text-lg"} ${free ? "text-green-400" : "text-primary"}`}>
        {label}
      </span>
      {inUsdt && !priceUnavailable && priceUsdCents > 0 && (
        <span className="text-sm text-text-secondary">${(priceUsdCents / 100).toFixed(2)}</span>
      )}
    </div>
  );
}
