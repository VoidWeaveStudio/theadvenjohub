// src/features/admin/ui/AdminMaintenanceToggle.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Wrench } from "lucide-react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { AdminTableRef } from "./AdminTableRef";
import { Alert, Badge } from "./AdminKit";

export const AdminMaintenanceToggle = forwardRef<AdminTableRef>(function AdminMaintenanceToggle(_props, ref) {
    const [enabled, setEnabled] = useState(false);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
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
            .catch(() => setError("Failed to load maintenance status"))
            .finally(() => setLoading(false));
    };

    useImperativeHandle(ref, () => ({ refresh: () => { loadMaintenance(); } }));

    useEffect(() => {
        loadMaintenance();
    }, []);

    const toggle = async (next: boolean) => {
        setError(null);
        setBusy(true);
        try {
            const res = await signedFetch("/api/admin/maintenance", next ? "maintenance_on" : "maintenance_off", "global", {
                enabled: next,
                message: message.trim() || undefined,
            });
            if (!res.ok) {
                setError("Failed to update maintenance mode");
                return;
            }
            setEnabled(next);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Signature failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="a-panel" style={enabled ? { borderColor: "rgba(255,107,107,0.35)" } : undefined}>
            <header className="a-panel-head">
                <span className="a-panel-title">
                    <Wrench className="w-3 h-3" style={{ display: "inline", marginRight: 6 }} />
                    Maintenance mode
                </span>
                <div className="a-row a-spacer">
                    <Badge tone={enabled ? "bad" : "good"} dot>
                        {loading ? "checking…" : enabled ? "Game closed to players" : "Game is live"}
                    </Badge>
                    <button
                        type="button"
                        className={enabled ? "a-btn a-btn-good" : "a-btn a-btn-danger"}
                        disabled={busy}
                        onClick={() => toggle(!enabled)}
                    >
                        {enabled ? "Bring the game back" : "Close the game"}
                    </button>
                </div>
            </header>
            <div className="a-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Custom message shown to players (optional)"
                />
                <p className="a-hint">The message is saved together with the toggle, so set it before switching maintenance on.</p>
                {error && <Alert tone="bad">{error}</Alert>}
            </div>
        </section>
    );
});
