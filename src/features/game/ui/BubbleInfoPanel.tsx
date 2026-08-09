// src/features/game/ui/BubbleInfoPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { SoundManager } from "../core/SoundManager";

interface BubbleOwner {
    found: boolean;
    index: number;
    ownerUserId: string;
    isSelf: boolean;
    roomAccess: string;
    canEnter: boolean;
    denialReason: string | null;
    nickname: string | null;
    wallet: string;
    joinedAt: string;
    faction: {
        id: string;
        name: string;
        symbol: string | null;
        image: string | null;
        isAdmin: boolean;
    } | null;
}

interface BubbleInfoPanelProps {
    bubbleIndex: number | null;
    onClose: () => void;
    onEnterRoom: (ownerUserId: string) => void;
    onSetWaypoint: (bubbleIndex: number) => void;
}

export function BubbleInfoPanel({ bubbleIndex, onClose, onEnterRoom, onSetWaypoint }: BubbleInfoPanelProps) {
    const [owner, setOwner] = useState<BubbleOwner | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (bubbleIndex === null) {
            setOwner(null);
            setError(null);
            return;
        }

        SoundManager.getInstance().play('modal-open');

        let cancelled = false;
        setLoading(true);
        setError(null);
        setOwner(null);

        fetch(`/api/game/bubble-owner?index=${bubbleIndex}`)
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                if (data.error) throw new Error(data.error);
                setOwner(data);
            })
            .catch(() => {
                if (!cancelled) setError("Could not read this bubble.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [bubbleIndex]);

    if (bubbleIndex === null) return null;

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto font-oxanium p-4">
            <div className="w-full max-w-sm bg-[rgba(10,14,22,0.95)] border-2 border-[#66CCFF]/35 rounded-[16px] p-6 shadow-[0_0_35px_rgba(102,204,255,0.15)]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-[#66CCFF]" />
                        <h2 className="text-xl font-black text-[#E5E7EB]">Bubble #{bubbleIndex + 1}</h2>
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        ✕
                    </button>
                </div>

                {loading && (
                    <div className="flex items-center gap-2 text-[#8B8F98] text-sm py-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Reading the bubble...
                    </div>
                )}

                {error && (
                    <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {error}
                    </p>
                )}

                {owner && !owner.found && (
                    <p className="text-[#8B8F98] text-sm">This bubble has no owner yet.</p>
                )}

                {owner && owner.found && (
                    <div className="space-y-3">
                        <div className="bg-white/5 rounded-lg p-3">
                            <div className="text-[#8B8F98] text-xs uppercase tracking-wide mb-1">Belongs to</div>
                            <div className="text-[#E5E7EB] font-bold text-lg">
                                {owner.nickname ?? "Unnamed drifter"}
                            </div>
                            <div className="text-[#8B8F98] text-xs font-mono mt-1">{owner.wallet}</div>
                        </div>

                        {owner.faction ? (
                            <div className={`flex items-center gap-3 rounded-lg p-3 ${owner.faction.isAdmin ? "bg-[#E8A33D]/10 border border-[#E8A33D]/30" : "bg-white/5"}`}>
                                {owner.faction.image ? (
                                    <img src={owner.faction.image} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0" />
                                )}
                                <div>
                                    <div className="text-[#8B8F98] text-xs uppercase tracking-wide">Faction</div>
                                    <div className={`font-bold text-sm ${owner.faction.isAdmin ? "text-[#E8A33D]" : "text-[#E5E7EB]"}`}>
                                        {owner.faction.name}
                                        {owner.faction.symbol && <span className="text-[#8B8F98]"> ${owner.faction.symbol}</span>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-[#8B8F98] text-sm">Not aligned with any faction.</p>
                        )}

                        <div className="text-[#8B8F98] text-xs">
                            Drifting here since {new Date(owner.joinedAt).toLocaleDateString()}
                        </div>

                        <div className="flex flex-col gap-2 pt-1">
                            {owner.canEnter ? (
                                <button
                                    onClick={() => {
                                        onEnterRoom(owner.ownerUserId);
                                        onClose();
                                    }}
                                    className="btn-primary px-4 py-2 text-sm w-full"
                                >
                                    {owner.isSelf ? "Enter my room" : "Enter room"}
                                </button>
                            ) : (
                                <p className="text-[#FFD166] text-sm bg-[#FFD166]/10 border border-[#FFD166]/20 rounded-lg px-3 py-2">
                                    {owner.denialReason ?? "You cannot enter this room."}
                                </p>
                            )}

                            <button
                                onClick={() => {
                                    onSetWaypoint(owner.index);
                                    onClose();
                                }}
                                className="btn-secondary px-4 py-2 text-sm w-full"
                            >
                                Mark this bubble
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
