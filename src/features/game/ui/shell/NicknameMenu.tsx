// src/features/game/ui/shell/NicknameMenu.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, MessageCircle, Flag, Ban, UserPlus } from "lucide-react";

export interface NicknameMenuActions {
    isBlocked?: boolean;
    canInviteToFaction?: boolean;
    onInfo: () => void;
    onPrivateMessage: () => void;
    onReport: () => void;
    onToggleBlock: () => void;
    onInviteToFaction?: () => void;
}

interface NicknameMenuProps extends NicknameMenuActions {
    children: React.ReactNode;
    className?: string;
}

export function NicknameMenu({
    isBlocked,
    canInviteToFaction,
    onInfo,
    onPrivateMessage,
    onReport,
    onToggleBlock,
    onInviteToFaction,
    children,
    className,
}: NicknameMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (triggerRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const openMenu = () => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (rect) {
            const menuWidth = 208;
            const left = Math.min(rect.left, window.innerWidth - menuWidth - 8);
            setMenuPos({ top: rect.bottom + 4, left: Math.max(8, left) });
        }
        setIsOpen(true);
    };

    const run = (action: () => void) => {
        setIsOpen(false);
        action();
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    if (isOpen) {
                        setIsOpen(false);
                    } else {
                        openMenu();
                    }
                }}
                className={`bg-transparent border-0 p-0 text-left ${className || ""}`}
            >
                {children}
            </button>

            {isOpen && menuPos && typeof document !== "undefined" && createPortal(
                <div
                    ref={menuRef}
                    style={{ position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
                    className="w-52 bg-[rgba(12,14,16,0.98)] border border-white/10 rounded-lg shadow-xl overflow-hidden py-1"
                >
                    <button
                        onClick={() => run(onInfo)}
                        className="bg-transparent border-0 rounded-none w-full flex items-center gap-2 px-3 py-2 text-sm text-[#E5E7EB] hover:bg-white/5 transition-colors"
                    >
                        <Info className="w-4 h-4 text-[#4FD1FF] flex-shrink-0" /> Info
                    </button>
                    <button
                        onClick={() => run(onPrivateMessage)}
                        className="bg-transparent border-0 rounded-none w-full flex items-center gap-2 px-3 py-2 text-sm text-[#E5E7EB] hover:bg-white/5 transition-colors"
                    >
                        <MessageCircle className="w-4 h-4 text-[#4FD1FF] flex-shrink-0" /> Private Message
                    </button>
                    <button
                        onClick={() => run(onReport)}
                        className="bg-transparent border-0 rounded-none w-full flex items-center gap-2 px-3 py-2 text-sm text-[#E5E7EB] hover:bg-white/5 transition-colors"
                    >
                        <Flag className="w-4 h-4 text-[#FFD166] flex-shrink-0" /> Report
                    </button>
                    <button
                        onClick={() => run(onToggleBlock)}
                        className="bg-transparent border-0 rounded-none w-full flex items-center gap-2 px-3 py-2 text-sm text-[#E5E7EB] hover:bg-white/5 transition-colors"
                    >
                        <Ban className="w-4 h-4 text-red-400 flex-shrink-0" /> {isBlocked ? "Unmute" : "Mute"}
                    </button>
                    {canInviteToFaction && onInviteToFaction && (
                        <button
                            onClick={() => run(onInviteToFaction)}
                            className="bg-transparent border-0 rounded-none w-full flex items-center gap-2 px-3 py-2 text-sm text-[#E5E7EB] hover:bg-white/5 transition-colors"
                        >
                            <UserPlus className="w-4 h-4 text-[#4ADE80] flex-shrink-0" /> Invite to Faction
                        </button>
                    )}
                </div>,
                document.body
            )}
        </>
    );
}
