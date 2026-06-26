// src/features/store/components/GameDetailsModal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { Modal } from "@/core/ui/Modal";
import { Spinner } from "@/core/ui/Spinner";
import { PurchaseButton } from "@/features/shared/PurchaseButton";
import { LoginButton } from "@/core/auth/components/LoginButton";
import { useAuth } from "@/core/auth/AuthProvider";
import { apiGet } from "@/core/api/client";

interface GameDetail {
  id: string;
  slug: string;
  title: string;
  coverImage: string | null;
  publisher: string | null;
  price: number;
  isOwned: boolean;
  screenshots: string[];
}

interface GameDetailModalProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
  onPurchaseSuccess?: () => void;
}

const normalizeSlug = (slug: string) => slug.replace(/-/g, '_');

export function GameDetailModal({
  slug,
  isOpen,
  onClose,
  onPurchaseSuccess,
}: GameDetailModalProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const { isAuthorized } = useAuth();

  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeScreenshot, setActiveScreenshot] = useState(0);

  const loadGame = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    console.log("🔍 Loading game with slug:", slug);

    try {
      const data = await apiGet<GameDetail>(`/api/games/${slug}`);
      console.log("📦 Game loaded:", data);
      console.log("🎮 Game slug:", data.slug, "isOwned:", data.isOwned);
      setGame(data);
    } catch (err) {
      console.error("❌ Failed to load game:", err);
      setError(t("game.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [slug, t]);

  useEffect(() => {
    if (isOpen && slug) {
      console.log("🚪 Modal opened for slug:", slug);
      loadGame();
    }
  }, [isOpen, slug, loadGame]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handlePurchaseSuccess = useCallback(() => {
    console.log("✅ Purchase successful, reloading game data");
    loadGame();
    onPurchaseSuccess?.();
  }, [loadGame, onPurchaseSuccess]);

  const fullDescription = game
    ? t(`games.${normalizeSlug(game.slug)}.description`) || t("game.inDevelopment")
    : "";

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={game?.title || t("game.loading")}
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error || !game ? (
        <div className="text-center py-12 text-red-400">
          <p>{error || t("game.notFound")}</p>
          <button onClick={onClose} className="mt-4 btn-secondary">
            {t("actions.close")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col max-h-[85vh]">

          <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-6 pb-4">

            <div className="relative">
              <div className="aspect-video bg-zinc-800 rounded-lg overflow-hidden">
                {game.coverImage ? (
                  <img
                    src={game.coverImage}
                    alt={game.title}
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl text-zinc-600">
                    {t("game.placeholderIcon")}
                  </div>
                )}
              </div>

              {game.isOwned && (
                <div className="absolute top-4 right-4 bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                  ✓ {t("game.owned")}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-2xl font-bold text-foreground mb-1">
                {game.title}
              </h2>
              {game.publisher && (
                <p className="text-sm text-text-secondary">
                  {t("game.publisher")}: {game.publisher}
                </p>
              )}
            </div>

            {game.screenshots && game.screenshots.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">
                  {t("game.screenshots")}
                </h3>

                <div className="flex gap-2 overflow-x-auto pb-2">
                  {game.screenshots.map((src, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveScreenshot(idx)}
                      className={`flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden border-2 transition-all ${activeScreenshot === idx
                        ? "border-primary"
                        : "border-transparent hover:border-zinc-600"
                        }`}
                      aria-label={`${t("game.screenshot")} ${idx + 1}`}
                    >
                      <img
                        src={src}
                        alt={`${game.title} - ${t("game.screenshot")} ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>

                <div className="mt-3 aspect-video bg-zinc-800 rounded-lg overflow-hidden">
                  <img
                    src={game.screenshots[activeScreenshot]}
                    alt={`${game.title} - ${t("game.screenshot")} ${activeScreenshot + 1}`}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">
                {t("game.about")}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {fullDescription}
              </p>
            </div>

          </div>

          <div className="sticky bottom-0 bg-zinc-900/95 backdrop-blur py-4 border-t border-zinc-700 -mx-2 px-2">
            {(() => {
              console.log("🎯 Rendering bottom section - isOwned:", game.isOwned, "slug:", game.slug, "isAuthorized:", isAuthorized);
              
              if (game.isOwned) {
                console.log("✅ Game is owned! Checking if should show PLAY button...");
                console.log("🎮 Is tanjo-shooter?", game.slug === "tanjo-shooter");
                
                return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-400">
                      <span className="text-xl">✓</span>
                      <span className="font-medium">{t("game.inLibrary")}</span>
                    </div>
                    <div className="flex gap-2">
                      {game.slug === "tanjo-shooter" && (
                        <button
                          onClick={() => {
                            console.log("🎮 ИГРАТЬ button clicked! Navigating to:", `/game/${game.slug}`);
                            onClose();
                            router.push(`/game/${game.slug}`);
                          }}
                          className="btn-primary px-6 py-2"
                        >
                          ИГРАТЬ
                        </button>
                      )}
                      <button
                        onClick={() => {
                          console.log("📚 В библиотеку button clicked!");
                          onClose();
                          router.push("/profile?tab=library");
                        }}
                        className="btn-secondary px-6 py-2"
                      >
                        {t("actions.goToLibrary")}
                      </button>
                    </div>
                  </div>
                );
              } else if (isAuthorized) {
                console.log("💰 Game not owned, showing PurchaseButton");
                return (
                  <PurchaseButton
                    gameId={game.id}
                    price={game.price}
                    onSuccess={handlePurchaseSuccess}
                  />
                );
              } else {
                console.log("🔒 Not authorized, showing LoginButton");
                return (
                  <div className="space-y-2">
                    <LoginButton className="w-full" />
                    <p className="text-xs text-text-secondary text-center">
                      {t("purchase.connectWalletHint") || "Connect your wallet to purchase"}
                    </p>
                  </div>
                );
              }
            })()}
          </div>

        </div>
      )}
    </Modal>
  );
}