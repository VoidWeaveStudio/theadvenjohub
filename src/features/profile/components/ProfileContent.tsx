//src\features\profile\components\ProfileContent.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { apiGet } from "@/core/api/client";
import { performLogout } from "@/core/auth/lib/logout";
import { Spinner } from "@/core/ui/Spinner";
import { EmptyState } from "@/core/ui/EmptyState";

interface LibraryGame {
  id: string;
  gameId: string;
  title: string;
  slug: string;
  coverImage: string | null;
  purchasedAt: string;
  status: "owned" | "expired" | "revoked";
}

interface InventoryItem {
  id: string;
  lotId: string | null;
  itemName?: string;
  itemImage?: string | null;
  gameTitle?: string;
  acquiredAt: string;
  status: "confirmed" | "pending" | "failed";
}

type TabId = "library" | "inventory" | "settings";

export default function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { disconnect } = useWallet();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<TabId>("library");

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const [libraryGames, setLibraryGames] = useState<LibraryGame[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [selectedInventoryGame, setSelectedInventoryGame] = useState<string>("all");

  useEffect(() => {
    const tab = searchParams.get("tab") as TabId;
    if (tab && ["library", "inventory", "settings"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await apiGet<{ authenticated: boolean; user?: { wallet: string } }>("/api/auth/me");
        if (data.authenticated && data.user?.wallet) {
          setIsAuthorized(true);
          setUserWallet(data.user.wallet);
        }
      } catch {
        setIsAuthorized(false);
        setUserWallet(null);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    checkAuth();
  }, []);

  const loadLibrary = useCallback(async () => {
    if (!isAuthorized) return;
    setIsLoadingLibrary(true);

    try {
      const data = await apiGet<{ library: LibraryGame[] }>("/api/client/sync");
      setLibraryGames(data.library || []);
    } catch {
      setLibraryGames([]);
    } finally {
      setIsLoadingLibrary(false);
    }
  }, [isAuthorized]);

  const loadInventory = useCallback(async (gameId?: string) => {
    if (!isAuthorized) return;
    setIsLoadingInventory(true);

    try {
      const params = new URLSearchParams();
      if (gameId && gameId !== "all" && gameId.trim() !== "") {
        params.set("gameId", gameId);
      }
      const url = `/api/user/inventory${params.toString() ? `?${params}` : ""}`;
      const data = await apiGet<{ items: InventoryItem[] }>(url);
      setInventoryItems(data.items || []);
    } catch {
      setInventoryItems([]);
    } finally {
      setIsLoadingInventory(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) return;

    if (activeTab === "library") {
      loadLibrary();
    } else if (activeTab === "inventory") {
      loadInventory(selectedInventoryGame !== "all" ? selectedInventoryGame : undefined);
    }
  }, [isAuthorized, activeTab, selectedInventoryGame, loadLibrary, loadInventory]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      await performLogout(disconnect, router);
      setIsAuthorized(false);
      setUserWallet(null);
      setLibraryGames([]);
      setInventoryItems([]);

      window.location.href = "/";
    }
  };

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/profile?${params.toString()}`, { scroll: false });
  };

  const handleInventoryGameChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const gameId = e.target.value;
    setSelectedInventoryGame(gameId);
    loadInventory(gameId !== "all" ? gameId : undefined);
  };

  const handleLaunchGame = (slug: string) => {
    if (typeof window !== "undefined" && "__TAURI__" in window) {
      // @ts-ignore
      window.__TAURI__?.shell?.open(`tanjo://launch/${slug}`);
    } else {
      window.location.href = `tanjo://launch/${slug}`;
      setTimeout(() => {
        router.push(`/games/${slug}`);
      }, 1500);
    }
  };

  if (isLoadingAuth || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-8 px-4 sm:px-6">

      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {t("profile.title")}
          </h1>
          <p className="text-text-secondary mt-1 text-sm sm:text-base">
            {t("profile.subtitle")}
          </p>
        </div>
        <button onClick={handleLogout} className="btn-error px-4 py-2 text-sm font-medium w-full sm:w-auto">
          {t("header.logout")}
        </button>
      </div>

      {userWallet && (
        <div className="card p-4 mb-6 bg-surface border-border">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <code className="text-xs sm:text-sm font-mono text-text-secondary break-all">
              {userWallet}
            </code>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-border mb-6 overflow-x-auto">
        {(["library", "inventory", "settings"] as TabId[]).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`tab-button whitespace-nowrap rounded-t-md capitalize px-4 py-3 transition-colors ${activeTab === tab
              ? "bg-primary/10 text-primary border-b-2 border-primary"
              : "text-text-secondary hover:text-foreground hover:bg-surface/50"
              }`}
          >
            {t(`profile.${tab}`)}
          </button>
        ))}
      </div>

      <div className="card p-4 sm:p-6 min-h-[400px]">

        {activeTab === "library" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                {t("profile.yourGames")}
              </h2>
              <Link
                href="/"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {t("profile.browseStore")} →
              </Link>
            </div>

            {isLoadingLibrary ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="md" />
              </div>
            ) : libraryGames.length === 0 ? (
              <EmptyState
                title={t("profile.noGames")}
                description={t("profile.noGamesHint")}
                action={
                  <Link href="/" className="btn-primary px-4 py-2 text-sm">
                    {t("profile.browseStore")}
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {libraryGames.map((game) => (
                  <div
                    key={game.id}
                    className="card p-4 border-border bg-surface/50"
                  >
                    <div className="flex items-center gap-4">
                      {/* Постер игры */}
                      <div className="w-16 h-16 bg-zinc-800 rounded-lg flex-shrink-0 overflow-hidden">
                        {game.coverImage ? (
                          <img
                            src={game.coverImage}
                            alt={game.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            🎮
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground text-sm mb-1 truncate" title={game.title}>
                          {game.title}
                        </h3>

                        <span className={`text-[10px] px-2 py-0.5 rounded inline-block ${game.status === "owned"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-yellow-500/10 text-yellow-400"
                          }`}>
                          {t(`profile.status.${game.status}`)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "inventory" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                {t("profile.inventory")}
              </h2>
            </div>

            <div className="mb-6">
              <label htmlFor="inventory-game-select" className="block text-sm font-medium text-foreground mb-2">
                {t("profile.selectGame")}
              </label>
              <select
                id="inventory-game-select"
                value={selectedInventoryGame}
                onChange={handleInventoryGameChange}
                className="input-field w-full sm:w-auto max-w-xs"
              >
                <option value="all">{t("profile.allGames")}</option>
                {libraryGames.map(game => (
                  <option key={game.gameId} value={game.gameId}>
                    {game.title}
                  </option>
                ))}
              </select>
            </div>

            {isLoadingInventory ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="md" />
              </div>
            ) : inventoryItems.length === 0 ? (
              <EmptyState
                title={
                  selectedInventoryGame !== "all"
                    ? t("profile.noItemsForGame") || t("profile.noItems")
                    : t("profile.noItems")
                }
                description={
                  selectedInventoryGame !== "all"
                    ? t("profile.noItemsForGameHint") || t("profile.noItemsHint")
                    : t("profile.noItemsHint")
                }
                action={
                  <Link href="/marketplace" className="btn-primary px-4 py-2 text-sm">
                    {t("profile.visitMarketplace")}
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {inventoryItems.map((item) => (
                  <div
                    key={item.id}
                    className="card p-3 border-border bg-surface hover:border-primary/30 transition-all group"
                  >
                    <div className="aspect-square bg-zinc-800 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                      {item.itemImage ? (
                        <img
                          src={item.itemImage}
                          alt={item.itemName || "Item"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <span className="text-3xl">📦</span>
                      )}
                    </div>

                    {item.itemName && (
                      <p className="text-xs font-medium text-foreground truncate mb-1">
                        {item.itemName}
                      </p>
                    )}

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
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-md mx-auto w-full">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-6">
              {t("profile.settings")}
            </h2>

            <div className="space-y-6">

              <div className="border-t border-border pt-6">
                <h3 className="text-sm font-medium text-foreground mb-4">
                  {t("profile.linkedWallet")}
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                    <span className="text-text-secondary">{t("profile.address")}</span>
                    <code className="text-foreground font-mono text-xs bg-surface px-2 py-1 rounded break-all">
                      {userWallet ? `${userWallet.slice(0, 8)}...${userWallet.slice(-6)}` : t("profile.notConnected")}
                    </code>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                    <span className="text-text-secondary">{t("profile.network")}</span>
                    <span className="text-foreground">Solana Mainnet</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="text-sm font-medium text-foreground mb-4">
                  {t("profile.desktopClient")}
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">{t("profile.clientStatus")}</span>
                    <span className="text-text-muted">
                      {typeof window !== "undefined" && "tanjoClient" in window
                        ? t("profile.clientConnected")
                        : t("profile.clientNotDetected")}
                    </span>
                  </div>
                  <a
                    href="/stub/AdvenjoHub-latest.exe"
                    download
                    className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
                  >
                    ⬇️ {t("header.downloadApp")}
                  </a>
                </div>
              </div>


            </div>
          </div>
        )}

      </div>
    </div>
  );
}