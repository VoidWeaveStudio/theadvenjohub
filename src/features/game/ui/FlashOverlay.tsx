// src/features/game/ui/FlashOverlay.tsx
"use client";

import { useEffect, useState } from "react";

interface FlashOverlayProps {
    until: number;
}

export function FlashOverlay({ until }: FlashOverlayProps) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (until <= Date.now()) return;
        let raf = 0;
        const tick = () => {
            setNow(Date.now());
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [until]);

    const remaining = until - now;
    if (remaining <= 0) return null;

    const total = 3400;
    const opacity = Math.min(1, Math.pow(remaining / total, 0.55) * 1.35);

    return (
        <div
            className="absolute inset-0 pointer-events-none z-[200]"
            style={{ background: "#ffffff", opacity }}
        />
    );
}
