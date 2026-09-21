// src/features/game/ui/ScenePanel.tsx
"use client";

import type { SceneDirectorState } from "../systems/SceneDirector";

interface ScenePanelProps {
    state: SceneDirectorState | null;
}

const TIMELINE_KEYS: Array<[string, string]> = [
    ["F", "play / pause scene"],
    ["← →", "step one frame"],
    ["Shift + ← →", "step ten frames"],
    ["↑ ↓", "jump to line"],
    ["Home", "back to start"],
    ["B", "bone editor"],
];

const BONE_KEYS: Array<[string, string]> = [
    ["1 / 2", "pick actor"],
    ["3 / 4", "pick bone"],
    ["5", "cycle axis"],
    ["6 / 7 or Num4 / Num6", "rotate"],
    ["Alt", "fine step"],
    ["Num5 / Num0", "reset bone / actor"],
    ["X", "log pose to console"],
    ["I / Del", "add / drop key"],
    ["Y", "play recorded clip"],
    ["T / \\", "export / clear clip"],
];

function clock(seconds: number): string {
    const total = Math.max(0, seconds);
    const minutes = Math.floor(total / 60);
    const rest = total - minutes * 60;
    return `${minutes}:${rest.toFixed(2).padStart(5, "0")}`;
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <span className="text-[#8B8F98]">{label}</span>
            <span className="font-bold text-[#E5E7EB] tabular-nums">{value}</span>
        </div>
    );
}

export function ScenePanel({ state }: ScenePanelProps) {
    if (!state) return null;

    const progress = state.duration > 0 ? state.time / state.duration : 0;

    return (
        <div className="absolute right-4 top-20 z-40 pointer-events-none font-oxanium select-none">
            <div className="rounded-[12px] bg-[rgba(10,13,18,0.82)] backdrop-blur-md ring-1 ring-[#FFD489]/30 px-4 py-3 w-[300px] shadow-2xl shadow-black/40">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black tracking-[0.2em] text-[#FFD489]">SCENE</span>
                    <span className="text-[10px] font-bold text-[#8B8F98]">
                        {state.paused ? "PAUSED" : "RUNNING"}
                    </span>
                </div>

                <div className="space-y-1 text-[11px]">
                    <Row label="time" value={`${clock(state.time)} / ${clock(state.duration)}`} />
                    <Row label="frame" value={`${state.frame} / ${state.frames}`} />
                    <div className="h-1 rounded-full bg-white/10 overflow-hidden mt-1">
                        <div
                            className="h-full bg-[#FFD489] transition-[width] duration-100 ease-linear"
                            style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                    </div>
                    {state.cue && (
                        <div className="mt-1.5 text-[10px] leading-snug text-[#C9C4BA]">{state.cue}</div>
                    )}
                </div>

                {state.boneMode && (
                    <div className="mt-2.5 pt-2 border-t border-white/10 space-y-1 text-[11px]">
                        <Row label="actor" value={`${state.actor} (${state.actorIndex}/${state.actorCount})`} />
                        <Row label="bone" value={state.bone} />
                        <Row label="axis" value={state.axis} />
                        <Row label="angle" value={`${state.angle.toFixed(3)} rad`} />
                        <Row
                            label="keys"
                            value={`${state.keys}${state.clipPlaying ? " · playing" : ""}`}
                        />
                    </div>
                )}

                <div className="mt-2.5 pt-2 border-t border-white/10 space-y-0.5 text-[10px]">
                    {(state.boneMode ? BONE_KEYS : TIMELINE_KEYS).map(([keys, hint]) => (
                        <div key={keys} className="flex items-baseline justify-between gap-3">
                            <span className="font-bold text-[#FFD489]">{keys}</span>
                            <span className="text-[#8B8F98]">{hint}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
