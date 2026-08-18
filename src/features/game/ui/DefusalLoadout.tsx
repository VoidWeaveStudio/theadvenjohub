// src/features/game/ui/DefusalLoadout.tsx
"use client";

import { ARSENAL_BY_ID } from "../data/defusalArsenal";
import { WeaponIcon } from "./WeaponIcon";
import type { BuyMenuEntry } from "./BuyMenu";

export type HeldSlot = "primary" | "pistol" | "melee" | "grenade1" | "grenade2";

interface DefusalLoadoutProps {
    me: BuyMenuEntry | null;
    onSelect: (slot: HeldSlot) => void;
}

const SLOTS: { slot: HeldSlot; key: string }[] = [
    { slot: "primary", key: "1" },
    { slot: "pistol", key: "2" },
    { slot: "melee", key: "3" },
    { slot: "grenade1", key: "4" },
    { slot: "grenade2", key: "5" },
];

function itemIdFor(me: BuyMenuEntry, slot: HeldSlot): string | null {
    if (slot === "primary") return me.primary;
    if (slot === "pistol") return me.pistol;
    if (slot === "melee") return "rug-beater";
    if (slot === "grenade1") return me.grenades?.[0] ?? null;
    return me.grenades?.[1] ?? null;
}

export function DefusalLoadout({ me, onSelect }: DefusalLoadoutProps) {
    if (!me) return null;

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto font-oxanium z-30">
            {SLOTS.map(({ slot, key }) => {
                const itemId = itemIdFor(me, slot);
                const item = itemId ? ARSENAL_BY_ID.get(itemId) : null;
                const held = me.held === slot;
                const empty = !item;

                return (
                    <button
                        key={slot}
                        onClick={() => !empty && onSelect(slot)}
                        disabled={empty}
                        title={item?.name}
                        className={`relative w-[92px] h-[58px] rounded-[8px] border-2 flex flex-col items-center justify-center transition-all ${empty
                            ? "border-white/5 bg-[rgba(12,12,14,0.4)] opacity-35 cursor-default"
                            : held
                                ? "border-[#D9A441] bg-[rgba(24,18,6,0.9)] scale-105 shadow-lg shadow-[#D9A441]/20"
                                : "border-white/15 bg-[rgba(12,12,14,0.72)] hover:border-white/35"
                            }`}
                    >
                        <span className="absolute top-1 left-1.5 text-[10px] font-black text-[#8B8F98]">{key}</span>

                        {item ? (
                            <>
                                <WeaponIcon itemId={item.id} className={`w-11 h-5 ${held ? "text-[#FFD9A0]" : "text-[#9AA0A9]"}`} />
                                <span className={`text-[9px] font-bold tracking-wide mt-0.5 truncate max-w-[84px] ${held ? "text-[#FFD9A0]" : "text-[#8B8F98]"}`}>
                                    {item.name}
                                </span>
                            </>
                        ) : (
                            <span className="text-[10px] text-[#4A4F58]">empty</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
