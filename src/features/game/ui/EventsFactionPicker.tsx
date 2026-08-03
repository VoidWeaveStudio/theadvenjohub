// src/features/game/ui/EventsFactionPicker.tsx
"use client";

import { Flag } from "lucide-react";
import { FactionSummary } from "../network/NetworkManager";

interface EventsFactionPickerProps {
    isOpen: boolean;
    onClose: () => void;
    myFactions: FactionSummary[];
    onConfirm: (factionId: string, factionName: string) => void;
}

export function EventsFactionPicker({ isOpen, onClose, myFactions, onConfirm }: EventsFactionPickerProps) {
    if (!isOpen) return null;

    return (
        <div
            className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto font-oxanium p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md bg-[rgba(18,10,24,0.95)] border-2 border-[#a855f7]/40 rounded-[16px] p-6 shadow-[0_0_35px_rgba(168,85,247,0.15)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Flag className="w-5 h-5 text-[#a855f7]" />
                        <h2 className="text-xl font-black text-[#E5E7EB]">Enter Events</h2>
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        ✕
                    </button>
                </div>

                <p className="text-[#8B8F98] text-sm mb-4">Which faction are you walking in as?</p>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                    {myFactions.map((f) => (
                        <button
                            key={f.id}
                            onClick={() => onConfirm(f.id, f.name)}
                            className="w-full flex items-center gap-3 bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(168,85,247,0.12)] border border-white/10 hover:border-[#a855f7]/40 rounded-[10px] px-4 py-3 text-left transition-all"
                        >
                            {f.image ? (
                                <img src={f.image} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                                <div className="text-[#E5E7EB] font-bold text-sm truncate">
                                    {f.name} {f.symbol && <span className="text-[#8B8F98]">${f.symbol}</span>}
                                </div>
                                <div className="text-[#6B7280] text-xs">Lv.{f.level}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
