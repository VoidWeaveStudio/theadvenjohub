//src\features\marketplace\components\MarketplaceFilters.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import type { FiltersState } from "../types";

interface MarketplaceFiltersProps {
  filters: FiltersState;
  onFilterChange: (filters: Partial<FiltersState>) => void;
}

export function MarketplaceFilters({ filters, onFilterChange }: MarketplaceFiltersProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeFiltersCount = [
    filters.sortBy !== "createdAt" || filters.sortOrder !== "desc",
    filters.rarity.length > 0,
  ].filter(Boolean).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
          isOpen
            ? "bg-primary/10 border-primary text-primary"
            : "bg-surface border-border text-text-secondary hover:text-foreground hover:bg-surface/80"
        }`}
        aria-label="Filters"
        aria-expanded={isOpen}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <span className="hidden sm:inline font-medium">Filters</span>
        {activeFiltersCount > 0 && (
          <span className="flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-primary rounded-full">
            {activeFiltersCount}
          </span>
        )}
        <svg className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t("marketplace.sortBy") || "Sort by"}
              </label>
              <select
                value={`${filters.sortBy}:${filters.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split(":");
                  onFilterChange({ sortBy, sortOrder: sortOrder as "asc" | "desc" });
                }}
                className="input-field w-full"
              >
                <option value="createdAt:desc">{t("marketplace.sort.newest")}</option>
                <option value="createdAt:asc">{t("marketplace.sort.oldest")}</option>
                <option value="price:asc">{t("marketplace.sort.priceAsc")}</option>
                <option value="price:desc">{t("marketplace.sort.priceDesc")}</option>
                <option value="name:asc">{t("marketplace.sort.nameAsc")}</option>
                <option value="name:desc">{t("marketplace.sort.nameDesc")}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t("marketplace.rarity") || "Rarity"}
              </label>
              <select
                value={filters.rarity[0] || ""}
                onChange={(e) => onFilterChange({ 
                  rarity: e.target.value ? [e.target.value] : [] 
                })}
                className="input-field w-full"
              >
                <option value="">{t("marketplace.sort.allRarities")}</option>
                <option value="common">{t("marketplace.rarity.common")}</option>
                <option value="rare">{t("marketplace.rarity.rare")}</option>
                <option value="epic">{t("marketplace.rarity.epic")}</option>
                <option value="legendary">{t("marketplace.rarity.legendary")}</option>
              </select>
            </div>

            <button
              onClick={() => {
                onFilterChange({
                  sortBy: "createdAt",
                  sortOrder: "desc",
                  rarity: [],
                });
              }}
              className="w-full py-2 text-sm text-text-secondary hover:text-foreground border border-border rounded-lg hover:bg-surface/50 transition-colors"
            >
              {t("marketplace.resetFilters") || "Reset filters"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}