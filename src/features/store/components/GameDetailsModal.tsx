"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { Modal } from "@/core/ui/Modal";
import { Spinner } from "@/core/ui/Spinner";
import { PurchaseButton } from "@/features/shared/PurchaseButton";
import { apiGet } from "@/core/api/client";

interface GameDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  developer: string | null;
  publisher: string | null;
  releaseDate: string | null;
  price: number;
  isOwned: boolean;
  screenshots: string[];
  features: string[];
  systemRequirements?: {
    minimum: Record<string, string>;
  } | null;
  stats?: {
    reviewsCount: number;
    positiveReviews: number;
    playersCount: string;
  } | null;
}

interface GameDetailModalProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
  onPurchaseSuccess?: () => void;
}

export function GameDetailModal({
  slug,
  isOpen,
  onClose,
  onPurchaseSuccess,
}: GameDetailModalProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const { publicKey } = useWallet();
  
  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeScreenshot, setActiveScreenshot] = useState(0);

  const loadGame = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiGet<GameDetail>(`/api/games/${slug}`);
      setGame(data);
    } catch {
      setError(t("store.failedToLoadGame"));
    } finally {
      setLoading(false);
    }
  }, [slug, t]);

  useEffect(() => {
    if (isOpen && slug) {
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
    loadGame();
    onPurchaseSuccess?.();
  }, [loadGame, onPurchaseSuccess]);

  if (!isOpen) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="lg"
      title={game?.title || t("store.loading")}
    > 
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error || !game ? (
        <div className="text-center py-12 text-red-400">
          <p>{error || t("store.gameNotFound")}</p>
          <button onClick={onClose} className="mt-4 btn-secondary">
            {t("actions.close")}
          </button>
        </div>
      ) : (
        <div className="max-h-[85vh] overflow-y-auto pr-2 -mr-2">
          
          <div className="relative mb-6">
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
                  🎮
                </div>
              )}
            </div>
            
            {game.isOwned && (
              <div className="absolute top-4 right-4 bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                ✓ {t("store.owned")}
              </div>
            )}
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {game.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
              {game.developer && (
                <span>{t("store.developer")}: {game.developer}</span>
              )}
              {game.publisher && (
                <span>• {t("store.publisher")}: {game.publisher}</span>
              )}
              {game.releaseDate && (
                <span>• {new Date(game.releaseDate).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          {game.stats && (
            <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-zinc-800/50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {game.stats.positiveReviews}%
                </div>
                <div className="text-xs text-text-muted">
                  {t("store.positiveReviews")}
                </div>
                <div className="text-[10px] text-text-muted">
                  ({game.stats.reviewsCount} {t("store.reviews")})
                </div>
              </div>
              <div className="text-center border-l border-zinc-700">
                <div className="text-2xl font-bold text-foreground">
                  {game.stats.playersCount}
                </div>
                <div className="text-xs text-text-muted">
                  {t("store.players")}
                </div>
              </div>
              <div className="text-center border-l border-zinc-700">
                <div className="text-2xl font-bold text-primary">
                  {game.price > 0 ? `${(game.price / 1_000_000).toFixed(2)} TNJ` : "Free"}
                </div>
                <div className="text-xs text-text-muted">
                  {t("store.price")}
                </div>
              </div>
            </div>
          )}

          {game.screenshots && game.screenshots.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground mb-3">
                {t("store.screenshots")}
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {game.screenshots.map((src, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveScreenshot(idx)}
                    className={`flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      activeScreenshot === idx 
                        ? "border-primary" 
                        : "border-transparent hover:border-zinc-600"
                    }`}
                  >
                    <img 
                      src={src} 
                      alt={`Screenshot ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
              <div className="mt-3 aspect-video bg-zinc-800 rounded-lg overflow-hidden">
                <img 
                  src={game.screenshots[activeScreenshot]} 
                  alt="Large screenshot"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-3">
              {t("store.about")}
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {game.description || t("store.noDescription")}
            </p>
          </div>

          {game.features && game.features.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground mb-3">
                {t("store.features")}
              </h3>
              <ul className="grid grid-cols-2 gap-2 text-sm text-text-secondary">
                {game.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {game.systemRequirements && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground mb-3">
                {t("store.systemRequirements")}
              </h3>
              <div className="p-4 bg-zinc-800/50 rounded-lg text-sm">
                <h4 className="font-medium text-foreground mb-2">
                  {t("store.minimum")}
                </h4>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-text-secondary">
                  {Object.entries(game.systemRequirements.minimum).map(([key, value]) => (
                    <div key={key}>
                      <dt className="capitalize text-text-muted">{key}:</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}

          <div className="sticky bottom-0 bg-zinc-900/95 backdrop-blur py-4 border-t border-zinc-700 -mx-6 px-6">
            {game.isOwned ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-400">
                  <span className="text-xl">✓</span>
                  <span className="font-medium">{t("store.inLibrary")}</span>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    router.push("/profile?tab=library");
                  }}
                  className="btn-primary px-6 py-2"
                >
                  {t("actions.goToLibrary")}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {game.price > 0 ? `${(game.price / 1_000_000).toFixed(2)} TNJ` : "Free"}
                  </div>
                  <div className="text-xs text-text-muted">
                    {t("store.availableInClient")}
                  </div>
                </div>
                
                <PurchaseButton
                  gameId={game.id}
                  price={game.price}
                  onSuccess={handlePurchaseSuccess}
                />
              </div>
            )}
          </div>

        </div>
      )}
    </Modal>
  );
}