// src/features/admin/ui/AdminSupportTable.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";

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

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export const AdminSupportTable = forwardRef<AdminTableRef>(function AdminSupportTable(_props, ref) {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const { signedFetch } = useAdminSignature();

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/support", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setTickets(data.tickets || []);
            }
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ refresh: load }));

    useEffect(() => {
        load();
    }, []);

    const sendReply = async (ticketId: string) => {
        const reply = (replyDrafts[ticketId] || "").trim();
        if (!reply) return;

        setError(null);
        try {
            const res = await signedFetch(`/api/admin/support/${ticketId}`, "support_reply", ticketId, { reply });
            if (res.ok) {
                setTickets((prev) =>
                    prev.map((t) => (t.id === ticketId ? { ...t, status: "answered", reply, repliedAt: new Date().toISOString() } : t))
                );
                setReplyDrafts((prev) => ({ ...prev, [ticketId]: "" }));
            } else {
                setError("Failed to send reply");
            }
        } catch (err: any) {
            setError(err.message || "Signature failed");
        }
    };

    if (loading) return <p className="text-[#8B8F98] text-sm">Loading...</p>;

    return (
        <div className="space-y-4">
            {error && (
                <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}
            <p className="text-[#6B7280] text-[11px]">Replies require signing with your admin wallet and are sent to the player's in-game mail.</p>

            {tickets.length === 0 ? (
                <p className="text-[#8B8F98] text-sm">No support messages yet.</p>
            ) : (
                <div className="space-y-3">
                    {tickets.map((t) => (
                        <div key={t.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-white text-sm font-bold">{t.nickname || truncateWallet(t.wallet)}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[#6B7280] text-xs">{new Date(t.createdAt).toLocaleString()}</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.status === "open" ? "bg-[rgba(255,209,102,0.15)] text-[#FFD166]" : "bg-[rgba(74,222,128,0.15)] text-[#4ADE80]"}`}>
                                        {t.status === "open" ? "Open" : "Answered"}
                                    </span>
                                </div>
                            </div>
                            <p className="text-[#E5E7EB] text-sm font-bold mb-1">{t.subject}</p>
                            <p className="text-[#E5E7EB] text-sm whitespace-pre-wrap mb-3">{t.message}</p>

                            {t.status === "answered" ? (
                                <div className="bg-black/30 rounded-lg p-3">
                                    <div className="text-[#4ADE80] text-xs font-bold mb-1">Your reply</div>
                                    <p className="text-[#8B8F98] text-sm whitespace-pre-wrap">{t.reply}</p>
                                </div>
                            ) : (
                                <div className="flex items-start gap-2">
                                    <textarea
                                        value={replyDrafts[t.id] || ""}
                                        onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [t.id]: e.target.value.slice(0, 2000) }))}
                                        placeholder="Write a reply..."
                                        rows={2}
                                        className="flex-1 bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none resize-none"
                                    />
                                    <button
                                        onClick={() => sendReply(t.id)}
                                        disabled={!(replyDrafts[t.id] || "").trim()}
                                        className="btn-primary px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                                    >
                                        Reply
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
