// src/features/game/ui/Chat.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { X as XIcon } from "lucide-react";
import { PlayerTag } from "./shell/PlayerTag";
import { NicknameMenu, NicknameMenuActions } from "./shell/NicknameMenu";
import { FactionSummary } from "../network/NetworkManager";
import { DmThread } from "./hooks/usePrivateMessagesState";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { useDevice } from "@/core/lib/useDevice";

interface ChatMessage {
    id: string;
    sender: string;
    senderWallet?: string;
    senderFactionSymbol?: string | null;
    senderFactionImage?: string | null;
    senderIsAdmin?: boolean;
    senderIsFactionCreator?: boolean;
    message: string;
    timestamp: number;
    type: "player" | "system";
}

type MainTab = "general" | "faction" | { dm: string };

function tabKey(tab: MainTab): string {
    return typeof tab === "string" ? tab : `dm:${tab.dm}`;
}

interface ChatProps {
    messages: ChatMessage[];
    factionMessages: Record<string, ChatMessage[]>;
    myFactions: FactionSummary[];
    dmThreads: DmThread[];
    dmFocus: { wallet: string; token: number } | null;
    myWallet: string;
    onSendMessage: (message: string) => void;
    onSendFactionMessage: (factionId: string, message: string) => void;
    onSendPrivateMessage: (wallet: string, message: string) => void;
    onCloseDmThread: (wallet: string) => void;
    isVisible: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    getNicknameMenuActions?: (wallet: string, nickname: string) => NicknameMenuActions;
}

export function Chat({
    messages,
    factionMessages,
    myFactions,
    dmThreads,
    dmFocus,
    myWallet,
    onSendMessage,
    onSendFactionMessage,
    onSendPrivateMessage,
    onCloseDmThread,
    isVisible,
    onExpandedChange,
    getNicknameMenuActions,
}: ChatProps) {
    const { t } = useLanguage();
    const device = useDevice();
    const touch = device.ready && device.isTouch && (device.isMobile || device.isTablet);
    const [input, setInput] = useState("");
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [activeTab, setActiveTab] = useState<MainTab>("general");
    const [activeFactionId, setActiveFactionId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [keyboardOffset, setKeyboardOffset] = useState(0);

    useEffect(() => {
        if (touch) setIsMinimized(true);
    }, [touch]);

    useEffect(() => {
        onExpandedChange?.(isVisible && !isMinimized);
    }, [isVisible, isMinimized, onExpandedChange]);

    useEffect(() => () => onExpandedChange?.(false), [onExpandedChange]);

    useEffect(() => {
        const viewport = typeof window !== "undefined" ? window.visualViewport : null;
        if (!viewport) return;

        const sync = () => {
            const hidden = window.innerHeight - viewport.height - viewport.offsetTop;
            setKeyboardOffset(hidden > 80 ? Math.round(hidden) : 0);
        };

        sync();
        viewport.addEventListener("resize", sync);
        viewport.addEventListener("scroll", sync);

        return () => {
            viewport.removeEventListener("resize", sync);
            viewport.removeEventListener("scroll", sync);
        };
    }, []);

    useEffect(() => {
        if (myFactions.length > 0 && !activeFactionId) {
            setActiveFactionId(myFactions[0].id);
        }
        if (myFactions.length === 0) {
            setActiveFactionId(null);
        }
    }, [myFactions, activeFactionId]);

    useEffect(() => {
        if (!dmFocus) return;
        setIsMinimized(false);
        setActiveTab({ dm: dmFocus.wallet });
    }, [dmFocus]);

    const activeKey = tabKey(activeTab);
    const activeDmWallet = typeof activeTab === "object" ? activeTab.dm : null;
    const activeDmThread = activeDmWallet ? dmThreads.find((t) => t.wallet === activeDmWallet) : null;

    let activeMessages: ChatMessage[];
    if (activeTab === "general") {
        activeMessages = messages;
    } else if (activeTab === "faction") {
        activeMessages = activeFactionId ? factionMessages[activeFactionId] || [] : [];
    } else {
        activeMessages = (activeDmThread?.messages || []).map((m, i) => ({
            id: `dm-${activeDmWallet}-${i}`,
            sender: m.fromMe ? t("g.chat.you") : activeDmThread?.nickname || t("g.chat.player"),
            message: m.text,
            timestamp: m.timestamp,
            type: "player" as const,
        }));
    }

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeMessages.length]);

    useEffect(() => {
        if (isInputFocused) {
            inputRef.current?.focus();
        }
    }, [isInputFocused]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const text = input.trim();
        if (!text) return;

        if (activeTab === "general") {
            onSendMessage(text);
        } else if (activeTab === "faction") {
            if (activeFactionId) onSendFactionMessage(activeFactionId, text);
        } else {
            onSendPrivateMessage(activeTab.dm, text);
        }

        setInput("");
        setIsInputFocused(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setIsInputFocused(false);
            inputRef.current?.blur();
        }
    };

    if (!isVisible) return null;

    if (isMinimized) {
        return (
            <div className={`absolute pointer-events-auto ${touch ? "bottom-3 left-3" : "bottom-24 left-4"}`} style={{ transform: `translateY(-${keyboardOffset}px)` }}>
                <button
                    onClick={() => setIsMinimized(false)}
                    className="bg-black/70 backdrop-blur border border-white/10 rounded-lg px-4 py-2 text-white font-bold text-sm hover:bg-black/90"
                >
                    💬 Chat
                </button>
            </div>
        );
    }

    const tabAccent = (tab: "general" | "faction" | "dm"): string => {
        if (tab === "general") return "#4FD1FF";
        if (tab === "faction") return "#C084FC";
        return "#4ADE80";
    };

    const isActiveTab = (tab: MainTab) => tabKey(tab) === activeKey;

    return (
        <div className={`absolute pointer-events-auto ${touch ? "bottom-3 left-3 w-[22rem] max-w-[calc(100vw-1.5rem)]" : "bottom-24 left-4 w-[30rem] max-w-[calc(100vw-2rem)]"}`} style={{ transform: `translateY(-${keyboardOffset}px)` }}>
            <div className="bg-black/70 backdrop-blur border border-white/10 rounded-lg overflow-hidden">
                <div className="bg-zinc-900/80 px-2 pt-2 border-b border-white/10 flex items-center gap-1">
                    <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab("general")}
                            className="bg-transparent border-0 px-3 py-1.5 rounded-t text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0"
                            style={{
                                color: isActiveTab("general") ? tabAccent("general") : "#8B8F98",
                                borderBottom: isActiveTab("general") ? `2px solid ${tabAccent("general")}` : "2px solid transparent",
                            }}
                        >
                            {t("g.chat.general")}
                        </button>

                        {myFactions.length > 0 && (
                            <button
                                onClick={() => setActiveTab("faction")}
                                className="bg-transparent border-0 px-3 py-1.5 rounded-t text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0"
                                style={{
                                    color: isActiveTab("faction") ? tabAccent("faction") : "#8B8F98",
                                    borderBottom: isActiveTab("faction") ? `2px solid ${tabAccent("faction")}` : "2px solid transparent",
                                }}
                            >
                                {t("g.chat.faction")}
                            </button>
                        )}

                        {dmThreads.map((t) => (
                            <div
                                key={t.wallet}
                                className="flex items-center gap-0.5 pl-2.5 pr-1 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors mb-1 flex-shrink-0"
                                style={{
                                    color: isActiveTab({ dm: t.wallet }) ? "#0A0E14" : tabAccent("dm"),
                                    background: isActiveTab({ dm: t.wallet }) ? tabAccent("dm") : "rgba(74,222,128,0.12)",
                                }}
                            >
                                <button
                                    onClick={() => setActiveTab({ dm: t.wallet })}
                                    className="bg-transparent border-0 p-0"
                                    style={{ color: "inherit" }}
                                >
                                    {t.nickname}
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCloseDmThread(t.wallet);
                                        if (isActiveTab({ dm: t.wallet })) setActiveTab("general");
                                    }}
                                    className="bg-transparent border-0 p-0 w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/20"
                                    style={{ color: "inherit" }}
                                >
                                    <XIcon className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => setIsMinimized(true)}
                        className="bg-transparent border-0 p-1 text-zinc-400 hover:text-white flex-shrink-0"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>

                {activeTab === "faction" && myFactions.length > 1 && (
                    <div className="flex gap-1 px-2 pt-2 flex-wrap">
                        {myFactions.map((f) => (
                            <button
                                key={f.id}
                                onClick={() => setActiveFactionId(f.id)}
                                className={`px-2 py-1 rounded text-[10px] font-bold ${activeFactionId === f.id ? "bg-[#C084FC] text-black" : "bg-white/5 text-[#8B8F98] hover:bg-white/10"}`}
                            >
                                ${f.symbol || f.name}
                            </button>
                        ))}
                    </div>
                )}

                <div className={`overflow-y-auto p-3 space-y-2 ${touch ? "h-[26dvh] min-h-[88px]" : "h-64"}`}>
                    {activeMessages.length === 0 ? (
                        <div className="text-zinc-500 text-sm text-center py-8">
                            {t("g.chat.noMessages")}
                        </div>
                    ) : (
                        <>
                            {activeMessages.map((msg) => (
                                <div key={msg.id} className="text-sm">
                                    {msg.type === "system" ? (
                                        <div className="text-cyan-400 italic">
                                            {msg.message}
                                        </div>
                                    ) : (
                                        <div>
                                            {msg.senderWallet && getNicknameMenuActions ? (
                                                <NicknameMenu {...getNicknameMenuActions(msg.senderWallet, msg.sender)} className="text-cyan-300 font-semibold">
                                                    <PlayerTag
                                                        nickname={msg.sender}
                                                        faction={msg.senderFactionSymbol ? { image: msg.senderFactionImage ?? null, symbol: msg.senderFactionSymbol, number: 0 } : null}
                                                        size="sm"
                                                        layout="inline"
                                                        isAdmin={msg.senderIsAdmin}
                                                        isFactionCreator={msg.senderIsFactionCreator}
                                                    />
                                                    :
                                                </NicknameMenu>
                                            ) : (
                                                <span className="text-cyan-300 font-semibold">
                                                    <PlayerTag
                                                        nickname={msg.sender}
                                                        faction={msg.senderFactionSymbol ? { image: msg.senderFactionImage ?? null, symbol: msg.senderFactionSymbol, number: 0 } : null}
                                                        size="sm"
                                                        layout="inline"
                                                        isAdmin={msg.senderIsAdmin}
                                                        isFactionCreator={msg.senderIsFactionCreator}
                                                    />
                                                    :
                                                </span>
                                            )}
                                            <span className="text-white ml-2">{msg.message}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                <div className="border-t border-white/10 p-2">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                            onKeyDown={handleKeyDown}
                            placeholder={isInputFocused ? t("g.chat.placeholder") : t("g.chat.pressEnter")}
                            className="flex-1 bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none"
                            maxLength={200}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                        >
                            {t("g.chat.send")}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export type { ChatMessage };
