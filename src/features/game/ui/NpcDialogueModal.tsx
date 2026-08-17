// src/features/game/ui/NpcDialogueModal.tsx
"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { NpcDialogue } from "../data/npcDialogues";
import { SoundManager } from "../core/SoundManager";

interface NpcDialogueModalProps {
    dialogue: NpcDialogue | null;
    onFinish: () => void;
    onSkip: () => void;
}

export function NpcDialogueModal({ dialogue, onFinish, onSkip }: NpcDialogueModalProps) {
    const [lineIndex, setLineIndex] = useState(0);

    useEffect(() => {
        if (dialogue) {
            setLineIndex(0);
            SoundManager.getInstance().play("modal-open");
        }
    }, [dialogue]);

    useEffect(() => {
        if (!dialogue) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.code === "Space" || e.code === "Enter" || e.code === "KeyE") {
                e.preventDefault();
                advance();
            }
        };

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    if (!dialogue) return null;

    const isLast = lineIndex >= dialogue.lines.length - 1;

    function advance() {
        if (!dialogue) return;
        if (lineIndex < dialogue.lines.length - 1) {
            setLineIndex((prev) => prev + 1);
            return;
        }
        onFinish();
    }

    return (
        <div className="absolute inset-0 z-50 flex items-end justify-center pb-24 pointer-events-auto font-oxanium bg-[rgba(6,8,12,0.35)] backdrop-blur-[1px]">
            <div
                className="w-full max-w-2xl mx-4 rounded-2xl border bg-[rgba(13,17,23,0.97)] overflow-hidden"
                style={{ borderColor: `${dialogue.accent}55`, boxShadow: `0 0 40px ${dialogue.accent}22` }}
            >
                <div
                    className="flex items-center gap-3 px-5 py-3 border-b"
                    style={{ borderColor: `${dialogue.accent}22`, background: `${dialogue.accent}14` }}
                >
                    <span
                        className="w-11 h-11 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ background: `${dialogue.accent}22`, boxShadow: `0 0 18px ${dialogue.accent}33` }}
                    >
                        {dialogue.emoji}
                    </span>
                    <div>
                        <div className="text-[#E5E7EB] text-base font-black leading-tight">{dialogue.name}</div>
                        <div className="text-[11px]" style={{ color: dialogue.accent }}>
                            {dialogue.role}
                        </div>
                    </div>
                </div>

                <div className="px-5 py-5 min-h-[92px] flex items-center">
                    <p className="text-[#E5E7EB] text-sm leading-relaxed">{dialogue.lines[lineIndex]}</p>
                </div>

                <div className="flex items-center justify-between px-5 py-3 border-t border-white/8">
                    <div className="flex items-center gap-1.5">
                        {dialogue.lines.map((_, i) => (
                            <span
                                key={i}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: i <= lineIndex ? dialogue.accent : "rgba(255,255,255,0.2)" }}
                            />
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onSkip}
                            className="text-[#6B7280] hover:text-[#9CA3AF] text-xs font-bold px-3 py-2 bg-transparent border-0"
                        >
                            Skip
                        </button>
                        <button
                            onClick={advance}
                            className="flex items-center gap-1.5 text-xs font-black px-4 py-2 rounded-[8px] border-0"
                            style={{ background: dialogue.accent, color: "#0C0C0E" }}
                        >
                            {isLast ? dialogue.action : "Next"}
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
