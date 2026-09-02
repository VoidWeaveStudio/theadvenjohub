// src/features/game/ui/preview/PreviewModal.tsx
"use client";

import { X } from "lucide-react";
import { ModelPreview } from "./ModelPreview";
import type { PreviewSubject } from "./PreviewScene";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface PreviewModalProps {
    isOpen: boolean;
    title: string;
    subtitle?: string;
    accent?: string;
    subject: PreviewSubject | null;
    footer?: React.ReactNode;
    onClose: () => void;
}

export function PreviewModal({
    isOpen,
    title,
    subtitle,
    accent = "#4FD1FF",
    subject,
    footer,
    onClose,
}: PreviewModalProps) {
    const { t } = useLanguage();
    if (!isOpen || !subject) return null;

    return (
        <div
            className="pointer-events-auto absolute inset-0 z-[70] flex items-center justify-center bg-black/75 p-2 sm:p-4 font-oxanium"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="flex w-full max-w-md max-h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgba(13,17,23,0.98)] shadow-[0_12px_48px_rgba(0,0,0,0.65)]">
                <div className="flex items-start justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-black tracking-wide text-[#E5E7EB]">{title}</h2>
                        {subtitle && (
                            <div
                                className="text-[10px] font-black uppercase tracking-widest"
                                style={{ color: accent }}
                            >
                                {subtitle}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-0 bg-[rgba(255,255,255,0.06)] p-0 text-[#C5C9D1] transition-colors hover:bg-[rgba(255,255,255,0.12)] hover:text-[#E5E7EB]"
                    >
                        <X className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                </div>

                <div
                    className="mx-5 h-[clamp(140px,calc(42*var(--game-vh)),320px)] flex-shrink-0 overflow-hidden rounded-xl border border-white/10"
                    style={{ background: `radial-gradient(circle at 50% 15%, ${accent}22 -10%, rgba(0,0,0,0.45) 70%)` }}
                >
                    <ModelPreview subject={subject} />
                </div>

                <p className="px-5 pt-2 text-center text-[11px] text-[#6B7280]">{t("g.preview.hint")}</p>

                <div className="px-5 py-4">{footer}</div>
            </div>
        </div>
    );
}
