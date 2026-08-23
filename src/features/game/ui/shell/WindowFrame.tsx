// src/features/game/ui/shell/WindowFrame.tsx
"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { SoundManager } from "../../core/SoundManager";

export type WindowFrameSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<WindowFrameSize, string> = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-lg",
    lg: "sm:max-w-4xl sm:h-[calc(82*var(--game-vh))]",
    xl: "sm:max-w-6xl sm:h-[calc(88*var(--game-vh))]",
};

export interface WindowFrameTab {
    id: string;
    label: string;
    icon?: React.ReactNode;
    badge?: boolean;
}

interface WindowFrameProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    icon?: React.ReactNode;
    size?: WindowFrameSize;
    tabs?: WindowFrameTab[];
    activeTab?: string;
    onTabChange?: (id: string) => void;
    footer?: React.ReactNode;
    children: React.ReactNode;
}

export function WindowFrame({
    isOpen,
    onClose,
    title,
    icon,
    size = "lg",
    tabs,
    activeTab,
    onTabChange,
    footer,
    children,
}: WindowFrameProps) {
    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            SoundManager.getInstance().play('modal-open');
        } else if (!isOpen && wasOpenRef.current) {
            SoundManager.getInstance().play('ui-close', { volume: 0.45 });
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="game-window-frame absolute inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 pointer-events-auto font-oxanium"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className={`game-window-panel w-full h-full ${SIZE_CLASSES[size]} flex flex-col bg-[rgba(13,17,23,0.98)] border border-white/10 rounded-none sm:rounded-2xl shadow-[0_12px_48px_rgba(0,0,0,0.65),0_0_0_1px_rgba(79,209,255,0.08)] overflow-hidden pt-safe pb-safe sm:pt-0 sm:pb-0`}
            >
                <div className="game-window-head relative flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {icon && (
                            <div className="relative flex items-center justify-center flex-shrink-0">
                                <div className="absolute inset-0 rounded-full bg-[#4FD1FF]/15 blur-md" />
                                <div className="relative flex items-center justify-center text-[#4FD1FF]">{icon}</div>
                            </div>
                        )}
                        <h2 className="text-lg font-black text-[#E5E7EB] tracking-wide">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-11 h-11 sm:w-8 sm:h-8 p-0 border-0 rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.06)] text-[#C5C9D1] hover:text-[#E5E7EB] hover:bg-[rgba(255,255,255,0.12)] transition-colors flex-shrink-0"
                    >
                        <X className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                    <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-[#4FD1FF] via-[#C084FC]/60 to-transparent" />
                </div>

                {tabs && tabs.length > 0 && (
                    <div className="flex gap-1 mx-4 mt-1 mb-2 p-1 rounded-full bg-[rgba(255,255,255,0.03)] flex-shrink-0 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                if (tab.id !== activeTab) SoundManager.getInstance().play('ui-tab', { volume: 0.3 });
                                onTabChange?.(tab.id);
                            }}
                                className={`relative flex items-center gap-1.5 px-4 min-h-[40px] rounded-full text-xs font-bold tracking-wide whitespace-nowrap transition-colors ${activeTab === tab.id
                                    ? "text-[#0A0E14] bg-[#4FD1FF] shadow-[0_2px_10px_rgba(79,209,255,0.35)]"
                                    : "text-[#6B7280] hover:text-[#9CA3AF] hover:bg-white/5"
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                                {tab.badge && (
                                    <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-[#FF4D4F] ring-2 ring-[rgba(13,17,23,0.98)]" />
                                )}
                            </button>
                        ))}
                    </div>
                )}

                <div className="game-window-body flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 min-h-0">{children}</div>

                {footer && (
                    <div className="game-window-footer px-4 sm:px-6 py-3 sm:py-4 border-t border-white/10 bg-[rgba(255,255,255,0.02)] flex-shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
