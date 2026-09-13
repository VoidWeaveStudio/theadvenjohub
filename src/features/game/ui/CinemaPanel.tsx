// src/features/game/ui/CinemaPanel.tsx
"use client";

import type { CinemaState } from "../core/CinemaCamera";

interface CinemaPanelProps {
    state: CinemaState | null;
}

const MODE_LABEL: Record<CinemaState["mode"], string> = {
    free: "свободный полёт",
    orbit: "орбита",
    rail: "пролёт по рельсам",
};

const KEYS: Array<[string, string]> = [
    ["WASD / Space / Ctrl", "движение"],
    ["Shift / Alt", "×4 / ×0.25"],
    ["колесо", "скорость"],
    ["[ ]", "угол обзора"],
    ["Q E / R", "крен / сброс"],
    ["Z", "плавность"],
    ["O", "орбита вокруг точки"],
    ["K / U", "кадр / очистить"],
    ["L / P", "пролёт / повтор"],
    [", .", "длительность"],
    ["J", "свой персонаж"],
    ["H", "спрятать интерфейс"],
    ["F8", "выход"],
];

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <span className="text-[#8B8F98]">{label}</span>
            <span className="font-bold text-[#E5E7EB] tabular-nums">{value}</span>
        </div>
    );
}

export function CinemaPanel({ state }: CinemaPanelProps) {
    if (!state?.active) return null;

    const railLabel = state.keyframes < 2
        ? `${state.keyframes} (нужно 2+)`
        : `${state.keyframes} · ${state.railSeconds}с${state.railLoop ? " · повтор" : ""}`;

    return (
        <div className="absolute left-4 bottom-4 z-40 pointer-events-none font-oxanium select-none">
            <div className="rounded-[12px] bg-[rgba(10,13,18,0.82)] backdrop-blur-md ring-1 ring-[#4FD1FF]/30 px-4 py-3 w-[268px] shadow-2xl shadow-black/40">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black tracking-[0.2em] text-[#4FD1FF]">КИНОКАМЕРА</span>
                    <span className="text-[10px] font-bold text-[#8B8F98]">{MODE_LABEL[state.mode]}</span>
                </div>

                <div className="space-y-1 text-[11px]">
                    <Row label="скорость" value={`${state.speed.toFixed(1)} м/с`} />
                    <Row label="обзор" value={`${Math.round(state.fov)}°`} />
                    <Row label="плавность" value={state.smoothing} />
                    <Row label="крен" value={`${(state.roll * 180 / Math.PI).toFixed(0)}°`} />
                    <Row label="кадры" value={railLabel} />
                    {state.mode === "orbit" && (
                        <Row label="радиус" value={`${state.orbitRadius.toFixed(1)} м · ${state.orbitSpeed.toFixed(2)} рад/с`} />
                    )}
                    {state.mode === "rail" && (
                        <div className="h-1 rounded-full bg-white/10 overflow-hidden mt-1">
                            <div
                                className="h-full bg-[#4FD1FF] transition-[width] duration-100 ease-linear"
                                style={{ width: `${Math.round(state.railProgress * 100)}%` }}
                            />
                        </div>
                    )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-white/10 space-y-0.5 text-[10px]">
                    {KEYS.map(([key, hint]) => (
                        <div key={key} className="flex items-baseline justify-between gap-3">
                            <span className="font-bold text-[#4FD1FF]">{key}</span>
                            <span className="text-[#8B8F98]">{hint}</span>
                        </div>
                    ))}
                </div>

                {state.toast && (
                    <div className="mt-2 rounded-[8px] bg-[#4FD1FF]/10 px-2 py-1 text-[10px] font-bold text-[#4FD1FF] text-center">
                        {state.toast}
                    </div>
                )}
            </div>
        </div>
    );
}
