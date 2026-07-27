// src/features/game/ui/CreateFactionModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Flag, Users } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";

interface TokenPreview {
    name: string;
    symbol: string;
    image: string | null;
}

interface CreateFactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateFaction: (ca: string) => void;
}

function buildFactionDescriptionPreview(name: string, symbol: string): string {
    return symbol ? `Community faction for ${name} ($${symbol}).` : `Community faction for ${name}.`;
}

export function CreateFactionModal({ isOpen, onClose, onCreateFaction }: CreateFactionModalProps) {
    const [createCa, setCreateCa] = useState("");
    const [tokenPreview, setTokenPreview] = useState<TokenPreview | null>(null);
    const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "not_found">("idle");

    const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setCreateCa("");
            setTokenPreview(null);
            setPreviewStatus("idle");
        }
    }, [isOpen]);

    useEffect(() => {
        if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
        setTokenPreview(null);

        const trimmed = createCa.trim();
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
    }, [createCa]);

    const handleCreateSubmit = () => {
        if (!tokenPreview) return;
        onCreateFaction(createCa.trim());
        onClose();
    };

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title="Found a Faction"
            icon={<Flag className="w-4 h-4" />}
            size="md"
        >
            <div className="space-y-3">
                <p className="text-[#8B8F98] text-sm">
                    Paste the contract address of the token your faction represents. Name, symbol and image are pulled
                    automatically.
                </p>

                <input
                    type="text"
                    value={createCa}
                    onChange={(e) => setCreateCa(e.target.value.slice(0, 64))}
                    placeholder="Paste token CA..."
                    autoFocus
                    className="w-full bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none font-mono"
                />

                {previewStatus === "loading" && <p className="text-[#8B8F98] text-sm">Looking up token...</p>}
                {previewStatus === "not_found" && (
                    <p className="text-red-400 text-sm">Token not found for that address.</p>
                )}

                {tokenPreview && (
                    <div className="flex items-center gap-3 bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                        {tokenPreview.image ? (
                            <img src={tokenPreview.image} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.08)] flex items-center justify-center flex-shrink-0">
                                <Users className="w-6 h-6 text-[#8B8F98]" />
                            </div>
                        )}
                        <div className="flex-1">
                            <div className="text-[#E5E7EB] font-bold">
                                {tokenPreview.name}{" "}
                                {tokenPreview.symbol && <span className="text-[#8B8F98]">${tokenPreview.symbol}</span>}
                            </div>
                            <p className="text-[#8B8F98] text-xs mt-0.5">
                                {buildFactionDescriptionPreview(tokenPreview.name, tokenPreview.symbol)}
                            </p>
                        </div>
                    </div>
                )}

                <button
                    onClick={handleCreateSubmit}
                    disabled={!tokenPreview}
                    className="btn-primary px-4 py-2 text-sm w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Found Faction
                </button>
            </div>
        </WindowFrame>
    );
}
