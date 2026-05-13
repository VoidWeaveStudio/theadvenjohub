//src\features\marketplace\components\MarketplaceContent.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { useRouter, useSearchParams } from "next/navigation";
import { MarketplaceItemCard } from "./MarketplaceItemCard";
import { MarketplaceFilters } from "./MarketplaceFilters";
import { MarketplaceItemModal } from "./MarketplaceItemModal";
import { Pagination } from "@/core/ui/Pagination";
import { useStaticConfig } from "@/core/lib/useCachedQuery";
import type { LotWithGame, PaginationInfo, FiltersState } from "../types";

function parseFiltersFromUrl(searchParams: URLSearchParams): Partial<FiltersState> {
  const newFilters: Partial<FiltersState> = {};

  if (searchParams.get("search")) newFilters.search = searchParams.get("search")!;
  if (searchParams.get("game")) newFilters.game = searchParams.get("game")!;
  if (searchParams.get("type")) newFilters.type = searchParams.get("type")!.split(",");
  if (searchParams.get("minPrice")) newFilters.minPrice = searchParams.get("minPrice")!;
  if (searchParams.get("maxPrice")) newFilters.maxPrice = searchParams.get("maxPrice")!;
  if (searchParams.get("sortBy")) newFilters.sortBy = searchParams.get("sortBy")!;
  if (searchParams.get("sortOrder") === "asc" || searchParams.get("sortOrder") === "desc") {
    newFilters.sortOrder = searchParams.get("sortOrder") as "asc" | "desc";
  }

  return newFilters;
}

export default function MarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  const [lots, setLots] = useState<LotWithGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 24,
    total: 0,
    totalPages: 1,
  });

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedLot, setSelectedLot] = useState<LotWithGame | null>(null);

  const [filters, setFilters] = useState<FiltersState>(() => ({
    search: "",
    game: "",
    rarity: [],
    type: [],
    minPrice: "",
    maxPrice: "",
    sortBy: "createdAt",
    sortOrder: "desc",
    ...parseFiltersFromUrl(searchParams),
  }));

  const fetchLots = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));

      if (filters.search) params.set("search", filters.search);
      if (filters.game) params.set("game", filters.game);
      if (filters.type.length > 0) params.set("type", filters.type.join(","));
      if (filters.minPrice) params.set("minPrice", filters.minPrice);
      if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
      params.set("sortBy", filters.sortBy);
      params.set("sortOrder", filters.sortOrder);

      const res = await fetch(`/api/marketplace/lots?${params}`);

      if (!res.ok) {
        console.warn("Failed to fetch lots:", res.status);
        setLots([]);
        return;
      }

      const data = await res.json();
      setLots(data.lots || []);
      setPagination(data.pagination || pagination);
    } catch (error) {
      console.error("Failed to fetch lots:", error);
      setLots([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchLots();
  }, [fetchLots]);

  const updateFilters = useCallback((newFilters: Partial<FiltersState>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === "" || value === null || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else if (Array.isArray(value)) {
        params.set(key, value.join(","));
      } else {
        params.set(key, String(value));
      }
    });

    params.set("page", "1");

    router.push(`/marketplace?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFilterChange = (newFilters: Partial<FiltersState>) => {
    updateFilters(newFilters);
  };

  const handleLotClick = (lot: LotWithGame) => {
    setSelectedLot(lot);
  };

  const handleCloseModal = () => {
    setSelectedLot(null);
  };

  const handlePurchaseSuccess = useCallback(() => {
    fetchLots();
    handleCloseModal();
  }, [fetchLots]);

  const displayedLots = useMemo(() => lots, [lots]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          type="text"
          placeholder={t("marketplace.search")}
          value={filters.search}
          onChange={(e) => handleFilterChange({ search: e.target.value })}
          className="input-field flex-1 min-w-[200px]"
        />

        <div className="flex items-center gap-2 sm:ml-auto">
          <MarketplaceFilters
            filters={filters}
            onFilterChange={handleFilterChange}
          />

          <div className="hidden sm:flex items-center gap-1 p-1 bg-surface border border-border rounded-lg">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-md transition-all ${viewMode === "grid"
                ? "bg-primary text-white shadow-md"
                : "text-text-secondary hover:text-foreground"
                }`}
              aria-label={t("marketplace.gridView")}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-md transition-all ${viewMode === "list"
                ? "bg-primary text-white shadow-md"
                : "text-text-secondary hover:text-foreground"
                }`}
              aria-label={t("marketplace.listView")}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayedLots.length === 0 ? (
        <div className="text-center text-text-secondary py-12">
          <p className="text-lg mb-2">🛒 {t("marketplace.empty")}</p>
          <p className="text-sm">{t("marketplace.emptyHint")}</p>
        </div>
      ) : (
        <>
          <div className={
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
              : "space-y-4"
          }>
            {displayedLots.map((lot) => (
              <MarketplaceItemCard
                key={lot.id}
                item={lot}
                viewMode={viewMode}
                onItemClick={handleLotClick}
              />
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}

      {selectedLot && (
        <MarketplaceItemModal
          item={selectedLot}
          onClose={handleCloseModal}
          onSuccess={handlePurchaseSuccess}
        />
      )}
    </div>
  );
}