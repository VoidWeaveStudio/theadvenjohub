// src/features/game/ui/KillFeed.tsx
"use client";

import { useEffect, useState } from "react";
import { Skull } from "lucide-react";

export interface KillFeedEntry {
    id: number;
    killerName: string | null;
    victimName: string;
    killerIsMe: boolean;
    victimIsMe: boolean;
    at: number;
}

interface KillFeedProps {
    entries: KillFeedEntry[];
}

const VISIBLE_MS = 6000;
const MAX_ROWS = 5;

export function KillFeed({ entries }: KillFeedProps) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (entries.length === 0) return;
        const timer = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(timer);
    }, [entries.length]);

    const live = entries.filter((entry) => now - entry.at < VISIBLE_MS).slice(-MAX_ROWS);
    if (live.length === 0) return null;

    return (
        <div className="game-ui-killfeed absolute top-40 sm:top-[292px] right-4 pointer-events-none select-none font-oxanium z-30 flex flex-col items-end gap-1">
            {live.map((entry) => (
                <div
                    key={entry.id}
                    className="flex items-center gap-2 rounded-[6px] border border-white/10 bg-[rgba(10,12,16,0.82)] backdrop-blur-sm px-2.5 py-1 text-xs"
                >
                    <span className={entry.killerIsMe ? "text-[#FFD166] font-bold" : "text-[#C9CDD3]"}>
                        {entry.killerName ?? "—"}
                    </span>
                    <Skull className="w-3.5 h-3.5 text-[#FF5757]" />
                    <span className={entry.victimIsMe ? "text-[#FF8A8A] font-bold" : "text-[#8B8F98]"}>
                        {entry.victimName}
                    </span>
                </div>
            ))}
        </div>
    );
}
