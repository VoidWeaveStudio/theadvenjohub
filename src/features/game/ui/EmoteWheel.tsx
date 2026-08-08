// src/features/game/ui/EmoteWheel.tsx
"use client";

import { useEffect, useRef } from "react";
import { EMOTES, EmoteKey } from "../data/emotes";
import { SoundManager } from "../core/SoundManager";

interface EmoteWheelProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (key: EmoteKey) => void;
}

const WHEEL_RADIUS = 108;

export function EmoteWheel({ isOpen, onClose, onSelect }: EmoteWheelProps) {
    const wasOpenRef = useRef(false);

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            SoundManager.getInstance().play("modal-open");
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            const index = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].indexOf(e.code);
            if (index !== -1 && index < EMOTES.length) {
                e.preventDefault();
                onSelect(EMOTES[index].key);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen, onSelect]);

    if (!isOpen) return null;

    return (
        <div
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto font-oxanium bg-[rgba(6,8,12,0.55)] backdrop-blur-[2px]"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="relative" style={{ width: WHEEL_RADIUS * 2 + 120, height: WHEEL_RADIUS * 2 + 120 }}>
                <div className="absolute inset-0 rounded-full border border-white/10 bg-[rgba(13,17,23,0.55)]" />
                <div className="absolute inset-8 rounded-full border border-[#4FD1FF]/20" />

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    <div className="text-[#E5E7EB] text-sm font-black tracking-wider">EMOTES</div>
                    <div className="text-[#6B7280] text-[11px] mt-0.5">1–{EMOTES.length} or click</div>
                </div>

                {EMOTES.map((emote, index) => {
                    const angle = (index / EMOTES.length) * Math.PI * 2 - Math.PI / 2;
                    const x = Math.cos(angle) * WHEEL_RADIUS;
                    const y = Math.sin(angle) * WHEEL_RADIUS;

                    return (
                        <div
                            key={emote.key}
                            className="absolute left-1/2 top-1/2 w-[104px] -ml-[52px] -mt-[52px]"
                            style={{ transform: `translate(${x}px, ${y}px)` }}
                        >
                            <button
                                onClick={() => onSelect(emote.key)}
                                title={emote.hint}
                                className="w-full flex flex-col items-center gap-1 py-2 rounded-2xl border transition-transform transition-colors duration-150 bg-[rgba(13,17,23,0.92)] border-white/10 hover:border-[#4FD1FF] hover:scale-110"
                            >
                                <span
                                    className="w-14 h-14 rounded-full flex items-center justify-center text-[34px] leading-none select-none"
                                    style={{ background: `${emote.accent}22`, boxShadow: `0 0 18px ${emote.accent}33` }}
                                >
                                    {emote.emoji}
                                </span>
                                <span className="text-[#E5E7EB] text-[11px] font-bold leading-none">{emote.label}</span>
                                <span className="text-[#6B7280] text-[10px] leading-none">{index + 1}</span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
