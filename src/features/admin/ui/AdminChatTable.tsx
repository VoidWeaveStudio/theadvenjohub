// src/features/admin/ui/AdminChatTable.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Trash2 } from "lucide-react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";

interface ChatMessageRow {
    id: string;
    senderUserId: string;
    senderWallet: string;
    senderNickname: string;
    factionId: string | null;
    factionName: string | null;
    factionSymbol: string | null;
    message: string;
    createdAt: string;
    deletedAt: string | null;
    deletedByAdminWallet: string | null;
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export const AdminChatTable = forwardRef<AdminTableRef>(function AdminChatTable(_props, ref) {
    const [messages, setMessages] = useState<ChatMessageRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [error, setError] = useState<string | null>(null);
    const { signedFetch } = useAdminSignature();

    const load = async (q?: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            const res = await fetch(`/api/admin/chat?${params.toString()}`, { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
            }
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ refresh: () => load(query) }));

    useEffect(() => {
        load();
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        load(query);
    };

    const handleDelete = async (messageId: string) => {
        if (!confirm("Delete this chat message?")) return;
        setError(null);
        try {
            const res = await signedFetch(`/api/admin/chat/${messageId}`, "deleteChatMessage", messageId);
            if (res.ok) {
                setMessages((prev) =>
                    prev.map((m) => (m.id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m))
                );
            } else {
                setError("Failed to delete message");
            }
        } catch (err: any) {
            setError(err.message || "Signature failed");
        }
    };

    return (
        <div className="space-y-4">
            {error && (
                <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <form onSubmit={handleSearch} className="flex gap-2">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by nickname, wallet, or message text..."
                    className="flex-1 bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none"
                />
                <button type="submit" className="btn-primary px-4 py-2 text-xs flex-shrink-0">
                    Search
                </button>
            </form>

            {loading ? (
                <p className="text-[#8B8F98] text-sm">Loading...</p>
            ) : messages.length === 0 ? (
                <p className="text-[#8B8F98] text-sm">No messages found.</p>
            ) : (
                <div className="space-y-1.5">
                    {messages.map((m) => (
                        <div
                            key={m.id}
                            className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 border ${m.deletedAt ? "bg-red-500/5 border-red-500/20" : "bg-white/5 border-white/10"
                                }`}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-white text-xs font-bold">{m.senderNickname}</span>
                                    <span className="text-[#6B7280] text-[10px]">{truncateWallet(m.senderWallet)}</span>
                                    {m.factionName && (
                                        <span className="text-cyan-400 text-[10px] font-bold">${m.factionSymbol || m.factionName}</span>
                                    )}
                                    <span className="text-[#6B7280] text-[10px]">{new Date(m.createdAt).toLocaleString()}</span>
                                </div>
                                <p className={`text-sm whitespace-pre-wrap break-words ${m.deletedAt ? "text-[#6B7280] line-through" : "text-[#E5E7EB]"}`}>
                                    {m.message}
                                </p>
                                {m.deletedAt && (
                                    <p className="text-red-400 text-[10px] mt-0.5">
                                        Deleted {new Date(m.deletedAt).toLocaleString()} by {truncateWallet(m.deletedByAdminWallet || "?")}
                                    </p>
                                )}
                            </div>
                            {!m.deletedAt && (
                                <button
                                    onClick={() => handleDelete(m.id)}
                                    className="text-[#6B7280] hover:text-red-400 transition-colors flex-shrink-0"
                                    title="Delete message"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
