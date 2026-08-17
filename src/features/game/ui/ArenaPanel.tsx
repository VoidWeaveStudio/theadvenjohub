// src/features/game/ui/ArenaPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { Flame, Swords, Trophy, Users, X } from "lucide-react";
import type { ArenaEndedData, ArenaStateData, PartyStateData } from "../network/NetworkManager";

interface ArenaPanelProps {
    isOpen: boolean;
    onClose: () => void;
    arena: ArenaStateData | null;
    party: PartyStateData;
    bestWave: number;
    cooldownUntil: number;
    summary: ArenaEndedData | null;
    onStart: () => void;
    onJoin: () => void;
    onLeave: () => void;
    onDismissSummary: () => void;
}

function formatCooldown(ms: number): string {
    const totalMinutes = Math.ceil(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

export function ArenaPanel({
    isOpen,
    onClose,
    arena,
    party,
    bestWave,
    cooldownUntil,
    summary,
    onStart,
    onJoin,
    onLeave,
    onDismissSummary,
}: ArenaPanelProps) {
    const [cooldownLeft, setCooldownLeft] = useState(0);

    useEffect(() => {
        if (!isOpen) return;

        const tick = () => setCooldownLeft(Math.max(0, cooldownUntil - Date.now()));
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [isOpen, cooldownUntil]);

    if (!isOpen) return null;

    const inRun = arena !== null;
    const canJoin = inRun && arena.phase === "prep";
    const partySize = party.members.length || 1;

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto p-4">
            <div className="w-full max-w-md bg-[rgba(12,14,16,0.95)] border-2 border-[#D4AF50]/40 rounded-[16px] p-6 shadow-[0_0_35px_rgba(212,175,80,0.15)]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-[#FFD166]" />
                        <h2 className="text-lg font-black text-[#E5E7EB]">Candle Defence</h2>
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {summary ? (
                    <div className="space-y-4">
                        <div className="text-center py-4">
                            <div className="text-[#8B8F98] text-xs tracking-widest uppercase">
                                {summary.reason === "candle_lost" ? "The candle went out" : "Your party fell"}
                            </div>
                            <div className="text-[#E5E7EB] text-4xl font-black mt-2">
                                {summary.wavesCleared} <span className="text-lg text-[#8B8F98]">waves</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-[rgba(255,209,102,0.08)] border border-[#FFD166]/25 rounded-lg px-3 py-2 text-center">
                                <div className="text-[#FFD166] text-lg font-bold">{summary.ash}</div>
                                <div className="text-[#8B8F98] text-[10px] tracking-wider">ASH</div>
                            </div>
                            <div className="bg-[rgba(138,212,255,0.08)] border border-[#8AD4FF]/25 rounded-lg px-3 py-2 text-center">
                                <div className="text-[#8AD4FF] text-lg font-bold">{summary.xp}</div>
                                <div className="text-[#8B8F98] text-[10px] tracking-wider">XP</div>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-2 text-[#8B8F98] text-xs">
                            <Trophy className="w-3.5 h-3.5 text-[#FFD166]" />
                            <span>Best run: wave {summary.bestWave}</span>
                        </div>

                        <button
                            onClick={onDismissSummary}
                            className="w-full bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[#C9CDD3] font-bold px-4 py-2.5 rounded-[8px] transition-colors"
                        >
                            Close
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-[#C9CDD3] text-sm">
                            Waves come at the green candle in the middle of the hall. Hold them off. There is no last wave —
                            only the one you do not survive.
                        </p>

                        <ul className="text-[#8B8F98] text-xs space-y-1.5">
                            <li>• Every fifth wave brings a boss.</li>
                            <li>• Fallen fighters wait until the pause between waves, then an ally can raise them.</li>
                            <li>• Nothing drops here and nothing is lost — the candle is the only thing at stake.</li>
                            <li>• Ash and XP are paid once, when the run ends.</li>
                        </ul>

                        <div className="flex items-center gap-2 text-[#8B8F98] text-xs">
                            <Users className="w-3.5 h-3.5" />
                            <span>
                                {party.partyId
                                    ? `Your party of ${partySize} goes in together`
                                    : "You go in alone — form a party first to bring friends"}
                            </span>
                        </div>

                        {bestWave > 0 && (
                            <div className="flex items-center gap-2 text-[#8B8F98] text-xs">
                                <Trophy className="w-3.5 h-3.5 text-[#FFD166]" />
                                <span>Your best: wave {bestWave}</span>
                            </div>
                        )}

                        {inRun ? (
                            <div className="space-y-2">
                                <div className="text-center text-[#4ADE80] text-sm font-bold">
                                    {arena.phase === "prep" ? "The run is about to begin" : `Wave ${arena.wave} in progress`}
                                </div>
                                <button
                                    onClick={onLeave}
                                    className="w-full bg-[rgba(255,255,255,0.06)] hover:bg-red-500/10 border border-white/10 hover:border-red-400/40 text-[#C9CDD3] hover:text-red-300 font-bold px-4 py-2.5 rounded-[8px] transition-colors"
                                >
                                    Walk out
                                </button>
                            </div>
                        ) : cooldownLeft > 0 ? (
                            <button
                                disabled
                                className="w-full bg-white/5 text-white/40 border border-white/10 font-bold px-4 py-3 rounded-[8px] cursor-not-allowed"
                            >
                                Catch your breath — {formatCooldown(cooldownLeft)}
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <button
                                    onClick={onStart}
                                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#FFD166] to-[#D4AF50] text-[rgba(12,12,14,0.9)] font-black px-4 py-3 rounded-[8px] transition-all hover:brightness-110"
                                >
                                    <Swords className="w-4 h-4" />
                                    <span>Light the candle</span>
                                </button>
                                {canJoin && (
                                    <button
                                        onClick={onJoin}
                                        className="w-full bg-[rgba(138,212,255,0.12)] border border-[#8AD4FF]/30 text-[#8AD4FF] font-bold px-4 py-2.5 rounded-[8px] transition-colors hover:border-[#8AD4FF]"
                                    >
                                        Join the run starting now
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
