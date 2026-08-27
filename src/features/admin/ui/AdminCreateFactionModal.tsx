// src/features/admin/ui/AdminCreateFactionModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useAdminSignature } from "../lib/useAdminSignature";
import { Alert, Modal } from "./AdminKit";

interface TokenPreview {
    name: string;
    symbol: string;
    image: string | null;
}

interface AdminCreateFactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}

export function AdminCreateFactionModal({ isOpen, onClose, onCreated }: AdminCreateFactionModalProps) {
    const [ca, setCa] = useState("");
    const [tokenPreview, setTokenPreview] = useState<TokenPreview | null>(null);
    const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "not_found">("idle");
    const [manualName, setManualName] = useState("");
    const [manualSymbol, setManualSymbol] = useState("");
    const [manualImage, setManualImage] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { signedFetch } = useAdminSignature();

    useEffect(() => {
        if (!isOpen) {
            setCa("");
            setTokenPreview(null);
            setPreviewStatus("idle");
            setManualName("");
            setManualSymbol("");
            setManualImage("");
            setError(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
        setTokenPreview(null);

        const trimmed = ca.trim();
        if (trimmed.length < 32) {
            setPreviewStatus("idle");
            return;
        }

        setPreviewStatus("loading");
        previewDebounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/token-by-ca?ca=${encodeURIComponent(trimmed)}`);
                const json = await res.json();
                if (json && json.name) {
                    setTokenPreview({ name: json.name, symbol: json.symbol || "", image: json.image || null });
                    setPreviewStatus("idle");
                } else {
                    setPreviewStatus("not_found");
                }
            } catch {
                setPreviewStatus("not_found");
            }
        }, 400);

        return () => {
            if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
        };
    }, [ca]);

    if (!isOpen) return null;

    const trimmedCa = ca.trim();
    const canCreate = trimmedCa.length >= 32 && (!!tokenPreview || manualName.trim().length > 0);

    const handleCreate = async () => {
        if (!canCreate || creating) return;
        setCreating(true);
        setError(null);
        try {
            const res = await signedFetch(
                "/api/admin/factions",
                "createFaction",
                trimmedCa,
                {
                    ca: trimmedCa,
                    ...(!tokenPreview ? {
                        name: manualName.trim(),
                        symbol: manualSymbol.trim() || undefined,
                        image: manualImage.trim() || undefined,
                    } : {}),
                },
                "POST"
            );
            const data = await res.json();
            if (res.ok) {
                onCreated();
                onClose();
            } else if (data.error === "already_exists") {
                setError(`A faction for this token already exists: ${data.faction?.name ?? "unknown"}`);
            } else if (data.error === "name_required") {
                setError("Token not found automatically — enter a name manually below.");
            } else {
                setError(data.error || "Failed to create faction");
            }
        } catch (err: any) {
            setError(err.message || "Signature failed");
        } finally {
            setCreating(false);
        }
    };

    return (
        <Modal onClose={onClose} size="sm">
            <header className="a-modal-head">
                <span className="a-top-title" style={{ flex: 1 }}>Create faction</span>
                <button type="button" className="a-icon-btn" onClick={onClose} aria-label="Close">✕</button>
            </header>
            <div className="a-modal-body">
                <p className="a-hint">
                    Creates an empty faction for free — no payment, no member yet. The real token creator can join it
                    in-game and use creator verification to take it over.
                </p>

                <input
                    type="text"
                    value={ca}
                    onChange={(e) => setCa(e.target.value.slice(0, 64))}
                    placeholder="Token contract address..."
                    autoFocus
                    className="a-mono" style={{ width: "100%" }}
                />

                {previewStatus === "loading" && <p className="a-hint">Looking up token…</p>}

                {tokenPreview ? (
                    <div className="a-item">
                        {tokenPreview.image ? (
                            <img src={tokenPreview.image} alt="" style={{ width: 36, height: 36, borderRadius: 999, objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                            <div style={{ width: 36, height: 36, borderRadius: 999, background: "var(--a-panel-3)", flexShrink: 0 }} />
                        )}
                        <div style={{ fontWeight: 700, fontSize: 13 }}>
                            {tokenPreview.name} {tokenPreview.symbol && <span className="a-hint">${tokenPreview.symbol}</span>}
                        </div>
                    </div>
                ) : previewStatus === "not_found" && trimmedCa.length >= 32 ? (
                    <div className="a-item" style={{ flexDirection: "column", alignItems: "stretch", gap: 8, padding: 11 }}>
                        <p className="a-hint" style={{ color: "var(--a-warn)" }}>Not found automatically — enter details manually:</p>
                        <input
                            type="text"
                            value={manualName}
                            onChange={(e) => setManualName(e.target.value.slice(0, 50))}
                            placeholder="Faction name (required)"
                            style={{ width: "100%" }}
                        />
                        <input
                            type="text"
                            value={manualSymbol}
                            onChange={(e) => setManualSymbol(e.target.value.slice(0, 20))}
                            placeholder="Symbol (optional)"
                            style={{ width: "100%" }}
                        />
                        <input
                            type="text"
                            value={manualImage}
                            onChange={(e) => setManualImage(e.target.value.slice(0, 512))}
                            placeholder="Image URL (optional)"
                            style={{ width: "100%" }}
                        />
                    </div>
                ) : null}

                {error && <Alert tone="bad">{error}</Alert>}

                <button type="button" onClick={handleCreate} disabled={!canCreate || creating} className="a-btn a-btn-primary" style={{ width: "100%" }}>
                    {creating ? "Creating…" : "Create faction"}
                </button>
            </div>
        </Modal>
    );
}
