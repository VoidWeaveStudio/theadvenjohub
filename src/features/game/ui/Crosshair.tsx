// src/features/game/ui/Crosshair.tsx
"use client";

import { useEffect, useState } from "react";

interface CrosshairProps {
    visible: boolean;
    isHitMark?: boolean;
}

export function Crosshair({ visible, isHitMark = false }: CrosshairProps) {
    const [showHitMark, setShowHitMark] = useState(false);

    useEffect(() => {
        if (isHitMark) {
            setShowHitMark(true);
            const timer = setTimeout(() => setShowHitMark(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isHitMark]);

    if (!visible) return null;

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-8 h-8">
                <div className="absolute top-1/2 left-0 w-2 h-0.5 bg-[#E5E7EB]/80 -translate-y-1/2" />
                <div className="absolute top-1/2 right-0 w-2 h-0.5 bg-[#E5E7EB]/80 -translate-y-1/2" />
                <div className="absolute left-1/2 top-0 h-2 w-0.5 bg-[#E5E7EB]/80 -translate-x-1/2" />
                <div className="absolute left-1/2 bottom-0 h-2 w-0.5 bg-[#E5E7EB]/80 -translate-x-1/2" />
                
                <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-[#FF5757] rounded-full -translate-x-1/2 -translate-y-1/2" />

                {showHitMark && (
                    <>
                        <div className="absolute top-1/2 left-1/2 w-4 h-0.5 bg-[#FF5757] -translate-x-1/2 -translate-y-1/2 rotate-45 drop-shadow-[0_0_4px_rgba(255,87,87,0.9)]" />
                        <div className="absolute top-1/2 left-1/2 w-4 h-0.5 bg-[#FF5757] -translate-x-1/2 -translate-y-1/2 -rotate-45 drop-shadow-[0_0_4px_rgba(255,87,87,0.9)]" />
                    </>
                )}
            </div>
        </div>
    );
}