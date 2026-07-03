//src\features\game\ui\Hotbar.tsx
"use client";

interface HotbarProps {
    slots: { id: string; icon: string; name: string; active: boolean }[];
}

export function Hotbar({ slots }: HotbarProps) {
    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
            {slots.map((slot, i) => (
                <div
                    key={slot.id}
                    className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center text-3xl backdrop-blur transition-all ${slot.active
                            ? "border-yellow-400 bg-black/70 shadow-lg shadow-yellow-400/20"
                            : "border-white/20 bg-black/40"
                        }`}
                >
                    {slot.icon}
                    <span className="absolute top-1 left-2 text-xs font-bold text-white/70">{i + 1}</span>
                </div>
            ))}
        </div>
    );
}