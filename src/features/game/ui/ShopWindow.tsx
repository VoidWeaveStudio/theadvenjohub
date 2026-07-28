// src/features/game/ui/ShopWindow.tsx
"use client";

import Image from "next/image";
import { Sparkles } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";

interface ShopWindowProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ShopWindow({ isOpen, onClose }: ShopWindowProps) {
    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title="Shop"
            icon={
                <Image
                    src="/icons/topmenu/shop.webp"
                    alt=""
                    width={100}
                    height={200}
                    className="h-11 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                />
            }
            size="md"
        >
            <div className="text-center py-14">
                <Sparkles className="w-10 h-10 text-[#FFD166] mx-auto mb-3" />
                <h3 className="text-[#E5E7EB] text-lg font-bold mb-1">Coming Soon</h3>
                <p className="text-[#8B8F98] text-sm max-w-xs mx-auto">
                    The TNJ token shop is under construction. Check back soon to spend TNJ on exclusive items.
                </p>
            </div>
        </WindowFrame>
    );
}
