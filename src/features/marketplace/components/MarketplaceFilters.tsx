//src\features\marketplace\components\MarketplaceFilters.tsx
"use client";

import { useLanguage } from "@/core/i18n/LanguageContext";
import type { FiltersState } from "../types";

interface MarketplaceFiltersProps {
  filters: FiltersState;
  onFilterChange: (filters: Partial<FiltersState>) => void;
}

export function MarketplaceFilters({ filters, onFilterChange }: MarketplaceFiltersProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-wrap gap-3">
      <input
        type="text"
        placeholder={t("marketplace.search") || "Search items..."}
        value={filters.search}
        onChange={(e) => onFilterChange({ search: e.target.value })}
        className="input-field w-full sm:w-64"
      />

      <select
  value={`${filters.sortBy}:${filters.sortOrder}`}
  onChange={(e) => {
    const [sortBy, sortOrder] = e.target.value.split(":");
    onFilterChange({ sortBy, sortOrder: sortOrder as "asc" | "desc" });
  }}
  className="input-field w-full sm:w-48"
>
  <option value="createdAt:desc">{t("marketplace.sort.newest")}</option>
  <option value="createdAt:asc">{t("marketplace.sort.oldest")}</option>
  <option value="price:asc">{t("marketplace.sort.priceAsc")}</option>
  <option value="price:desc">{t("marketplace.sort.priceDesc")}</option>
  <option value="name:asc">{t("marketplace.sort.nameAsc")}</option>
  <option value="name:desc">{t("marketplace.sort.nameDesc")}</option>
</select>

      <select
  value={filters.rarity[0] || ""}
  onChange={(e) => onFilterChange({ 
    rarity: e.target.value ? [e.target.value] : [] 
  })}
  className="input-field w-full sm:w-40"
>
  <option value="">{t("marketplace.sort.allRarities")}</option>
  <option value="common">{t("marketplace.rarity.common")}</option>
  <option value="rare">{t("marketplace.rarity.rare")}</option>
  <option value="epic">{t("marketplace.rarity.epic")}</option>
  <option value="legendary">{t("marketplace.rarity.legendary")}</option>
</select>
    </div>
  );
}