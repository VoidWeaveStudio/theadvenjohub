// src/features/game/ui/BuyMenu.tsx
"use client";

import { useEffect, useState } from "react";
import { Coins, Timer, X } from "lucide-react";
import { ARSENAL_BY_ID, arsenalFor, GRENADE_LIMIT, type ArsenalItem, type ArsenalSlot } from "../data/defusalArsenal";
import type { DefusalRosterEntry, DefusalStateData } from "../network/NetworkManager";

interface BuyMenuProps {
    match: DefusalStateData | null;
    me: DefusalRosterEntry | null;
    onBuy: (itemId: string) => void;
    onClose: () => void;
}

const SLOT_ORDER: { slot: ArsenalSlot; label: string }[] = [
    { slot: "pistol", label: "Sidearms" },
    { slot: "primary", label: "Primary" },
    { slot: "armor", label: "Armour" },
    { slot: "grenade", label: "Grenades" },
    { slot: "kit", label: "Gear" },
];

function ownedState(item: ArsenalItem, me: DefusalRosterEntry): { owned: boolean; count: number } {
    if (item.slot === "primary") return { owned: me.primary === item.id, count: 0 };
    if (item.slot === "pistol") return { owned: me.pistol === item.id, count: 0 };
    if (item.slot === "armor") return { owned: me.armor === item.id, count: 0 };
    if (item.slot === "kit") return { owned: me.kit === true, count: 0 };
    if (item.slot === "grenade") {
        const count = (me.grenades ?? []).filter((id) => id === item.id).length;
        return { owned: count > 0, count };
    }
    return { owned: false, count: 0 };
}

export function BuyMenu({ match, me, onBuy, onClose }: BuyMenuProps) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 200);
        return () => clearInterval(timer);
    }, []);

    if (!match || !me) return null;

    const open = match.phase === "freeze" || match.phase === "warmup";
    if (!open) return null;

    const money = me.money ?? 0;
    const left = Math.max(0, match.phaseUntil - now);
    const items = arsenalFor(me.side).filter((item) => item.price > 0);
    const grenadeCount = (me.grenades ?? []).length;

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.78)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto p-4 font-oxanium">
            <div className="w-full max-w-3xl bg-[rgba(12,14,16,0.97)] border-2 border-[#D9A441]/40 rounded-[16px] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-black text-[#E5E7EB]">Buy</h2>
                        <div className="flex items-center gap-1.5 text-[#8B8F98] text-xs">
                            <Timer className="w-3.5 h-3.5" />
                            <span className="tabular-nums">{Math.ceil(left / 1000)}s</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-[#4ADE80] font-black">
                            <Coins className="w-4 h-4" />
                            <span className="tabular-nums">${money}</span>
                        </div>
                        <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB]">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-4 max-h-[65vh] overflow-y-auto space-y-4">
                    {SLOT_ORDER.map(({ slot, label }) => {
                        const group = items.filter((item) => item.slot === slot);
                        if (group.length === 0) return null;

                        return (
                            <div key={slot}>
                                <div className="text-[#6B7280] text-[10px] font-black tracking-widest mb-2">
                                    {label.toUpperCase()}
                                    {slot === "grenade" && (
                                        <span className="text-[#8B8F98] ml-2 font-bold">{grenadeCount}/{GRENADE_LIMIT} carried</span>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {group.map((item) => {
                                        const state = ownedState(item, me);
                                        const grenadesFull = slot === "grenade" && grenadeCount >= GRENADE_LIMIT;
                                        const blocked = money < item.price || grenadesFull || (state.owned && slot !== "grenade");

                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => onBuy(item.id)}
                                                disabled={blocked}
                                                title={item.flavour}
                                                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${blocked
                                                    ? "border-white/5 bg-white/[0.02] opacity-45 cursor-not-allowed"
                                                    : "border-white/10 bg-white/[0.04] hover:border-[#D9A441]/50 hover:bg-white/[0.07]"
                                                    }`}
                                            >
                                                <span className="text-2xl flex-shrink-0">{item.icon}</span>

                                                <div className="min-w-0 flex-1">
                                                    <div className="text-[#E5E7EB] text-sm font-bold truncate">{item.name}</div>
                                                    <div className="text-[#6B7280] text-[11px] truncate">
                                                        {item.slot === "primary" || item.slot === "pistol"
                                                            ? `${item.damage} dmg · ${item.magSize} rounds`
                                                            : item.flavour}
                                                    </div>
                                                </div>

                                                <div className="text-right flex-shrink-0">
                                                    <div className={`text-sm font-black tabular-nums ${money < item.price ? "text-[#FF5757]" : "text-[#4ADE80]"}`}>
                                                        ${item.price}
                                                    </div>
                                                    {state.count > 0 && <div className="text-[#8B8F98] text-[10px]">×{state.count}</div>}
                                                    {state.owned && slot !== "grenade" && <div className="text-[#8B8F98] text-[10px]">owned</div>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="px-5 py-2.5 border-t border-white/10 text-[#6B7280] text-[11px] flex items-center justify-between">
                    <span>
                        Holding: {ARSENAL_BY_ID.get(me.held === "primary" ? me.primary ?? "" : me.pistol ?? "")?.name ?? "—"}
                    </span>
                    <span>[B] reopens · 1 primary · 2 pistol · 3 melee</span>
                </div>
            </div>
        </div>
    );
}
