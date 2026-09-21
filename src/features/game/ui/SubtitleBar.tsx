// src/features/game/ui/SubtitleBar.tsx
"use client";

import { useEffect, useState } from "react";
import type { SceneSubtitle } from "../world/locations/showcase/scene/SceneTimeline";
import { onSceneSubtitle } from "../world/locations/showcase/scene/subtitles";

interface SubtitleBarProps {
    hidden?: boolean;
}

// Scene dialogue as a caption strip. The scripted rooms write to the subtitle channel
// and this listens, so a long confession does not have to fit in a speech bubble.
export function SubtitleBar({ hidden }: SubtitleBarProps) {
    const [subtitle, setSubtitle] = useState<SceneSubtitle | null>(null);

    useEffect(() => onSceneSubtitle(setSubtitle), []);

    if (hidden || !subtitle) return null;

    return (
        <div
            data-cinema-keep="true"
            className="absolute inset-x-0 bottom-24 z-30 flex justify-center px-6 pointer-events-none select-none"
        >
            <div className="max-w-[860px] rounded-[10px] bg-[rgba(8,10,14,0.78)] backdrop-blur-sm ring-1 ring-white/10 px-5 py-3 text-center shadow-2xl shadow-black/50">
                <div className="text-[10px] font-black tracking-[0.28em] text-[#FFD489] font-oxanium">
                    {subtitle.speaker}
                </div>
                <div className="mt-1 text-[15px] leading-snug font-semibold text-[#F2ECE2] font-oxanium">
                    {subtitle.text}
                </div>
            </div>
        </div>
    );
}
