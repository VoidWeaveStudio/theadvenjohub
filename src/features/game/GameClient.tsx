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
    const [loadingMessage, setLoadingMessage] = useState("Connecting to server...");
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
        const initGame = async () => {
            try {
                setLoadingMessage("Authenticating...");

                const session = await apiPost<GameSession>("/api/game/session", {
                    gameSlug: slug,
                });

                if (!canvasRef.current) return;

                setLoadingMessage("Loading game...");

                const game = new Game(canvasRef.current, slug, {
                    gameToken: session.gameToken,
                    serverUrl: session.serverUrl,
                    userId: session.userId,
                    wallet: session.wallet,
                });
                gameRef.current = game;

                game.onStateChange = (state) => setHudState(state);
                game.onLoadStateChange = (loading) => setLoading(loading);
                game.onNotification = (msg, duration = 3000) => {
                    const id = ++notifIdRef.current;
                    setNotifications((prev) => [...prev, { id, message: msg, duration }]);
                };
                game.onChatMessage = (message) => {
                    setChatMessages((prev) => [...prev.slice(-99), message]);
                };
                game.onNicknameLoaded = (nick: string) => {
                    if (nick) setNickname(nick);
                };

                await game.init();
            } catch (error: any) {
                console.error("[GameClient] Init error:", error);

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
            setIsPointerLocked(!!document.pointerLockElement);
        };
        document.addEventListener("pointerlockchange", handleLockChange);
        return () => document.removeEventListener("pointerlockchange", handleLockChange);
    }, []);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.code === "Escape" && !isPaused) {
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
        setIsPaused(false);
        gameRef.current?.setPaused(false);
        canvasRef.current?.requestPointerLock();
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
            <div className="relative w-full h-screen bg-black flex items-center justify-center">
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
        <div className="relative w-full h-screen bg-black overflow-hidden">
            <canvas ref={canvasRef} className="w-full h-full block" />

            {loading && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50">
                    <Spinner size="lg" />
                    <p className="text-white mt-4 text-lg">{loadingMessage}</p>
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