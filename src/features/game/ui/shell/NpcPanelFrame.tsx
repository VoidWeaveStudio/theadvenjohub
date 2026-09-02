// src/features/game/ui/shell/NpcPanelFrame.tsx
"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { SoundManager } from "../../core/SoundManager";

export type NpcPanelSize = "md" | "lg" | "xl";

const SIZE_CLASSES: Record<NpcPanelSize, string> = {
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
};

const DEFAULT_BACKGROUND = "rgba(13,17,23,0.97)";

interface NpcPanelFrameProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    accent: string;
    icon?: React.ReactNode;
    size?: NpcPanelSize;
    background?: string;
    headerExtra?: React.ReactNode;
    subheader?: React.ReactNode;
    footer?: React.ReactNode;
    children: React.ReactNode;
}

export function NpcPanelFrame({
    isOpen,
    onClose,
    title,
    accent,
    icon,
    size = "md",
    background = DEFAULT_BACKGROUND,
    headerExtra,
    subheader,
    footer,
    children,
}: NpcPanelFrameProps) {
    const wasOpenRef = useRef(false);

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            SoundManager.getInstance().play("modal-open");
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="game-npc-frame absolute inset-0 z-50 flex items-center justify-center bg-[rgba(6,6,8,0.85)] backdrop-blur-sm p-2 sm:p-4 pointer-events-auto font-oxanium"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className={`game-npc-panel w-full ${SIZE_CLASSES[size]} max-h-full flex flex-col rounded-[16px] border-2 overflow-hidden`}
                style={{ background, borderColor: `${accent}66`, boxShadow: `0 0 35px ${accent}26` }}
            >
                <div className="game-npc-head flex items-center justify-between gap-3 px-6 pt-6 pb-4 flex-shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        {icon && (
                            <span className="flex items-center flex-shrink-0" style={{ color: accent }}>
                                {icon}
                            </span>
                        )}
                        <h2 className="game-npc-title text-xl font-black text-[#E5E7EB] truncate">{title}</h2>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                        {headerExtra}
                        <button
                            onClick={onClose}
                            className="game-npc-close w-9 h-9 p-0 border-0 rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.06)] text-[#8B8F98] hover:text-[#E5E7EB] hover:bg-[rgba(255,255,255,0.12)] transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {subheader && <div className="game-npc-sub flex-shrink-0 px-6 pb-4">{subheader}</div>}

                <div className="game-npc-body flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">{children}</div>

                {footer && (
                    <div className="game-npc-foot flex-shrink-0 border-t border-[rgba(255,255,255,0.08)] px-6 py-4">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
