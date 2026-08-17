// src/features/game/ui/ArenaHUD.tsx
"use client";

import { useEffect, useState } from "react";
import { Flame, Skull, Timer } from "lucide-react";
import type { ArenaReviveState, ArenaStateData } from "../network/NetworkManager";

interface ArenaHUDProps {
    arena: ArenaStateData | null;
    revive: ArenaReviveState;
    localPlayerId: string | null;
}

function useCountdown(until: number): number {
    const [left, setLeft] = useState(0);

    useEffect(() => {
        if (until <= 0) {
            setLeft(0);
            return;
        }

        const tick = () => setLeft(Math.max(0, until - Date.now()));
        tick();
        const timer = setInterval(tick, 200);
        return () => clearInterval(timer);
    }, [until]);

    return left;
}

export function ArenaHUD({ arena, revive, localPlayerId }: ArenaHUDProps) {
    const phaseLeft = useCountdown(arena && arena.phase !== "wave" ? arena.phaseUntil : 0);

    if (!arena) return null;

    const candlePercent = arena.candleMaxHealth > 0
        ? Math.max(0, Math.min(100, (arena.candleHealth / arena.candleMaxHealth) * 100))
        : 0;

    const candleColor = candlePercent > 50 ? "#4ADE80" : candlePercent > 20 ? "#FFD166" : "#FF5757";
    const others = arena.members.filter((member) => member.id !== localPlayerId && !member.left);

    return (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none select-none font-oxanium">
            <div className="bg-[rgba(12,12,14,0.78)] backdrop-blur-md border border-[rgba(212,175,80,0.3)] rounded-[12px] px-5 py-3 min-w-[300px]">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-[#FFD166]" />
                        <span className="text-[#E5E7EB] text-sm font-black tracking-wider">
                            {arena.phase === "prep" ? "GET READY" : `WAVE ${arena.wave}`}
                        </span>
                    </div>

                    {arena.phase !== "wave" && phaseLeft > 0 && (
                        <div className="flex items-center gap-1.5">
                            <Timer className="w-3.5 h-3.5 text-[#8AD4FF]" />
                            <span className="text-[#8AD4FF] text-sm font-bold">{Math.ceil(phaseLeft / 1000)}s</span>
                        </div>
                    )}
                </div>

                <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-[#8B8F98] tracking-wider font-bold">GREEN CANDLE</span>
                        <span style={{ color: candleColor }} className="font-bold">
                            {arena.candleHealth} / {arena.candleMaxHealth}
                        </span>
                    </div>
                    <div className="w-full h-2 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
                        <div
                            className="h-full transition-all duration-300 ease-out"
                            style={{ width: `${candlePercent}%`, backgroundColor: candleColor }}
                        />
                    </div>
                </div>

                {others.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {others.map((member) => (
                            <div
                                key={member.id}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${member.down
                                    ? "bg-red-500/15 text-red-300 border border-red-400/30"
                                    : "bg-white/5 text-[#C9CDD3] border border-white/10"
                                    }`}
                            >
                                {member.down && <Skull className="w-3 h-3" />}
                                <span className="truncate max-w-[90px]">{member.nickname}</span>
                            </div>
                        ))}
                    </div>
                )}

                {arena.phase === "pause" && others.some((member) => member.down) && !revive.channelling && (
                    <div className="mt-2 text-[#8AD4FF] text-[10px]">
                        Stand next to a fallen ally and press <span className="font-bold">E</span> to raise them.
                    </div>
                )}

                {revive.channelling && (
                    <div className="mt-2 text-[#4ADE80] text-[10px] font-bold">Raising your ally…</div>
                )}
            </div>
        </div>
    );
}
