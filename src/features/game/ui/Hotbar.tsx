// src/features/game/ui/Hotbar.tsx
"use client";

import { Sword, Axe, Pickaxe, Flame, Apple, Box, Backpack, Lock, Smile, Sparkles } from "lucide-react";

interface HotbarSlot {
    id: string;
    icon: string;
    name: string;
    equipped: boolean;
    count?: number;
    locked?: boolean;
    lockReason?: string;
}

interface HotbarProps {
    slots: HotbarSlot[];
    onSlotClick?: (index: number) => void;
    onOpenEmotes?: () => void;
    onOpenDegen?: () => void;
}

const SLOT_KEYS = ["Q", "F", "C", "V", "X"];

const iconMap: Record<string, React.ReactNode> = {
    'axe': <Axe className="w-8 h-8" />,
    'sword': <Sword className="w-8 h-8" />,
    'pickaxe': <Pickaxe className="w-8 h-8" />,
    'torch': <Flame className="w-8 h-8" />,
    'apple': <Apple className="w-8 h-8" />,
    'box': <Box className="w-8 h-8" />,
    'backpack': <Backpack className="w-8 h-8" />,
    'emote': <Smile className="w-8 h-8" />,
};

export function Hotbar({ slots, onSlotClick, onOpenEmotes, onOpenDegen }: HotbarProps) {
    return (
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-auto font-oxanium">
            {slots.map((slot, i) => {
                const IconComponent = iconMap[slot.icon.toLowerCase()] || null;

                return (
                    <div
                        key={slot.id}
                        onClick={() => onSlotClick?.(i)}
                        className={`
                            relative w-16 h-16 rounded-[10px] border-2 backdrop-blur-md
                            flex flex-col items-center justify-center
                            transition-all duration-200 cursor-pointer
                            ${slot.locked
                                ? "border-[rgba(255,255,255,0.1)] bg-[rgba(12,12,14,0.5)] opacity-50"
                                : slot.equipped
                                    ? "border-[#4FD1FF] bg-[rgba(12,12,14,0.85)] shadow-lg shadow-[#4FD1FF]/20 scale-110"
                                    : slot.icon
                                        ? "border-[rgba(255,255,255,0.2)] bg-[rgba(12,12,14,0.6)] hover:border-[rgba(255,255,255,0.4)] hover:bg-[rgba(12,12,14,0.75)]"
                                        : "border-[rgba(255,255,255,0.1)] bg-[rgba(12,12,14,0.4)]"
                            }
                        `}
                    >
                        <span className="absolute top-1.5 left-2 text-[10px] font-bold text-[#8B8F98]">
                            {SLOT_KEYS[i] ?? ""}
                        </span>

                        {IconComponent ? (
                            <div className={`${slot.equipped ? 'text-[#4FD1FF]' : 'text-[#E5E7EB]'}`}>
                                {IconComponent}
                            </div>
                        ) : slot.icon ? (
                            <div className="text-2xl leading-none">{slot.icon}</div>
                        ) : null}

                        {slot.locked && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[8px]">
                                <Lock className="w-6 h-6 text-[#E5E7EB]" />
                            </div>
                        )}

                        {slot.count !== undefined && slot.count > 1 && (
                            <span className="absolute bottom-1 right-2 text-xs font-bold text-[#E5E7EB]">
                                {slot.count}
                            </span>
                        )}

                        {slot.equipped && (
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#4FD1FF] rounded-full" />
                        )}

                        {slot.icon && (
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                                <div className="bg-[rgba(12,12,14,0.9)] border border-[rgba(255,255,255,0.1)] rounded-md px-2 py-1 whitespace-nowrap">
                                    <span className="text-[10px] text-[#E5E7EB] font-medium">
                                        {slot.locked && slot.lockReason ? slot.lockReason : slot.name}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            <div className="mt-1 flex flex-col gap-2">
                <button
                    onClick={onOpenEmotes}
                    title="Emotes"
                    className="w-16 h-16 p-0 rounded-[10px] border-2 border-[rgba(255,255,255,0.2)] bg-[rgba(12,12,14,0.6)] hover:border-[#FFD166] hover:bg-[rgba(12,12,14,0.75)] flex flex-col items-center justify-center gap-0.5 transition-colors"
                >
                    <Smile className="w-7 h-7 text-[#FFD166]" />
                    <span className="text-[9px] font-bold tracking-wide text-[#8B8F98]">EMOTES</span>
                </button>

                <button
                    onClick={onOpenDegen}
                    title="Degen abilities"
                    className="w-16 h-16 p-0 rounded-[10px] border-2 border-[rgba(255,255,255,0.2)] bg-[rgba(12,12,14,0.6)] hover:border-[#A855F7] hover:bg-[rgba(12,12,14,0.75)] flex flex-col items-center justify-center gap-0.5 transition-colors"
                >
                    <Sparkles className="w-7 h-7 text-[#A855F7]" />
                    <span className="text-[9px] font-bold tracking-wide text-[#8B8F98]">DEGEN</span>
                </button>
            </div>
        </div>
    );
}