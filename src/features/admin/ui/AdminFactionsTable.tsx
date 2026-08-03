// src/features/admin/ui/AdminFactionsTable.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { AdminFactionDetailModal } from "./AdminFactionDetailModal";
import { AdminCreateFactionModal } from "./AdminCreateFactionModal";
import { AdminTableRef } from "./AdminTableRef";

interface AdminFaction {
    id: string;
    number: number;
    name: string;
    symbol: string | null;
    image: string | null;
    tokenCa: string | null;
    founderWallet: string;
    level: number;
    levelProgressAsh: number;
    createdAt: string;
    memberCount: number;
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export const AdminFactionsTable = forwardRef<AdminTableRef>(function AdminFactionsTable(_props, ref) {
    const [factions, setFactions] = useState<AdminFaction[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const loadFactions = async (q: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/factions${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
                credentials: "include",
            });
            if (res.ok) {
                const data = await res.json();
                setFactions(data.factions || []);
            }
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ refresh: () => loadFactions(query) }));

    useEffect(() => {
        loadFactions("");
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        loadFactions(query);
    };

    const handleDeleted = (factionId: string) => {
        setFactions((prev) => prev.filter((f) => f.id !== factionId));
    };

    return (
        <div className="space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by faction name..."
                    className="flex-1 bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none"
                />
                <button type="submit" className="btn-secondary px-4 py-2 text-sm">Search</button>
                <button type="button" onClick={() => setIsCreateOpen(true)} className="btn-primary px-4 py-2 text-sm flex-shrink-0">
                    + Create Faction
                </button>
            </form>

            {loading ? (
                <p className="text-[#8B8F98] text-sm">Loading...</p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-[rgba(255,255,255,0.08)]">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-[rgba(255,255,255,0.04)] text-[#8B8F98] text-xs">
                                <th className="text-left px-3 py-2">Faction</th>
                                <th className="text-left px-3 py-2">Level</th>
                                <th className="text-left px-3 py-2">Members</th>
                                <th className="text-left px-3 py-2">Founder</th>
                                <th className="text-left px-3 py-2">Token CA</th>
                                <th className="text-left px-3 py-2">Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {factions.map((f) => (
                                <tr
                                    key={f.id}
                                    onClick={() => setSelectedFactionId(f.id)}
                                    className="border-t border-[rgba(255,255,255,0.06)] cursor-pointer hover:bg-[rgba(255,255,255,0.03)]"
                                >
                                    <td className="px-3 py-2 text-[#E5E7EB]">{f.name} #{f.number}</td>
                                    <td className="px-3 py-2 text-[#4FD1FF] font-bold">Lv.{f.level}</td>
                                    <td className="px-3 py-2 text-[#8B8F98]">{f.memberCount}</td>
                                    <td className="px-3 py-2 text-[#8B8F98] font-mono text-xs">{truncateWallet(f.founderWallet)}</td>
                                    <td className="px-3 py-2 text-[#8B8F98] font-mono text-xs">{f.tokenCa ? truncateWallet(f.tokenCa) : "—"}</td>
                                    <td className="px-3 py-2 text-[#8B8F98]">{new Date(f.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <AdminFactionDetailModal factionId={selectedFactionId} onClose={() => setSelectedFactionId(null)} onDeleted={handleDeleted} />
            <AdminCreateFactionModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onCreated={() => loadFactions(query)}
            />
        </div>
    );
});
