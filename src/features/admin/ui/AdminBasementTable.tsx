// src/features/admin/ui/AdminBasementTable.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";

interface BasementColumn {
    slot: number;
    tokenCa: string | null;
    updatedAt: string | null;
}

export const AdminBasementTable = forwardRef<AdminTableRef>(function AdminBasementTable(_props, ref) {
    const [columns, setColumns] = useState<BasementColumn[]>([]);
    const [gameSlug, setGameSlug] = useState<string | null>(null);
    const [gameName, setGameName] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(true);
    const [busySlot, setBusySlot] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { signedFetch } = useAdminSignature();

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/basement", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setColumns(data.columns || []);
                setGameSlug(data.gameSlug || null);
                setGameName(data.gameName || null);
                const next: Record<number, string> = {};
                for (const col of data.columns || []) {
                    next[col.slot] = col.tokenCa || "";
                }
                setDrafts(next);
            }
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ refresh: load }));

    useEffect(() => {
        load();
    }, []);

    const save = async (slot: number, tokenCa: string) => {
        setError(null);
        setBusySlot(slot);
        try {
            const res = await signedFetch(
                "/api/admin/basement",
                tokenCa ? "basement_set" : "basement_clear",
                `slot:${slot}`,
                { slot, tokenCa, gameSlug }
            );
            if (res.ok) {
                const data = await res.json();
                setColumns((prev) => prev.map((c) => (c.slot === slot ? { ...c, tokenCa: data.tokenCa } : c)));
                setDrafts((prev) => ({ ...prev, [slot]: data.tokenCa || "" }));
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Save failed");
            }
        } catch (err: any) {
            setError(err.message || "Save failed");
        } finally {
            setBusySlot(null);
        }
    };

    if (loading) return <div className="text-[#8B8F98] text-sm">Loading basement columns...</div>;

    return (
        <div className="space-y-3">
            <div className="text-[#8B8F98] text-sm">
                Token shown on each Basement pedestal in{" "}
                <span className="text-[#E5E7EB] font-bold">{gameName ?? "—"}</span>
                {gameSlug ? <span className="text-[#6B7280] font-mono"> ({gameSlug})</span> : null}. Leave a field empty and
                save to make the pedestal empty. Players in the Basement pick the change up within 30 seconds.
            </div>

            {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
            )}

            <div className="space-y-2">
                {columns.map((col) => {
                    const draft = drafts[col.slot] ?? "";
                    const dirty = draft.trim() !== (col.tokenCa || "");

                    return (
                        <div key={col.slot} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-2">
                            <span className="w-16 text-[#8B8F98] text-xs font-bold flex-shrink-0">Column {col.slot + 1}</span>
                            <input
                                type="text"
                                value={draft}
                                onChange={(e) => setDrafts((prev) => ({ ...prev, [col.slot]: e.target.value }))}
                                placeholder="Token contract address (empty = no token)"
                                className="flex-1 bg-black/40 text-white px-3 py-1.5 rounded text-xs font-mono border border-white/10 focus:border-cyan-500/50 outline-none"
                            />
                            <button
                                onClick={() => save(col.slot, draft.trim())}
                                disabled={!dirty || busySlot === col.slot}
                                className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-xs font-bold px-2 py-1 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <Save className="w-3.5 h-3.5" />
                                Save
                            </button>
                            <button
                                onClick={() => save(col.slot, "")}
                                disabled={!col.tokenCa || busySlot === col.slot}
                                className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Clear
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
