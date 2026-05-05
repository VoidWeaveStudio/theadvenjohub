//src\games\warden-abyss\WardenAbyssPage.tsx
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useGameLogic } from "@/games/warden-abyss/hooks"; 
import { useLanguage } from "@/core/i18n/LanguageContext";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import "@/games/warden-abyss/styles/game.css";
import { 
  UpgradeList, 
  SkinList, 
  Leaderboard, 
  WalletModal, 
  ActionConfirmModal 
} from "@/games/warden-abyss/components";  
import { ICONS } from "@/games/warden-abyss/data"; 
import { useSpriteCache } from "@/games/warden-abyss/hooks";  
type SidebarTab = "upgrades" | "skins" | "leaderboard";

const ALL_GAME_SPRITES = [
  "/games/warden-abyss/sprites/warden_idle.png",
  "/games/warden-abyss/sprites/warden_attack.png",
  "/games/warden-abyss/sprites/warden_attack2.png",
  "/games/warden-abyss/sprites/boss_idle.png",
  "/games/warden-abyss/sprites/boss_hit1.png",
  "/games/warden-abyss/sprites/boss_hit2.png",
  ICONS.tnjToken,
  ICONS.upgrades,
  ICONS.skins,
  ICONS.leaderboard,
].filter(Boolean);

export default function WardenAbyssPage() {
  const spriteCache = useSpriteCache({ 
    preload: ALL_GAME_SPRITES,
    retryAttempts: 5,
    retryDelay: 800
  });
  
  const router = useRouter();
  const { connected, publicKey, disconnect } = useWallet();
  const { t } = useLanguage();
  
  const [isDbSyncing, setIsDbSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>("upgrades");
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<"burn" | "withdraw" | "block" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const game = useGameLogic({ 
    wallet: publicKey?.toString() || "", 
    onDbLoading: setIsDbSyncing,
    onError: (msg) => {
      setError(msg);
      setTimeout(() => setError(null), 4000);
    }
  });

  const wardenSprite = useCallback((sprite: number) => {
    const src = sprite === 1 
      ? "/games/warden-abyss/sprites/warden_attack.png" 
      : sprite === 2 
        ? "/games/warden-abyss/sprites/warden_attack2.png" 
        : "/games/warden-abyss/sprites/warden_idle.png";
    return spriteCache.getSpriteSrc(src);
  }, [spriteCache]);

  const bossSprite = useCallback((sprite: number) => {
    const src = sprite === 0 
      ? "/games/warden-abyss/sprites/boss_idle.png" 
      : (sprite % 2 === 0) 
        ? "/games/warden-abyss/sprites/boss_hit1.png" 
        : "/games/warden-abyss/sprites/boss_hit2.png";
    return spriteCache.getSpriteSrc(src);
  }, [spriteCache]);

  useEffect(() => {
    if (!connected) {
      setShowConnectModal(true);
    } else {
      setShowConnectModal(false);
    }
  }, [connected]);

  useEffect(() => {
    const isModalOpen = showConnectModal || showWalletModal || selectedAction !== null || isDbSyncing;
    
    document.body.style.overflow = isModalOpen ? "hidden" : "";
    document.documentElement.style.overflow = isModalOpen ? "hidden" : "";

    game.togglePause(showWalletModal || selectedAction !== null || isDbSyncing);

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      game.togglePause(false);
    };
  }, [showConnectModal, showWalletModal, selectedAction, isDbSyncing, game]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleGlobalImageError = (e: Event) => {
      const target = e.target as HTMLImageElement;
      if (target.tagName !== 'IMG') return;
      
      const src = target.src;
      
      setTimeout(() => {
        const separator = src.includes('?') ? '&' : '?';
        target.src = `${src}${separator}retry=${Date.now()}`;
      }, 100);
    };
    
    window.addEventListener('error', handleGlobalImageError, true);
    
    return () => {
      window.removeEventListener('error', handleGlobalImageError, true);
    };
  }, []);

  const handleWalletAction = useCallback((action: "burn" | "withdraw" | "block") => {
    setSelectedAction(action);
  }, []);

  const handleConfirmAction = useCallback(() => {
    if (!selectedAction) return;
    const amount = game.balance;
    if (amount <= 0) return;

    switch (selectedAction) {
      case "burn": game.handleBurn(amount); break;
      case "withdraw": game.handleWithdraw(amount); break;
      case "block": game.handleBlock(amount); break;
    }
    
    setSelectedAction(null);
    setShowWalletModal(false);
  }, [selectedAction, game]);

  const handleCancelAction = useCallback(() => {
    setSelectedAction(null);
  }, []);

  const handleImageError = useCallback((src: string, entity: string) => (e: React.SyntheticEvent<HTMLImageElement>) => {
    const originalSrc = e.currentTarget.dataset.originalSrc || src;
    e.currentTarget.dataset.originalSrc = originalSrc;
    spriteCache.preloadSprite(originalSrc).then(() => {
      e.currentTarget.src = spriteCache.getSpriteSrc(originalSrc);
    }).catch(() => {
      if (entity === "Warden") {
        e.currentTarget.src = "/games/warden-abyss/sprites/warden_idle.png";
      } else if (entity === "Boss") {
        e.currentTarget.src = "/games/warden-abyss/sprites/boss_idle.png";
      }
    });
  }, [spriteCache]);

  if (showConnectModal) {
    return (
      <div className="game-root game-modal-overlay">
        <div className="game-modal-content">
          <div className="game-modal-icon">⚠️</div>
          <h2 className="game-modal-title">
            {t("game.wardenAbyss.connectRequired") || "CONNECTION REQUIRED"}
          </h2>
          <p className="game-modal-text">
            {t("game.wardenAbyss.connectPrompt") || "Connect Solana wallet to start the battle"}
          </p>
          <div className="game-modal-actions">
            <button onClick={() => router.push("/")} className="game-back-btn">
              ← {t("actions.backToStore") || "Back to Store"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isDbSyncing) {
    return (
      <div className="game-root game-modal-overlay">
        <div className="game-loader" />
        <p className="mt-4 text-sm text-zinc-400">{t("ui.processing") || "Processing..."}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-root game-modal-overlay">
        <div className="game-modal-content">
          <div className="game-modal-icon" style={{ color: "var(--color-red)" }}>❌</div>
          <h2 className="game-modal-title">{t("ui.error") || "Error"}</h2>
          <p className="game-modal-text">{error}</p>
          <button onClick={() => setError(null)} className="game-back-btn mt-4">
            {t("actions.close") || "Close"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-root">
      {game.isOffline && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-yellow-500/90 text-black text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
            <span>📴</span>
            <span>{t("ui.offlineMode") || "Offline mode"}</span>
          </div>
        </div>
      )}

      <div className="game-topbar">
        <div className="game-stats">
          <div className="game-stat-item">
            <span className="game-stat-label">{t("stats.balance")}</span>
            <span className="game-stat-value gold">
              {game.balance.toFixed(1)}
              <img 
                src={ICONS.tnjToken} 
                alt="TNJ" 
                className="inline w-4 h-4 ml-1" 
                decoding="sync"
                loading="eager"
                fetchPriority="high"
                onError={handleImageError(ICONS.tnjToken, "TNJ Token")}
              />
            </span>
          </div>
          <div className="game-stat-item">
            <span className="game-stat-label">{t("stats.attack")}</span>
            <span className="game-stat-value blue">+{game.currentClickPower.toFixed(1)}</span>
          </div>
          <div className="game-stat-item">
            <span className="game-stat-label">{t("stats.attacksPerSec")}</span>
            <span className="game-stat-value white">{game.autoHitsPerSec}</span>
          </div>
          <div className="game-stat-item">
            <span className="game-stat-label">{t("stats.totalEarned")}</span>
            <span className="game-stat-value green">
              {game.totalEarned.toFixed(1)}
              <img 
                src={ICONS.tnjToken} 
                alt="TNJ" 
                className="inline w-4 h-4 ml-1"
                decoding="sync"
                loading="eager"
                fetchPriority="high"
                onError={handleImageError(ICONS.tnjToken, "TNJ Token")}
              />
            </span>
          </div>
        </div>

        <div className="game-title">
          <h1 className="game-title-text">{t("game.wardenAbyss.title") || "WARDEN ABYSS"}</h1>
        </div>

        <div className="game-action-stats">
          <div className="game-action-stat">
            <span className="game-action-stat-icon">🔥</span>
            <span className="game-action-stat-label">{t("stats.burned")}</span>
            <span className="game-action-stat-value burn">
              {game.actionStats.burned.toFixed(1)}
              <img 
                src={ICONS.tnjToken} 
                alt="TNJ" 
                className="inline w-3 h-3 ml-0.5"
                decoding="sync"
                loading="eager"
                fetchPriority="high"
                onError={handleImageError(ICONS.tnjToken, "TNJ Token")}
              />
            </span>
          </div>
          <div className="game-action-stat">
            <span className="game-action-stat-icon">💰</span>
            <span className="game-action-stat-label">{t("stats.withdrawn")}</span>
            <span className="game-action-stat-value withdraw">
              {game.actionStats.withdrawn.toFixed(1)}
              <img 
                src={ICONS.tnjToken} 
                alt="TNJ" 
                className="inline w-3 h-3 ml-0.5"
                decoding="sync"
                loading="eager"
                fetchPriority="high"
                onError={handleImageError(ICONS.tnjToken, "TNJ Token")}
              />
            </span>
          </div>
          <div className="game-action-stat">
            <span className="game-action-stat-icon">🔒</span>
            <span className="game-action-stat-label">{t("stats.blocked")}</span>
            <span className="game-action-stat-value block">
              {game.actionStats.blocked.toFixed(1)}
              <img 
                src={ICONS.tnjToken} 
                alt="TNJ" 
                className="inline w-3 h-3 ml-0.5"
                decoding="sync"
                loading="eager"
                fetchPriority="high"
                onError={handleImageError(ICONS.tnjToken, "TNJ Token")}
              />
            </span>
          </div>
        </div>
      </div>

      <div className="game-main">
        <aside className="game-sidebar">
          <nav className="game-sidebar-tabs">
            <button 
              className={`game-sidebar-tab ${activeTab === "upgrades" ? "active" : ""}`} 
              onClick={() => setActiveTab("upgrades")}
            >
              <img 
                src={ICONS.upgrades} 
                alt="" 
                className="game-sidebar-tab-icon" 
                decoding="sync"
                loading="eager"
                fetchPriority="high"
                onError={handleImageError(ICONS.upgrades, "Upgrades Icon")}
              />
              <span>{t("tabs.upgrades")}</span>
            </button>
            <button 
              className={`game-sidebar-tab ${activeTab === "skins" ? "active" : ""}`} 
              onClick={() => setActiveTab("skins")}
            >
              <img 
                src={ICONS.skins} 
                alt="" 
                className="game-sidebar-tab-icon"
                decoding="sync"
                loading="eager"
                fetchPriority="high"
                onError={handleImageError(ICONS.skins, "Skins Icon")}
              />
              <span>{t("tabs.skins")}</span>
            </button>
            <button 
              className={`game-sidebar-tab ${activeTab === "leaderboard" ? "active" : ""}`} 
              onClick={() => setActiveTab("leaderboard")}
            >
              <img 
                src={ICONS.leaderboard} 
                alt="" 
                className="game-sidebar-tab-icon"
                decoding="sync"
                loading="eager"
                fetchPriority="high"
                onError={handleImageError(ICONS.leaderboard, "Leaderboard Icon")}
              />
              <span>{t("tabs.leaderboard")}</span>
            </button>
          </nav>

          <div className="game-sidebar-content">
            {activeTab === "upgrades" && (
              <UpgradeList upgrades={game.upgrades} balance={game.balance} onBuy={game.buyUpgrade} />
            )}
            {activeTab === "skins" && (
              <SkinList 
                skins={game.skins} 
                balance={game.balance} 
                onBuy={game.buySkin} 
              />
            )}
            {activeTab === "leaderboard" && <Leaderboard />}
          </div>

          <div className="game-wallet-section">
            <button 
              className="game-wallet-btn"
              onClick={() => setShowWalletModal(true)}
              disabled={game.balance <= 0 || isDbSyncing}
            >
              <span className="game-wallet-btn-icon">👛</span>
              <span className="game-wallet-btn-text">{t("wallet.title")}</span>
              <span className="game-wallet-btn-balance">
                {game.balance.toFixed(1)}
                <img 
                  src={ICONS.tnjToken} 
                  alt="TNJ" 
                  className="w-3 h-3 ml-1"
                  decoding="sync"
                  loading="eager"
                  fetchPriority="high"
                  onError={handleImageError(ICONS.tnjToken, "TNJ Token")}
                />
              </span>
            </button>
            
            {game.burnBonusPercent > 0 && (
              <div className="game-bonus-indicator burn">
                +{game.burnBonusPercent}% {t("stats.damage") || "damage"} ({t("bonuses.burn") || "burn bonus"})
              </div>
            )}
            {game.blockedAmount > 0 && (
              <div className="game-bonus-indicator block">
                🔒 {t("wallet.blocked") || "Blocked"}: {game.blockedAmount.toFixed(1)} TNJ
              </div>
            )}
          </div>
        </aside>

        <main 
          className={`game-arena-wrapper ${game.isPaused ? 'paused' : ''}`} 
          onClick={game.handleManualClick}
        >
          <div className="game-arena">
            <div className="game-fog" />
            <div className="game-particles" />
            <div className="game-sky" />
            <div className="arena-overlay" />
            
            {game.floatingDamages.map(damage => (
              <div 
                key={damage.id} 
                className="floating-damage" 
                style={{ left: `${damage.x}%`, top: `${damage.y}%` }}
              >
                +{damage.value.toFixed(1)}
              </div>
            ))}
            
            <div className={`game-char warden ${game.activeSprite !== 0 ? 'attacking' : ''}`}>
              <img 
                src={wardenSprite(game.activeSprite)} 
                alt="Warden" 
                draggable={false}
                decoding="sync"
                loading="eager"
                fetchPriority="high"
                crossOrigin="anonymous"
                onError={handleImageError(wardenSprite(game.activeSprite), "Warden")}
              />
            </div>
            <div className={`game-char boss ${game.activeSprite !== 0 ? 'hit' : ''}`}>
              <img 
                src={bossSprite(game.activeSprite)} 
                alt="Boss" 
                draggable={false}
                decoding="sync"
                loading="eager"
                fetchPriority="high"
                crossOrigin="anonymous"
                onError={handleImageError(bossSprite(game.activeSprite), "Boss")}
              />
            </div>
          </div>

          {game.isPaused && (
            <div className="game-pause-overlay">
              <span className="game-pause-text">{t("ui.paused") || "Game paused"}</span>
            </div>
          )}
        </main>
      </div>

      {showWalletModal && !selectedAction && (
        <WalletModal
          balance={game.balance}
          onClose={() => setShowWalletModal(false)}
          onActionSelect={handleWalletAction}
        />
      )}

      {selectedAction && (
        <ActionConfirmModal
          action={selectedAction}
          amount={game.balance}
          onConfirm={handleConfirmAction}
          onCancel={handleCancelAction}
        />
      )}
    </div>
  );
}