// src/features/game/ui/hooks/usePrivateMessagesState.ts
import { useCallback, useState } from "react";

export interface DmMessage {
    text: string;
    fromMe: boolean;
    timestamp: number;
}

export interface DmThread {
    wallet: string;
    nickname: string;
    messages: DmMessage[];
}

export function usePrivateMessagesState() {
    const [threads, setThreads] = useState<DmThread[]>([]);
    const [focusWallet, setFocusWallet] = useState<{ wallet: string; token: number } | null>(null);

    const openThread = useCallback((wallet: string, nickname: string) => {
        setThreads((prev) => (prev.some((t) => t.wallet === wallet) ? prev : [...prev, { wallet, nickname, messages: [] }]));
        setFocusWallet({ wallet, token: Date.now() });
    }, []);

    const closeThread = useCallback((wallet: string) => {
        setThreads((prev) => prev.filter((t) => t.wallet !== wallet));
    }, []);

    const handlePrivateMessage = useCallback((data: { fromWallet: string; fromNickname: string; text: string; timestamp: number }) => {
        const msg: DmMessage = { text: data.text, fromMe: false, timestamp: data.timestamp };
        setThreads((prev) => {
            const exists = prev.some((t) => t.wallet === data.fromWallet);
            if (exists) {
                return prev.map((t) => (t.wallet === data.fromWallet ? { ...t, messages: [...t.messages, msg] } : t));
            }
            return [...prev, { wallet: data.fromWallet, nickname: data.fromNickname, messages: [msg] }];
        });
    }, []);

    const handlePrivateMessageSent = useCallback((data: { toWallet: string; toNickname: string; text: string; timestamp: number }) => {
        const msg: DmMessage = { text: data.text, fromMe: true, timestamp: data.timestamp };
        setThreads((prev) => {
            const exists = prev.some((t) => t.wallet === data.toWallet);
            if (exists) {
                return prev.map((t) => (t.wallet === data.toWallet ? { ...t, messages: [...t.messages, msg] } : t));
            }
            return [...prev, { wallet: data.toWallet, nickname: data.toNickname, messages: [msg] }];
        });
    }, []);

    return {
        threads,
        focusWallet,
        openThread,
        closeThread,
        handlePrivateMessage,
        handlePrivateMessageSent,
    };
}
