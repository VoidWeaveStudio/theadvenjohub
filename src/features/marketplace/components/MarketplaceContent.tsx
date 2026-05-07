//src\features\marketplace\components\MarketplaceContent.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { useRouter, useSearchParams } from "next/navigation";
import { MarketplaceItemCard } from "./MarketplaceItemCard";
import { MarketplaceFilters } from "./MarketplaceFilters";
import { MarketplaceItemModal } from "./MarketplaceItemModal";
import { Pagination } from "@/core/ui/Pagination";
import { formatPrice } from "../lib/utils";
import { useStaticConfig } from "@/core/lib/useCachedQuery";
import type { ItemWithGame, PaginationInfo, FiltersState } from "../types";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

function parseFiltersFromUrl(searchParams: URLSearchParams): Partial<FiltersState> {
  const newFilters: Partial<FiltersState> = {};

  if (searchParams.get("search")) newFilters.search = searchParams.get("search")!;
  if (searchParams.get("game")) newFilters.game = searchParams.get("game")!;
  if (searchParams.get("rarity")) newFilters.rarity = searchParams.get("rarity")!.split(",");
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
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { t } = useLanguage();

  const { data: config, isLoading: configLoading } = useStaticConfig(
    "/api/marketplace/config",
    {
      treasuryWallet: "",
      tokenMint: "",
      decimals: "6",
      publicRpc: "https://mainnet.helius-rpc.com",
    }
  );

  const [items, setItems] = useState<ItemWithGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 24,
    total: 0,
    totalPages: 1,
  });

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedItem, setSelectedItem] = useState<ItemWithGame | null>(null);

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

  const [buying, setBuying] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalStatus, setModalStatus] = useState<"idle" | "success" | "error">("idle");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));

      if (filters.search) params.set("search", filters.search);
      if (filters.game) params.set("game", filters.game);
      if (filters.rarity.length > 0) params.set("rarity", filters.rarity.join(","));
      if (filters.type.length > 0) params.set("type", filters.type.join(","));
      if (filters.minPrice) params.set("minPrice", filters.minPrice);
      if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
      params.set("sortBy", filters.sortBy);
      params.set("sortOrder", filters.sortOrder);

      const res = await fetch(`/api/marketplace/items?${params}`);

      if (!res.ok) {
        console.warn("Failed to fetch items:", res.status);
        setItems([]);
        return;
      }

      const data = await res.json();
      setItems(data.items || []);
      setPagination(data.pagination || pagination);
    } catch (error) {
      console.error("Failed to fetch items:", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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

  const handleItemClick = (item: ItemWithGame) => {
    setSelectedItem(item);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
    setModalMessage("");
    setModalStatus("idle");
  };

  const handleBuy = async (item: ItemWithGame) => {
    if (!publicKey) {
      setModalMessage(t("marketplace.connectWallet"));
      setModalStatus("error");
      setSelectedItem(item);
      return;
    }

    if (configLoading || !config) {
      setModalMessage(t("marketplace.loadingConfig"));
      setModalStatus("error");
      return;
    }

    setBuying(true);
    setModalStatus("idle");
    setModalMessage("");

    try {
      if (!config.treasuryWallet || !config.tokenMint || !config.publicRpc) {
        throw new Error(t("marketplace.error.serverConfig"));
      }

      const decimals = parseInt(config.decimals || "6");
      const amount = BigInt(item.price) * BigInt(10 ** decimals);

      const connection = new Connection(config.publicRpc.trim(), {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 30000,
      });

      const treasuryPubkey = new PublicKey(config.treasuryWallet.trim());
      const mintPubkey = new PublicKey(config.tokenMint.trim());

      let userATA: PublicKey | null = null;
      let activeProgramId = TOKEN_PROGRAM_ID;

      const accountsLegacy = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID, mint: mintPubkey },
        "confirmed"
      ).catch(() => ({ value: [] }));

      const foundLegacy = accountsLegacy.value.find(
        (acc: any) => acc.account.data.parsed.info.mint === config.tokenMint
      );

      if (foundLegacy) {
        userATA = foundLegacy.pubkey;
        activeProgramId = TOKEN_PROGRAM_ID;
      } else {
        const accounts2022 = await connection.getParsedTokenAccountsByOwner(
          publicKey,
          { programId: TOKEN_2022_PROGRAM_ID, mint: mintPubkey },
          "confirmed"
        ).catch(() => ({ value: [] }));

        const found2022 = accounts2022.value.find(
          (acc: any) => acc.account.data.parsed.info.mint === config.tokenMint
        );

        if (found2022) {
          userATA = found2022.pubkey;
          activeProgramId = TOKEN_2022_PROGRAM_ID;
        }
      }

      if (!userATA) {
        throw new Error(t("marketplace.error.tokenNotFound"));
      }

      const treasuryATA = await getAssociatedTokenAddress(
        mintPubkey,
        treasuryPubkey,
        true,
        activeProgramId
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

      const transferIx = createTransferInstruction(
        userATA,
        treasuryATA,
        publicKey,
        amount,
        [],
        activeProgramId
      );

      const instructions = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }),
        transferIx,
      ];

      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const tx = new VersionedTransaction(messageV0);

      if (!signTransaction || !sendTransaction) {
        throw new Error(t("marketplace.error.walletUnavailable"));
      }

      setModalMessage(t("marketplace.confirmWallet"));
      const signedTx = await signTransaction(tx);

      const signature = await sendTransaction(signedTx, connection, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      setModalMessage(t("marketplace.verifying"));

      const csrfToken = document.cookie
        .split(";")
        .find((c) => c.trim().startsWith("csrf_token="))
        ?.split("=")[1];

      const res = await fetch("/api/marketplace/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken || "",
        },
        body: JSON.stringify({
          signature,
          itemId: item.id,
          price: item.price,
        }),
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        setModalStatus("success");
        setModalMessage(
          t("marketplace.success").replace("{{amount}}", formatPrice(item.price))
        );

        fetchItems();

        setTimeout(() => {
          handleCloseModal();
        }, 2000);
      } else {
        setModalStatus("error");
        if (data.error === "Transaction signed by wrong wallet") {
          setModalMessage(t("marketplace.error.wrongSigner"));
        } else {
          setModalMessage(data.error || t("marketplace.verificationFailed"));
        }
      }

    } catch (err: any) {
      if (err.message?.includes("User rejected") || err.code === 4001) {
        setModalMessage(t("marketplace.cancelled"));
        setModalStatus("idle");
        return;
      }

      console.error("Purchase error:", err);
      setModalStatus("error");
      setModalMessage(err.message || t("marketplace.transactionFailed"));
    } finally {
      setBuying(false);
    }
  };

  const displayedItems = useMemo(() => items, [items]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          type="text"
          placeholder={t("marketplace.search") || "Search items..."}
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
      ) : displayedItems.length === 0 ? (
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
            {displayedItems.map((item) => (
              <MarketplaceItemCard
                key={item.id}
                item={item}
                viewMode={viewMode}
                onItemClick={handleItemClick}
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

      {selectedItem && (
        <MarketplaceItemModal
          item={selectedItem}
          onClose={handleCloseModal}
          onBuy={handleBuy}
          buying={buying}
          modalMessage={modalMessage}
          modalStatus={modalStatus}
        />
      )}
    </div>
  );
}