// src/features/game/ui/OnlineCounter.tsx
"use client";

import { Users } from "lucide-react";

interface OnlineCounterProps {
    count: number;
    maxCount?: number;
}

export function OnlineCounter({ count, maxCount = 100 }: OnlineCounterProps) {
    return (
        <div className="bg-[rgba(12,12,14,0.72)] backdrop-blur-md border border-[rgba(255,255,255,0.08)] rounded-[10px] px-5 py-3 font-oxanium">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <div className="relative flex items-center justify-center">
                        <span className="absolute inline-flex h-2 w-2 rounded-full bg-[#4ADE80] animate-ping opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ADE80]" />
                    </div>
                    <Users className="w-4 h-4 text-[#8B8F98]" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[#8B8F98] text-[10px] font-bold tracking-wider">ONLINE</span>
                    <span className="text-[#E5E7EB] text-xl font-bold leading-none">{count}</span>
                </div>
            </div>
        </div>
    );
}