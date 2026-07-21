// src/features/game/ui/Hotbar.tsx
"use client";

import { Sword, Axe, Pickaxe, Flame, Apple, Box, Backpack } from "lucide-react";

interface HotbarSlot {
    id: string;
    icon: string;
    name: string;
    equipped: boolean;
    count?: number;
}

interface HotbarProps {
    slots: HotbarSlot[];
    onSlotClick?: (index: number) => void;
}

const iconMap: Record<string, React.ReactNode> = {
    'axe': <Axe className="w-8 h-8" />,
    'sword': <Sword className="w-8 h-8" />,
    'pickaxe': <Pickaxe className="w-8 h-8" />,
    'torch': <Flame className="w-8 h-8" />,
    'apple': <Apple className="w-8 h-8" />,
    'box': <Box className="w-8 h-8" />,
    'backpack': <Backpack className="w-8 h-8" />,
};

export function Hotbar({ slots, onSlotClick }: HotbarProps) {
    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto font-oxanium">
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
                            ${slot.equipped
                                ? "border-[#4FD1FF] bg-[rgba(12,12,14,0.85)] shadow-lg shadow-[#4FD1FF]/20 scale-110"
                                : slot.icon
                                    ? "border-[rgba(255,255,255,0.2)] bg-[rgba(12,12,14,0.6)] hover:border-[rgba(255,255,255,0.4)] hover:bg-[rgba(12,12,14,0.75)]"
                                    : "border-[rgba(255,255,255,0.1)] bg-[rgba(12,12,14,0.4)]"
                            }
                        `}
                    >
                        <span className="absolute top-1.5 left-2 text-[10px] font-bold text-[#8B8F98]">
                            {i + 1}
                        </span>

                        {IconComponent && (
                            <div className={`${slot.equipped ? 'text-[#4FD1FF]' : 'text-[#E5E7EB]'}`}>
                                {IconComponent}
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
                                    <span className="text-[10px] text-[#E5E7EB] font-medium">{slot.name}</span>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}