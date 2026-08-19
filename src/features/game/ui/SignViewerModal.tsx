// src/features/game/ui/SignViewerModal.tsx
"use client";

import { useEffect, useRef } from "react";
import { X, User } from "lucide-react";
import { SoundManager } from "../core/SoundManager";
import { useLanguage } from "@/core/i18n/LanguageContext";

export interface SignViewData {
    id: string;
    ownerNickname: string;
    contentType: "text" | "draw" | null;
    textContent: string | null;
    drawingUrl: string | null;
}

interface SignViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    sign: SignViewData | null;
}

export function SignViewerModal({ isOpen, onClose, sign }: SignViewerModalProps) {
    const { t } = useLanguage();
    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            SoundManager.getInstance().play('modal-open');
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    if (!isOpen || !sign) return null;

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto p-4">
            <div className="w-full max-w-md bg-[rgba(12,14,16,0.95)] border-2 border-[#4FD1FF]/40 rounded-[16px] p-6 shadow-[0_0_35px_rgba(79,209,255,0.15)]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-[#8B8F98] text-sm">
                        <User className="w-4 h-4" />
                        {sign.ownerNickname}
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {sign.contentType === "text" && (
                    <p className="text-[#E5E7EB] text-lg font-bold whitespace-pre-wrap break-words bg-black/30 rounded-lg p-4">
                        {sign.textContent}
                    </p>
                )}

                {sign.contentType === "draw" && sign.drawingUrl && (
                    <img src={sign.drawingUrl} alt={t("g.signView.drawingAlt")} className="w-full rounded-lg border border-zinc-700" />
                )}

                {!sign.contentType && (
                    <p className="text-[#6B7280] text-sm text-center py-6">{t("g.signView.blank")}</p>
                )}
            </div>
        </div>
    );
}
