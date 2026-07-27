// src/features/game/ui/shell/WindowFrame.tsx
"use client";

import { X } from "lucide-react";

export type WindowFrameSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<WindowFrameSize, string> = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-4xl h-[82vh]",
};

export interface WindowFrameTab {
    id: string;
    label: string;
    icon?: React.ReactNode;
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
    if (!isOpen) return null;

    return (
        <div
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(4,6,10,0.88)] backdrop-blur-md pointer-events-auto font-oxanium"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className={`w-full ${SIZE_CLASSES[size]} flex flex-col bg-[rgba(10,14,20,0.97)] border border-[rgba(79,209,255,0.18)] rounded-2xl shadow-[0_0_70px_rgba(79,209,255,0.07)] overflow-hidden`}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(79,209,255,0.12)] bg-gradient-to-r from-[rgba(79,209,255,0.07)] to-transparent flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        {icon && (
                            <div className="w-8 h-8 rounded-lg bg-[rgba(79,209,255,0.12)] border border-[rgba(79,209,255,0.25)] flex items-center justify-center text-[#4FD1FF] flex-shrink-0">
                                {icon}
                            </div>
                        )}
                        <h2 className="text-lg font-black text-[#E5E7EB] tracking-wide">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8B8F98] hover:text-[#E5E7EB] hover:bg-[rgba(255,255,255,0.07)] transition-colors flex-shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {tabs && tabs.length > 0 && (
                    <div className="flex gap-1 px-4 pt-3 border-b border-[rgba(79,209,255,0.1)] flex-shrink-0 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange?.(tab.id)}
                                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-lg text-xs font-bold tracking-wide whitespace-nowrap transition-colors ${activeTab === tab.id
                                    ? "text-[#4FD1FF] bg-[rgba(79,209,255,0.08)] border-t border-x border-[rgba(79,209,255,0.2)]"
                                    : "text-[#6B7280] hover:text-[#8B8F98]"
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-6 min-h-0">{children}</div>

                {footer && (
                    <div className="px-6 py-4 border-t border-[rgba(79,209,255,0.1)] bg-[rgba(255,255,255,0.02)] flex-shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
