//src\features\game\ui\Hotbar.tsx
"use client";

interface HotbarSlot {
    id: string;
    icon: string;
    name: string;
    equipped: boolean;
}

interface HotbarProps {
    slots: HotbarSlot[];
    onSlotClick?: (index: number) => void;
}

export function Hotbar({ slots, onSlotClick }: HotbarProps) {
    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto">
            {slots.map((slot, i) => (
                <div
                    key={slot.id}
                    onClick={() => onSlotClick?.(i)}
                    className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center text-3xl backdrop-blur transition-all cursor-pointer relative ${slot.equipped
                            ? "border-yellow-400 bg-black/70 shadow-lg shadow-yellow-400/30 scale-110"
                            : slot.icon
                                ? "border-white/40 bg-black/50 hover:border-white/60"
                                : "border-white/10 bg-black/30"
                        }`}
                >
                    {slot.icon && <span>{slot.icon}</span>}
                    <span className="absolute top-1 left-2 text-xs font-bold text-white/70">
                        {i + 1}
                    </span>
                    {slot.equipped && slot.icon && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-yellow-400 font-bold">
                            ACTIVE
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}