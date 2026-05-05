//src\features\profile\components\ProfileContent.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { apiGet } from "@/core/api/client";
import { performLogout } from "@/core/auth/lib/logout";

export default function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { publicKey, disconnect } = useWallet();
  const { t } = useLanguage();

  type TabId = "library" | "settings";
  const [activeTab, setActiveTab] = useState<TabId>("library");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [libraryGames, setLibraryGames] = useState<any[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

  useEffect(() => {
    const tab = searchParams.get("tab") as TabId;
    if (tab && ["library", "settings"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (publicKey === undefined) return;

    const checkAuth = async () => {
      try {
        await apiGet("/api/auth/me");
        if (publicKey) setIsAuthorized(true);
      } catch {
        if (!publicKey) router.replace("/");
      } finally {
        setIsLoadingAuth(false);
      }
    };

    checkAuth();
  }, [publicKey, router]);

  const loadLibrary = useCallback(async () => {
    if (!publicKey) return;
    setIsLoadingLibrary(true);
    try {
      setLibraryGames([]);
    } finally {
      setIsLoadingLibrary(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (!isAuthorized || !publicKey) return;
    loadLibrary();
  }, [isAuthorized, publicKey, loadLibrary]);

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
    }
  };

  if (isLoadingAuth || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-8 px-4 sm:px-6">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("profile.title")}</h1>
          <p className="text-text-secondary mt-1 text-sm sm:text-base">{t("profile.subtitle")}</p>
        </div>
        <button onClick={handleLogout} className="btn-error px-4 py-2 text-sm font-medium w-full sm:w-auto">{t("header.logout")}</button>
      </div>

      {publicKey && (
        <div className="card p-4 mb-6 bg-surface border-border">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <code className="text-xs sm:text-sm font-mono text-text-secondary break-all">{publicKey.toBase58()}</code>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-border mb-6 overflow-x-auto">
        {(["library", "settings"] as TabId[]).map((tab) => (
          <button key={tab} onClick={() => { setActiveTab(tab); router.replace(`/profile?tab=${tab}`); }} className={`tab-button whitespace-nowrap rounded-t-md capitalize px-4 py-3 ${activeTab === tab ? "active" : ""}`}>
            {t(`profile.${tab}`)}
          </button>
        ))}
      </div>

      <div className="card p-4 sm:p-6 min-h-[400px]">
        {activeTab === "library" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground">{t("profile.yourGames")}</h2>
            </div>
            {isLoadingLibrary ? (
              <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : libraryGames.length === 0 ? (
              <div className="text-center py-12 text-text-secondary"><p>{t("profile.noGames")}</p><Link href="/" className="text-primary hover:underline mt-2 inline-block">{t("profile.browseStore")}</Link></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {libraryGames.map((item) => (
                  <Link key={item.gameId} href={`/game/${item.gameId}`} className="card p-4 border-border hover:border-primary/50 hover:bg-surface/50 transition-all cursor-pointer group flex items-center gap-4">
                    <div className="flex-1 min-w-0"><h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{item.gameId}</h3><p className="text-[10px] text-text-muted mt-2">{t("profile.purchasedLabel")} {item.boughtAt ? new Date(item.boughtAt).toLocaleDateString() : t("profile.unknown")}</p></div>
                    <div className="text-text-muted group-hover:translate-x-1 transition-transform">→</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-md mx-auto w-full">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-6">{t("profile.settings")}</h2>
            <div className="space-y-6">
              <div className="border-t border-border pt-6">
                <h3 className="text-sm font-medium text-foreground mb-4">{t("profile.linkedWallet")}</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                    <span className="text-text-secondary">{t("profile.address")}</span>
                    <code className="text-foreground font-mono text-xs bg-surface px-2 py-1 rounded break-all">{publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-6)}</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}