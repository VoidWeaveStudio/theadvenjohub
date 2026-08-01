// src/features/admin/ui/AdminMaintenanceToggle.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";

export const AdminMaintenanceToggle = forwardRef<AdminTableRef>(function AdminMaintenanceToggle(_props, ref) {
    const [enabled, setEnabled] = useState(false);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { signedFetch } = useAdminSignature();

    const loadMaintenance = () => {
        setLoading(true);
        return fetch("/api/admin/maintenance", { credentials: "include" })
            .then((r) => r.json())
            .then((data) => {
                setEnabled(!!data.enabled);
                setMessage(data.message || "");
            })
            .finally(() => setLoading(false));
    };

    useImperativeHandle(ref, () => ({ refresh: () => { loadMaintenance(); } }));

    useEffect(() => {
        loadMaintenance();
    }, []);

    const toggle = async (next: boolean) => {
        setError(null);
        try {
            const res = await signedFetch("/api/admin/maintenance", next ? "maintenance_on" : "maintenance_off", "global", {
                enabled: next,
                message: message.trim() || undefined,
            });
            if (res.ok) {
                setEnabled(next);
            } else {
                setError("Failed to update maintenance mode");
            }
        } catch (err: any) {
            setError(err.message || "Signature failed");
        }
    };

    if (loading && !enabled && !message) return null;

    return (
        <div className={`rounded-lg p-4 border ${enabled ? "bg-red-500/10 border-red-500/30" : "bg-white/5 border-white/10"}`}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-white text-sm font-bold">🛠️ Maintenance Mode</div>
                    <div className="text-[#8B8F98] text-xs">
                        {enabled ? "Game is currently unavailable to players." : "Game is live for all players."}
                    </div>
                </div>
                <button
                    onClick={() => toggle(!enabled)}
                    className={enabled ? "btn-secondary px-4 py-2 text-xs" : "btn-primary px-4 py-2 text-xs"}
                >
                    {enabled ? "Disable" : "Enable"}
                </button>
            </div>
            <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Custom message shown to players (optional)"
                className="w-full mt-3 bg-zinc-900 text-white px-3 py-2 rounded text-xs border border-zinc-700 focus:border-cyan-500 outline-none"
            />
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>
    );
});
