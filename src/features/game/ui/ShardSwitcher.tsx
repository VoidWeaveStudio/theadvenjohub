// src/features/game/ui/ShardSwitcher.tsx
"use client";

import { useState } from "react";
import { Layers, Check } from "lucide-react";
import type { ShardStateData } from "../network/NetworkManager";

interface ShardSwitcherProps {
    state: ShardStateData | null;
    onSwitch: (instance: number) => void;
}

export function ShardSwitcher({ state, onSwitch }: ShardSwitcherProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (!state) return null;

    const current = state.shards.find((s) => s.instance === state.instance);
    const currentCount = current?.count ?? 1;

    return (
        <div className="pointer-events-auto relative font-oxanium">
            <button
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[rgba(12,12,14,0.75)] border border-[rgba(127,230,207,0.25)] text-[#7FE6CF] text-xs font-bold hover:border-[rgba(127,230,207,0.5)] transition-colors"
                title="Switch layer"
            >
                <Layers className="w-3.5 h-3.5" />
                <span>Layer {state.instance}</span>
                <span className="text-[#8B8F98]">
                    {currentCount}/{state.capacity}
                </span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-1.5 min-w-[190px] bg-[rgba(10,12,18,0.96)] border border-[rgba(127,230,207,0.25)] rounded-[8px] p-1.5 shadow-xl z-50">
                    <div className="text-[10px] uppercase tracking-wide text-[#8B8F98] px-2 py-1">
                        Location layers
                    </div>

                    {state.shards.map((shard) => {
                        const isCurrent = shard.instance === state.instance;
                        const isFull = shard.count >= state.capacity;

                        return (
                            <button
                                key={shard.instance}
                                onClick={() => {
                                    if (!isCurrent) onSwitch(shard.instance);
                                    setIsOpen(false);
                                }}
                                disabled={isCurrent}
                                title={isFull && !isCurrent ? "Full — you can still join a friend here" : undefined}
                                className={`w-full flex items-center justify-between gap-3 px-2 py-1.5 rounded-[6px] text-xs transition-colors ${isCurrent
                                    ? "bg-[rgba(127,230,207,0.14)] text-[#7FE6CF] cursor-default"
                                    : "text-[#E5E7EB] hover:bg-white/5"
                                    }`}
                            >
                                <span className="flex items-center gap-1.5 font-bold">
                                    {isCurrent && <Check className="w-3 h-3" />}
                                    Layer {shard.instance}
                                </span>
                                <span className={isFull ? "text-[#FFD166]" : "text-[#8B8F98]"}>
                                    {shard.count}/{state.capacity}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
