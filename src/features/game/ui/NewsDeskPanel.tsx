// src/features/game/ui/NewsDeskPanel.tsx
"use client";

import { useState } from "react";
import { Radio } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";

const ACCENT = "#2FD8E8";
const MAX_LENGTH = 500;

interface NewsDeskPanelProps {
    visible: boolean;
    onSpeak: (text: string) => void;
}

export function NewsDeskPanel({ visible, onSpeak }: NewsDeskPanelProps) {
    const { t } = useLanguage();
    const [text, setText] = useState("");

    if (!visible) return null;

    const handleSpeak = () => {
        const bulletin = text.trim();
        if (!bulletin) return;
        onSpeak(bulletin);
        setText("");
    };

    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,520px)] rounded-[10px] border border-[#2FD8E8]/35 bg-[rgba(8,11,18,0.94)] p-3 backdrop-blur">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold" style={{ color: ACCENT }}>
                <Radio className="h-3.5 w-3.5" />
                {t("g.news.deskTitle")}
            </div>

            <textarea
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, MAX_LENGTH))}
                onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSpeak();
                    }
                }}
                rows={2}
                placeholder={t("g.news.placeholder")}
                className="w-full resize-none rounded border border-[#2FD8E8]/30 bg-black/45 px-3 py-2 text-sm text-white outline-none focus:border-[#2FD8E8]"
            />

            <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[11px] text-[#8B8F98]">{text.length}/{MAX_LENGTH}</span>
                <button
                    onClick={handleSpeak}
                    disabled={!text.trim()}
                    className="rounded-[8px] bg-gradient-to-r from-[#2FD8E8] to-[#1AA6C4] px-4 py-2 text-sm font-bold text-[rgba(8,11,18,0.92)] transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {t("g.news.readOnAir")}
                </button>
            </div>
        </div>
    );
}
