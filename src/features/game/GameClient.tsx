// src/features/game/GameClient.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Game, HUDState, DamageEvent } from "./core/Game";
import { HUD } from "./ui/HUD";
import { Menu } from "./ui/Menu";
import { Hotbar } from "./ui/Hotbar";
import { Notifications } from "./ui/Notifications";
import { Chat, ChatMessage } from "./ui/Chat";
import { DamageIndicator } from "./ui/DamageIndicator";
import { Spinner } from "@/core/ui/Spinner";
import { apiPost } from "@/core/api/client";
import { DeathScreen } from "./ui/DeathScreen";
import { FloorSelector } from "./ui/FloorSelector";
import { TokenPanel } from "./ui/TokenPanel";

interface GameClientProps {
  slug: string;
}

interface Notification {
  id: number;
  message: string;
  duration: number;
}

interface GameSession {
  gameToken: string;
  serverUrl: string;
  userId: string;
  wallet: string;
}

interface HotbarSlot {
  id: string;
  icon: string;
  name: string;
  equipped: boolean;
}

export function GameClient({ slug }: GameClientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const notifIdRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing game...");
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [nickname, setNickname] = useState("Player");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [damageEvents, setDamageEvents] = useState<DamageEvent[]>([]);
  const [isDead, setIsDead] = useState(false);
  const [killerName, setKillerName] = useState<string | null>(null);
  const [damageIndicator, setDamageIndicator] = useState<{
    attackerId: string | null;
    direction: number;
  }>({ attackerId: null, direction: 0 });

  const [isHitMark, setIsHitMark] = useState(false);

  const [showFloorSelector, setShowFloorSelector] = useState(false);
  const [currentLocationId, setCurrentLocationId] = useState("main-world");
  
  const [activeTokenData, setActiveTokenData] = useState<any>(null);

  const [hotbarSlots, setHotbarSlots] = useState<HotbarSlot[]>([
    { id: "rifle", icon: "🔫", name: "Rifle", equipped: true },
    { id: "slot2", icon: "", name: "", equipped: false },
    { id: "slot3", icon: "", name: "", equipped: false },
    { id: "slot4", icon: "", name: "", equipped: false },
    { id: "slot5", icon: "", name: "", equipped: false },
  ]);

  const [hudState, setHudState] = useState<HUDState>({
    health: 100,
    maxHealth: 100,
    ammo: 30,
    maxAmmo: 30,
    reserve: 0,
    online: 1,
    inSafeZone: true,
    prompt: null,
    isReloading: false,
    isWeaponEquipped: true,
  });

  const handleSlotClick = (index: number) => {
    setHotbarSlots((prev) => {
      const slot = prev[index];
      if (!slot.icon) return prev;

      if (slot.equipped) {
        const newSlots = prev.map((s) => ({ ...s, equipped: false }));
        gameRef.current?.setWeaponEquipped(false);
        return newSlots;
      }

      const newSlots = prev.map((s, i) => ({
        ...s,
        equipped: i === index,
      }));
      gameRef.current?.setWeaponEquipped(true);
      return newSlots;
    });
  };

  useEffect(() => {
    const handleScrollKeys = (e: KeyboardEvent) => {
      if (!document.pointerLockElement) return;
      const scrollKeys = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"];
      if (scrollKeys.includes(e.code)) {
        e.preventDefault();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (document.pointerLockElement) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleScrollKeys, { passive: false });
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleScrollKeys);
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    const initGame = async () => {
      try {
        setLoadingMessage("Authenticating with game server...");

        const session = await apiPost<GameSession>("/api/game/session", {
          gameSlug: slug,
        });

        if (!canvasRef.current) {
          throw new Error("Canvas element not found");
        }

        canvasRef.current.tabIndex = 0;
        canvasRef.current.style.outline = "none";

        setLoadingMessage("Creating game world...");

        const game = new Game(canvasRef.current, slug, {
          gameToken: session.gameToken,
          serverUrl: session.serverUrl,
          userId: session.userId,
          wallet: session.wallet,
        });
        gameRef.current = game;

        game.onStateChange = (state) => setHudState(state);
        
        game.onLoadStateChange = (loading, message) => {
          setLoading(loading);
          if (message) {
            setLoadingMessage(message);
          }
        };
        
        game.onNotification = (msg, duration = 3000) => {
          const id = ++notifIdRef.current;
          setNotifications((prev) => {
            const newNotifications = [...prev, { id, message: msg, duration }];
            if (newNotifications.length > 5) {
              return newNotifications.slice(-5);
            }
            return newNotifications;
          });
        };
        game.onChatMessage = (message) => {
          setChatMessages((prev) => [...prev.slice(-99), message]);
        };
        game.onNicknameLoaded = (nick: string) => {
          if (nick) setNickname(nick);
        };

        game.onLocationChange = (id: string) => {
          setCurrentLocationId(id);
        };

        game.onFloorSelectorToggle = (isOpen: boolean) => {
          setShowFloorSelector(isOpen);
          if (isOpen) {
            document.exitPointerLock();
          }
        };

        game.onOpenTokenUI = (tokenData) => {
          setActiveTokenData(tokenData);
          document.exitPointerLock(); 
        };

        game.onDamageEvent = (event) => {
          setDamageEvents((prev) => [...prev, event]);
          setTimeout(() => {
            setDamageEvents((prev) => prev.filter((e) => e.id !== event.id));
          }, 2000);
        };

        game.onDeathStateChange = (dead, killer) => {
          setIsDead(dead);
          setKillerName(killer);
        };

        game.onDamageIndicatorUpdate = (attackerId, direction) => {
          setDamageIndicator({ attackerId, direction });
        };

        game.onHitMark = () => {
          setIsHitMark(true);
          setTimeout(() => setIsHitMark(false), 200);
        };

        await game.init();
      } catch (error: any) {
        if (error.message?.includes("no_license")) {
          setAuthError("You don't own this game. Please purchase it first.");
        } else if (error.message?.includes("license_expired")) {
          setAuthError("Your license has expired.");
        } else if (error.message?.includes("Unauthorized")) {
          setAuthError("Please log in to play.");
        } else {
          setAuthError(error.message || "Failed to start game");
        }
        setLoading(false);
      }
    };

    initGame();

    return () => {
      gameRef.current?.dispose();
    };
  }, [slug]);

  useEffect(() => {
    const handleLockChange = () => {
      const locked = !!document.pointerLockElement;
      setIsPointerLocked(locked);
    };
    document.addEventListener("pointerlockchange", handleLockChange);
    return () => document.removeEventListener("pointerlockchange", handleLockChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTokenData) return;

      if (e.code === "Escape") {
        if (showFloorSelector) {
          setShowFloorSelector(false);
          gameRef.current?.closeFloorSelector();
          return;
        }
        setIsMenuOpen((prev) => !prev);
        return;
      }
      
      if (e.code === "Enter" && isPointerLocked) {
        setIsChatVisible((prev) => !prev);
      }

      if (isPointerLocked && !isMenuOpen && !showFloorSelector) {
        const digitKeys = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"];
        const index = digitKeys.indexOf(e.code);
        if (index !== -1) {
          handleSlotClick(index);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPointerLocked, isMenuOpen, showFloorSelector, activeTokenData]);

  const handleNicknameChange = (nick: string) => {
    setNickname(nick);
    gameRef.current?.setNickname(nick);
  };

  const handleSendMessage = (message: string) => {
    gameRef.current?.sendChatMessage(message);
  };

  const removeNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleCloseMenu = () => {
    setIsMenuOpen(false);
  };

  const handleSelectFloor = (floorId: string) => {
    gameRef.current?.selectFloor(floorId);
  };

  if (authError) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="bg-zinc-900 border border-red-500/50 rounded-xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-zinc-400 mb-6">{authError}</p>
          <button
            onClick={() => window.location.href = "/"}
            className="btn-primary px-6 py-2"
          >
            Back to Store
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-50 bg-black overflow-hidden"
      style={{
        top: '64px',
        height: 'calc(100vh - 64px)'
      }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-pointer"
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />

      {loading && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-50">
          <Spinner size="lg" />
          <p className="text-white mt-4 text-lg font-mono">{loadingMessage}</p>
        </div>
      )}

      <HUD
        state={hudState}
        isPointerLocked={isPointerLocked}
        isHitMark={isHitMark}
      />
      <Hotbar
        slots={hotbarSlots}
        onSlotClick={handleSlotClick}
      />
      <Notifications notifications={notifications} onRemove={removeNotification} />

      <DamageIndicator
        attackerId={damageIndicator.attackerId}
        direction={damageIndicator.direction}
      />

      <DeathScreen
        isVisible={isDead}
        killerName={killerName}
        respawnTime={3}
      />

      <Chat
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        isVisible={isChatVisible}
        onToggle={() => setIsChatVisible((prev) => !prev)}
      />

      <Menu
        isOpen={isMenuOpen}
        onClose={handleCloseMenu}
        nickname={nickname}
        onNicknameChange={handleNicknameChange}
        onTeleportToTower={() => gameRef.current?.teleportToTower()}
        onTeleportToSafeZone={() => gameRef.current?.teleportToSafeZone()}
      />

      <FloorSelector
        isOpen={showFloorSelector}
        onClose={() => {
          setShowFloorSelector(false);
          gameRef.current?.closeFloorSelector();
        }}
        onSelectFloor={handleSelectFloor}
        currentLocationId={currentLocationId}
      />

      {activeTokenData && (
        <TokenPanel
          ca={activeTokenData.ca}
          onClose={() => setActiveTokenData(null)}
        />
      )}
    </div>
  );
}