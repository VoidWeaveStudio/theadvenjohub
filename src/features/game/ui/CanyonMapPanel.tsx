// src/features/game/ui/CanyonMapPanel.tsx
"use client";

import { X, MapPinned, CheckCircle2, Lock, MapPin } from "lucide-react";
import { CanyonMapData } from "../network/NetworkManager";

interface CanyonMapPanelProps {
    isOpen: boolean;
    data: CanyonMapData | null;
    onClose: () => void;
    onWarp: (segment: number) => void;
}

function segmentName(segment: number): string {
    return segment === 1 ? "Slime Valley" : `Slime Valley — Segment ${segment}`;
}

export function CanyonMapPanel({ isOpen, data, onClose, onWarp }: CanyonMapPanelProps) {
    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto font-oxanium p-4">
            <div className="w-full max-w-md bg-[rgba(12,14,20,0.95)] border-2 border-[#4FD1FF]/40 rounded-[16px] p-6 shadow-[0_0_35px_rgba(79,209,255,0.15)]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <MapPinned className="w-5 h-5 text-[#4FD1FF]" />
                        <h2 className="text-xl font-black text-[#E5E7EB]">Canyon Map</h2>
                    </div>
                    <button onClick={onClose} className="text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {!data ? (
                    <div className="text-[#8B8F98] text-xs text-center py-10">Loading...</div>
                ) : (
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {Array.from({ length: data.maxSegmentReached }, (_, i) => i + 1).map((segment) => {
                            const cleared = data.clearedSegments.includes(segment);
                            const isCurrent = segment === data.segment;

                            return (
                                <button
                                    key={segment}
                                    onClick={() => onWarp(segment)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-[10px] border transition-all duration-150 text-left ${isCurrent
                                            ? "bg-[rgba(79,209,255,0.12)] border-[#4FD1FF]/50"
                                            : "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] hover:bg-[rgba(79,209,255,0.08)] hover:border-[#4FD1FF]/30"
                                        }`}
                                >
                                    {cleared ? (
                                        <CheckCircle2 className="w-5 h-5 text-[#4ADE80] flex-shrink-0" />
                                    ) : (
                                        <MapPin className="w-5 h-5 text-[#4FD1FF] flex-shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[#E5E7EB] font-bold text-sm truncate">{segmentName(segment)}</div>
                                        <div className="text-[#8B8F98] text-[10px]">
                                            {cleared ? "Cleared — no reward on replay" : "Not yet cleared"}
                                        </div>
                                    </div>
                                    {isCurrent && (
                                        <span className="text-[10px] font-bold text-[#4FD1FF] flex-shrink-0">HERE</span>
                                    )}
                                </button>
                            );
                        })}

                        <div className="w-full flex items-center gap-3 p-3 rounded-[10px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] opacity-50">
                            <Lock className="w-5 h-5 text-[#8B8F98] flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="text-[#8B8F98] font-bold text-sm truncate">
                                    {segmentName(data.maxSegmentReached + 1)}
                                </div>
                                <div className="text-[#8B8F98] text-[10px]">Clear the current segment to unlock</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
