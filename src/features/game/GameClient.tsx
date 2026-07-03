//src\features\game\GameClient.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Game, HUDState } from "./core/Game";
import { HUD } from "./ui/HUD";
import { Menu } from "./ui/Menu";
import { Hotbar } from "./ui/Hotbar";
import { Notifications } from "./ui/Notifications";
import { Chat, ChatMessage } from "./ui/Chat";
import { Spinner } from "@/core/ui/Spinner";
import { apiPost } from "@/core/api/client";

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

export function GameClient({ slug }: GameClientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const notifIdRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing game...");
  const [isPaused, setIsPaused] = useState(true);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [nickname, setNickname] = useState("Player");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [hudState, setHudState] = useState<HUDState>({
    health: 100,
    maxHealth: 100,
    ammo: 30,
    maxAmmo: 30,
    reserve: 90,
    online: 1,
    inSafeZone: true,
    prompt: null,
  });

  const hotbar = [
    { id: "rifle", icon: "🔫", name: "Rifle", active: true },
    { id: "fist", icon: "👊", name: "Fists", active: false },
    { id: "slot3", icon: "", name: "", active: false },
    { id: "slot4", icon: "", name: "", active: false },
    { id: "slot5", icon: "", name: "", active: false },
  ];

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
      console.log("🎮 [GameClient] Starting initialization...");
      
      try {
        setLoadingMessage("Authenticating with game server...");
        console.log("🔐 [GameClient] Requesting game session for slug:", slug);
        
        const session = await apiPost<GameSession>("/api/game/session", {
          gameSlug: slug,
        });
        
        console.log("✅ [GameClient] Session received:", {
          userId: session.userId,
          wallet: session.wallet.slice(0, 8) + "...",
          serverUrl: session.serverUrl,
          tokenLength: session.gameToken.length,
        });

        if (!canvasRef.current) {
          console.error("❌ [GameClient] Canvas ref is null");
          return;
        }

        canvasRef.current.tabIndex = 0;
        canvasRef.current.style.outline = "none";

        setLoadingMessage("Creating game world...");
        console.log("🏗️ [GameClient] Creating Game instance...");

        const game = new Game(canvasRef.current, slug, {
          gameToken: session.gameToken,
          serverUrl: session.serverUrl,
          userId: session.userId,
          wallet: session.wallet,
        });
        gameRef.current = game;

        game.onStateChange = (state) => setHudState(state);
        game.onLoadStateChange = (loading) => {
          console.log("📊 [GameClient] Loading state changed:", loading);
          setLoading(loading);
        };
        game.onNotification = (msg, duration = 3000) => {
          console.log("🔔 [GameClient] Notification:", msg);
          const id = ++notifIdRef.current;
          setNotifications((prev) => [...prev, { id, message: msg, duration }]);
        };
        game.onChatMessage = (message) => {
          console.log("💬 [GameClient] Chat message:", message.sender, "-", message.message);
          setChatMessages((prev) => [...prev.slice(-99), message]);
        };
        game.onNicknameLoaded = (nick: string) => {
          console.log("👤 [GameClient] Nickname loaded:", nick);
          if (nick) setNickname(nick);
        };

        console.log("🚀 [GameClient] Calling game.init()...");
        await game.init();
        console.log("🎉 [GameClient] Game fully initialized!");
      } catch (error: any) {
        console.error("❌ [GameClient] Init error:", error);

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
      console.log("🧹 [GameClient] Cleanup - disposing game...");
      gameRef.current?.dispose();
    };
  }, [slug]);

  useEffect(() => {
    const handleLockChange = () => {
      const locked = !!document.pointerLockElement;
      console.log("🔒 [GameClient] Pointer lock changed:", locked);
      setIsPointerLocked(locked);
    };
    document.addEventListener("pointerlockchange", handleLockChange);
    return () => document.removeEventListener("pointerlockchange", handleLockChange);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.code === "Escape" && !isPaused) {
        console.log("⏸️ [GameClient] ESC pressed - pausing");
        setIsPaused(true);
      }
      if (e.code === "Enter" && !isPaused && isPointerLocked) {
        setIsChatVisible((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isPaused, isPointerLocked]);

  const handleResume = () => {
    console.log("▶️ [GameClient] Resuming game");
    setIsPaused(false);
    gameRef.current?.setPaused(false);
    
    if (canvasRef.current) {
      console.log("🖱️ [GameClient] Requesting pointer lock on canvas...");
      canvasRef.current.focus();
      canvasRef.current.requestPointerLock();
    }
  };

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
          <p className="text-zinc-500 text-xs mt-2">Check console for detailed logs</p>
        </div>
      )}

      <HUD state={hudState} isPointerLocked={isPointerLocked} />
      <Hotbar slots={hotbar} />
      <Notifications notifications={notifications} onRemove={removeNotification} />
      
      <Chat
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        isVisible={isChatVisible}
        onToggle={() => setIsChatVisible((prev) => !prev)}
      />
      
      <Menu
        isOpen={isPaused && !loading}
        onResume={handleResume}
        nickname={nickname}
        onNicknameChange={handleNicknameChange}
      />
    </div>
  );
}