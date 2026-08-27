// src/features/admin/ui/AdminBasementTable.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";
import { Alert, Empty } from "./AdminKit";

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

    if (loading) return <Empty>Loading basement columns…</Empty>;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="a-hint">
                Token shown on each Basement pedestal in{" "}
                <strong style={{ color: "var(--a-text)" }}>{gameName ?? "—"}</strong>
                {gameSlug ? <span className="a-mono"> ({gameSlug})</span> : null}. Leave a field empty and
                save to make the pedestal empty. Players in the Basement pick the change up within 30 seconds.
            </div>

            {error && <Alert tone="bad">{error}</Alert>}

            <div className="a-list">
                {columns.map((col) => {
                    const draft = drafts[col.slot] ?? "";
                    const dirty = draft.trim() !== (col.tokenCa || "");

                    return (
                        <div key={col.slot} className="a-item">
                            <span className="a-label" style={{ width: 78, marginBottom: 0, flexShrink: 0 }}>Column {col.slot + 1}</span>
                            <input
                                type="text"
                                value={draft}
                                onChange={(e) => setDrafts((prev) => ({ ...prev, [col.slot]: e.target.value }))}
                                placeholder="Token contract address (empty = no token)"
                                className="a-mono" style={{ flex: 1, minWidth: 0 }}
                            />
                            <button
                                onClick={() => save(col.slot, draft.trim())}
                                disabled={!dirty || busySlot === col.slot}
                                className="a-btn a-btn-sm a-btn-primary"
                            >
                                <Save />
                                Save
                            </button>
                            <button
                                onClick={() => save(col.slot, "")}
                                disabled={!col.tokenCa || busySlot === col.slot}
                                className="a-btn a-btn-sm a-btn-danger"
                            >
                                <Trash2 />
                                Clear
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
