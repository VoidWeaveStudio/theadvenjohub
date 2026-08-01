// src/features/game/ui/AlfredoPanel.tsx
"use client";

import { useEffect, useRef } from "react";
import { X, Palette, Shirt } from "lucide-react";
import { SoundManager } from "../core/SoundManager";

interface AlfredoPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenPersonalization: () => void;
    onNotification?: (msg: string, duration?: number) => void;
}

export function AlfredoPanel({ isOpen, onClose, onOpenPersonalization, onNotification }: AlfredoPanelProps) {
    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            SoundManager.getInstance().play('modal-open');
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto font-oxanium p-4">
            <div className="w-full max-w-md bg-[rgba(10,16,20,0.95)] border-2 border-[#4FC3FF]/40 rounded-[16px] p-6 shadow-[0_0_35px_rgba(79,195,255,0.15)]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Palette className="w-5 h-5 text-[#4FC3FF]" />
                        <h2 className="text-xl font-black text-[#E5E7EB]">Alfredo</h2>
                    </div>
                    <button onClick={onClose} className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-[#8B8F98] text-sm mb-5">What can I do for you today?</p>

                <div className="space-y-3">
                    <button
                        onClick={onOpenPersonalization}
                        className="w-full flex items-center gap-3 bg-[rgba(79,195,255,0.08)] hover:bg-[rgba(79,195,255,0.16)] border border-[#4FC3FF]/30 rounded-[10px] px-4 py-3.5 text-left transition-all"
                    >
                        <Palette className="w-6 h-6 text-[#4FC3FF] flex-shrink-0" />
                        <div>
                            <div className="text-[#E5E7EB] font-bold text-sm">Personalization</div>
                            <div className="text-[#8B8F98] text-xs">Paint your character's model</div>
                        </div>
                    </button>

                    <button
                        onClick={() => onNotification?.("👔 Accessories are coming soon", 3000)}
                        className="w-full flex items-center gap-3 bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] border border-white/10 rounded-[10px] px-4 py-3.5 text-left transition-all"
                    >
                        <Shirt className="w-6 h-6 text-[#8B8F98] flex-shrink-0" />
                        <div>
                            <div className="text-[#E5E7EB] font-bold text-sm">Accessories</div>
                            <div className="text-[#8B8F98] text-xs">Coming soon</div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
