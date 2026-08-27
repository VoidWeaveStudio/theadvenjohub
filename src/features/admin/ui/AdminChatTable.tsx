// src/features/admin/ui/AdminChatTable.tsx
"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { Trash2 } from "lucide-react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";
import { Alert, Badge, Chips, Empty, SearchInput, formatDate, truncateWallet } from "./AdminKit";

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

type StateFilter = "all" | "visible" | "deleted";

const STATE_OPTIONS: { id: StateFilter; label: string }[] = [
    { id: "all", label: "All messages" },
    { id: "visible", label: "Visible" },
    { id: "deleted", label: "Deleted" },
];

export const AdminChatTable = forwardRef<AdminTableRef>(function AdminChatTable(_props, ref) {
    const [messages, setMessages] = useState<ChatMessageRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [state, setState] = useState<StateFilter>("all");
    const [page, setPage] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const { signedFetch } = useAdminSignature();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (query.trim()) params.set("q", query.trim());
            if (state !== "all") params.set("state", state);
            params.set("page", String(page));

            const res = await fetch(`/api/admin/chat?${params.toString()}`, { credentials: "include" });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setError(data?.error || `HTTP ${res.status}`);
                return;
            }
            setMessages(data.messages || []);
        } catch {
            setError("Failed to load chat");
        } finally {
            setLoading(false);
        }
    }, [query, state, page]);

    useImperativeHandle(ref, () => ({ refresh: load }));

    useEffect(() => {
        const timer = setTimeout(load, query ? 300 : 0);
        return () => clearTimeout(timer);
    }, [load, query]);

    useEffect(() => {
        setPage(1);
    }, [query, state]);

    const handleDelete = async (messageId: string) => {
        if (!confirm("Delete this chat message?")) return;
        setError(null);
        try {
            const res = await signedFetch(`/api/admin/chat/${messageId}`, "deleteChatMessage", messageId);
            if (!res.ok) {
                setError("Failed to delete message");
                return;
            }
            setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m)));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Signature failed");
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="a-row">
                <SearchInput value={query} onChange={setQuery} placeholder="Search nickname, wallet or message text…" />
                <Chips value={state} options={STATE_OPTIONS} onChange={setState} />
            </div>

            {error && <Alert tone="bad">{error}</Alert>}

            {loading && messages.length === 0 ? (
                <Empty>Loading…</Empty>
            ) : messages.length === 0 ? (
                <Empty>No messages match.</Empty>
            ) : (
                <div className="a-list">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className="a-item"
                            style={{
                                alignItems: "flex-start",
                                background: message.deletedAt ? "rgba(255,107,107,0.06)" : undefined,
                                borderColor: message.deletedAt ? "rgba(255,107,107,0.2)" : undefined,
                            }}
                        >
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="a-row" style={{ gap: 8 }}>
                                    <span style={{ fontWeight: 700 }}>{message.senderNickname}</span>
                                    <span className="a-hint a-mono">{truncateWallet(message.senderWallet)}</span>
                                    {message.factionName && <Badge tone="info">${message.factionSymbol || message.factionName}</Badge>}
                                    <span className="a-hint">{formatDate(message.createdAt)}</span>
                                </div>
                                <p
                                    style={{
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                        fontSize: 13,
                                        marginTop: 3,
                                        color: message.deletedAt ? "var(--a-mute)" : "var(--a-text)",
                                        textDecoration: message.deletedAt ? "line-through" : "none",
                                    }}
                                >
                                    {message.message}
                                </p>
                                {message.deletedAt && (
                                    <p className="a-hint" style={{ color: "var(--a-bad)" }}>
                                        Deleted {formatDate(message.deletedAt)} by {truncateWallet(message.deletedByAdminWallet)}
                                    </p>
                                )}
                            </div>
                            {!message.deletedAt && (
                                <button type="button" className="a-icon-btn" data-tone="bad" title="Delete message" onClick={() => handleDelete(message.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="a-row">
                <span className="a-hint">Page {page}</span>
                <span className="a-spacer" />
                <button type="button" className="a-btn a-btn-sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                </button>
                <button type="button" className="a-btn a-btn-sm" disabled={messages.length < 100} onClick={() => setPage((p) => p + 1)}>
                    Next
                </button>
            </div>
        </div>
    );
});
