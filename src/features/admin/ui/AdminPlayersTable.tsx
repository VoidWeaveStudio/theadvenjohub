// src/features/admin/ui/AdminPlayersTable.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { AdminPlayerDetailModal } from "./AdminPlayerDetailModal";
import { AdminTableRef } from "./AdminTableRef";

interface AdminPlayer {
    id: string;
    wallet: string;
    nickname: string | null;
    isBanned: boolean;
    banReason: string | null;
    isOnline: boolean;
    lastSeenAt: string | null;
    createdAt: string;
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function formatLastSeen(iso: string | null): string {
    if (!iso) return "never";
    const date = new Date(iso);
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
}

export const AdminPlayersTable = forwardRef<AdminTableRef>(function AdminPlayersTable(_props, ref) {
    const [players, setPlayers] = useState<AdminPlayer[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const loadPlayers = async (q: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/players${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
                credentials: "include",
            });
            if (res.ok) {
                const data = await res.json();
                setPlayers(data.players || []);
            }
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ refresh: () => loadPlayers(query) }));

    useEffect(() => {
        loadPlayers("");
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        loadPlayers(query);
    };

    const handleBanChanged = (userId: string, isBanned: boolean, banReason: string | null) => {
        setPlayers((prev) => prev.map((p) => (p.id === userId ? { ...p, isBanned, banReason } : p)));
    };

    return (
        <div className="space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by wallet or nickname..."
                    className="flex-1 bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none"
                />
                <button type="submit" className="btn-secondary px-4 py-2 text-sm">Search</button>
            </form>

            {loading ? (
                <p className="text-[#8B8F98] text-sm">Loading...</p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-[rgba(255,255,255,0.08)]">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-[rgba(255,255,255,0.04)] text-[#8B8F98] text-xs">
                                <th className="text-left px-3 py-2">Player</th>
                                <th className="text-left px-3 py-2">Wallet</th>
                                <th className="text-left px-3 py-2">Status</th>
                                <th className="text-left px-3 py-2">Last Seen</th>
                                <th className="text-left px-3 py-2">Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {players.map((p) => (
                                <tr
                                    key={p.id}
                                    onClick={() => setSelectedUserId(p.id)}
                                    className="border-t border-[rgba(255,255,255,0.06)] cursor-pointer hover:bg-[rgba(255,255,255,0.03)]"
                                >
                                    <td className="px-3 py-2 text-[#E5E7EB]">{p.nickname || "—"}</td>
                                    <td className="px-3 py-2 text-[#8B8F98] font-mono text-xs">{truncateWallet(p.wallet)}</td>
                                    <td className="px-3 py-2">
                                        <span className={`inline-flex items-center gap-1.5 ${p.isOnline ? "text-green-400" : "text-[#6B7280]"}`}>
                                            <span className={`w-2 h-2 rounded-full ${p.isOnline ? "bg-green-400" : "bg-[#6B7280]"}`} />
                                            {p.isOnline ? "Online" : "Offline"}
                                        </span>
                                        {p.isBanned && (
                                            <span className="ml-2 text-red-400 text-xs font-bold">BANNED{p.banReason ? `: ${p.banReason}` : ""}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-[#8B8F98]">{formatLastSeen(p.lastSeenAt)}</td>
                                    <td className="px-3 py-2 text-[#8B8F98]">{new Date(p.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <AdminPlayerDetailModal
                userId={selectedUserId}
                onClose={() => setSelectedUserId(null)}
                onBanChanged={handleBanChanged}
            />
        </div>
    );
});
