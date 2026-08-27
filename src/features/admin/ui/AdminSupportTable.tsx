// src/features/admin/ui/AdminSupportTable.tsx
"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";
import { Alert, Badge, Chips, Empty, SearchInput, formatDate, truncateWallet } from "./AdminKit";

interface SupportTicket {
    id: string;
    userId: string;
    wallet: string;
    nickname: string | null;
    subject: string;
    message: string;
    status: string;
    reply: string | null;
    repliedAt: string | null;
    createdAt: string;
}

type StatusFilter = "all" | "open" | "answered";

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "All tickets" },
    { id: "open", label: "Open" },
    { id: "answered", label: "Answered" },
];

export const AdminSupportTable = forwardRef<AdminTableRef>(function AdminSupportTable(_props, ref) {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<StatusFilter>("all");
    const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { signedFetch } = useAdminSignature();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (query.trim()) params.set("q", query.trim());
            if (status !== "all") params.set("status", status);

            const res = await fetch(`/api/admin/support?${params.toString()}`, { credentials: "include" });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setError(data?.error || `HTTP ${res.status}`);
                return;
            }
            setTickets(data.tickets || []);
        } catch {
            setError("Failed to load tickets");
        } finally {
            setLoading(false);
        }
    }, [query, status]);

    useImperativeHandle(ref, () => ({ refresh: load }));

    useEffect(() => {
        const timer = setTimeout(load, query ? 300 : 0);
        return () => clearTimeout(timer);
    }, [load, query]);

    const sendReply = async (ticketId: string) => {
        const reply = (replyDrafts[ticketId] || "").trim();
        if (!reply) return;

        setError(null);
        setBusyId(ticketId);
        try {
            const res = await signedFetch(`/api/admin/support/${ticketId}`, "support_reply", ticketId, { reply });
            if (!res.ok) {
                setError("Failed to send reply");
                return;
            }
            setTickets((prev) =>
                prev.map((t) => (t.id === ticketId ? { ...t, status: "answered", reply, repliedAt: new Date().toISOString() } : t))
            );
            setReplyDrafts((prev) => ({ ...prev, [ticketId]: "" }));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Signature failed");
        } finally {
            setBusyId(null);
        }
    };

    const openCount = tickets.filter((t) => t.status === "open").length;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="a-row">
                <SearchInput value={query} onChange={setQuery} placeholder="Search subject, message, nickname or wallet…" />
                <Chips value={status} options={STATUS_OPTIONS} onChange={setStatus} />
                <span className="a-hint a-spacer">{openCount} open of {tickets.length} shown</span>
            </div>

            {error && <Alert tone="bad">{error}</Alert>}
            <p className="a-hint">Replies are signed with your admin wallet and land in the player&apos;s in-game mail.</p>

            {loading && tickets.length === 0 ? (
                <Empty>Loading…</Empty>
            ) : tickets.length === 0 ? (
                <Empty>No support messages match.</Empty>
            ) : (
                <div className="a-list">
                    {tickets.map((ticket) => (
                        <article key={ticket.id} className="a-item" style={{ flexDirection: "column", alignItems: "stretch", gap: 8, padding: 12 }}>
                            <div className="a-row">
                                <span style={{ fontWeight: 700 }}>{ticket.nickname || truncateWallet(ticket.wallet)}</span>
                                <span className="a-hint a-mono">{truncateWallet(ticket.wallet)}</span>
                                <span className="a-spacer" />
                                <span className="a-hint">{formatDate(ticket.createdAt)}</span>
                                <Badge tone={ticket.status === "open" ? "warn" : "good"}>{ticket.status === "open" ? "Open" : "Answered"}</Badge>
                            </div>

                            <div>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{ticket.subject}</div>
                                <p style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "var(--a-dim)", marginTop: 3 }}>{ticket.message}</p>
                            </div>

                            {ticket.status === "answered" ? (
                                <div style={{ background: "rgba(0,0,0,0.28)", borderRadius: 9, padding: 10 }}>
                                    <div className="a-label" style={{ color: "var(--a-good)", marginBottom: 4 }}>
                                        Your reply · {formatDate(ticket.repliedAt)}
                                    </div>
                                    <p style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "var(--a-dim)" }}>{ticket.reply}</p>
                                </div>
                            ) : (
                                <div className="a-row" style={{ alignItems: "flex-start" }}>
                                    <textarea
                                        value={replyDrafts[ticket.id] || ""}
                                        onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [ticket.id]: e.target.value.slice(0, 2000) }))}
                                        placeholder="Write a reply…"
                                        rows={2}
                                        style={{ flex: 1, resize: "vertical", minWidth: 0 }}
                                    />
                                    <button
                                        type="button"
                                        className="a-btn a-btn-primary"
                                        disabled={!(replyDrafts[ticket.id] || "").trim() || busyId === ticket.id}
                                        onClick={() => sendReply(ticket.id)}
                                    >
                                        {busyId === ticket.id ? "Sending…" : "Reply"}
                                    </button>
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
});
