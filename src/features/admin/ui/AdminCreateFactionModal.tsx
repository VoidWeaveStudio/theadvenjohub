// src/features/admin/ui/AdminCreateFactionModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useAdminSignature } from "../lib/useAdminSignature";

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
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="w-full max-w-md bg-[#0a0a0c] border border-[rgba(255,255,255,0.1)] rounded-xl p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-white text-lg font-bold">Create Faction</h2>
                    <button onClick={onClose} className="text-[#8B8F98] hover:text-white text-sm">✕</button>
                </div>

                <p className="text-[#8B8F98] text-sm">
                    Creates an empty faction for free — no payment, no member yet. The real token creator can join it
                    in-game and use creator verification to take it over.
                </p>

                <input
                    type="text"
                    value={ca}
                    onChange={(e) => setCa(e.target.value.slice(0, 64))}
                    placeholder="Token contract address..."
                    autoFocus
                    className="w-full bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none font-mono"
                />

                {previewStatus === "loading" && <p className="text-[#8B8F98] text-sm">Looking up token...</p>}

                {tokenPreview ? (
                    <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                        {tokenPreview.image ? (
                            <img src={tokenPreview.image} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
                        )}
                        <div className="text-[#E5E7EB] font-bold text-sm">
                            {tokenPreview.name} {tokenPreview.symbol && <span className="text-[#8B8F98]">${tokenPreview.symbol}</span>}
                        </div>
                    </div>
                ) : previewStatus === "not_found" && trimmedCa.length >= 32 ? (
                    <div className="space-y-2 bg-white/5 rounded-lg p-3">
                        <p className="text-[#FFD166] text-xs">Not found automatically — enter details manually:</p>
                        <input
                            type="text"
                            value={manualName}
                            onChange={(e) => setManualName(e.target.value.slice(0, 50))}
                            placeholder="Faction name (required)"
                            className="w-full bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 outline-none"
                        />
                        <input
                            type="text"
                            value={manualSymbol}
                            onChange={(e) => setManualSymbol(e.target.value.slice(0, 20))}
                            placeholder="Symbol (optional)"
                            className="w-full bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 outline-none"
                        />
                        <input
                            type="text"
                            value={manualImage}
                            onChange={(e) => setManualImage(e.target.value.slice(0, 512))}
                            placeholder="Image URL (optional)"
                            className="w-full bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 outline-none"
                        />
                    </div>
                ) : null}

                {error && (
                    <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {error}
                    </p>
                )}

                <button
                    onClick={handleCreate}
                    disabled={!canCreate || creating}
                    className="btn-primary px-4 py-2 text-sm w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {creating ? "Creating..." : "Create Faction"}
                </button>
            </div>
        </div>
    );
}
