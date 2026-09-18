// src/features/game/ui/CinemaPanel.tsx
"use client";

import type { CinemaState } from "../core/CinemaCamera";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface CinemaPanelProps {
    state: CinemaState | null;
}

const MODE_KEYS: Record<CinemaState["mode"], string> = {
    free: "g.cinema.mode.free",
    orbit: "g.cinema.mode.orbit",
    rail: "g.cinema.mode.rail",
};

const KEY_ROWS: Array<[string, string]> = [
    ["WASD / Space / Ctrl", "g.cinema.hint.move"],
    ["Shift / Alt", "g.cinema.hint.boost"],
    ["scroll", "g.cinema.hint.speed"],
    ["[ ]", "g.cinema.hint.fov"],
    ["Q E / R", "g.cinema.hint.roll"],
    ["Z", "g.cinema.hint.smoothing"],
    ["O", "g.cinema.hint.orbit"],
    ["K / U", "g.cinema.hint.frames"],
    ["L / P", "g.cinema.hint.rail"],
    [", .", "g.cinema.hint.duration"],
    ["J", "g.cinema.hint.self"],
    ["C", "g.cinema.hint.captions"],
    ["V", "g.cinema.hint.rain"],
    ["H", "g.cinema.hint.ui"],
    ["F8", "g.cinema.hint.exit"],
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
    const { t } = useLanguage();

    if (!state?.active) return null;

    const frames = state.keyframes < 2
        ? t("g.cinema.frames.need", { count: state.keyframes })
        : t(state.railLoop ? "g.cinema.frames.loop" : "g.cinema.frames.ready", {
            count: state.keyframes,
            seconds: state.railSeconds,
        });

    return (
        <div className="absolute left-4 bottom-4 z-40 pointer-events-none font-oxanium select-none">
            <div className="rounded-[12px] bg-[rgba(10,13,18,0.82)] backdrop-blur-md ring-1 ring-[#4FD1FF]/30 px-4 py-3 w-[286px] shadow-2xl shadow-black/40">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black tracking-[0.2em] text-[#4FD1FF]">{t("g.cinema.title")}</span>
                    <span className="text-[10px] font-bold text-[#8B8F98]">{t(MODE_KEYS[state.mode])}</span>
                </div>

                <div className="space-y-1 text-[11px]">
                    <Row label={t("g.cinema.row.speed")} value={`${state.speed.toFixed(1)} m/s`} />
                    <Row label={t("g.cinema.row.fov")} value={`${Math.round(state.fov)}°`} />
                    <Row label={t("g.cinema.row.smoothing")} value={t(state.smoothingKey)} />
                    <Row label={t("g.cinema.row.roll")} value={`${(state.roll * 180 / Math.PI).toFixed(0)}°`} />
                    <Row label={t("g.cinema.row.frames")} value={frames} />
                    {state.mode === "orbit" && (
                        <Row
                            label={t("g.cinema.row.orbit")}
                            value={`${state.orbitRadius.toFixed(1)} m · ${state.orbitSpeed.toFixed(2)}`}
                        />
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
                    {KEY_ROWS.map(([keys, hint]) => (
                        <div key={keys} className="flex items-baseline justify-between gap-3">
                            <span className="font-bold text-[#4FD1FF]">{keys}</span>
                            <span className="text-[#8B8F98]">{t(hint)}</span>
                        </div>
                    ))}
                </div>

                {state.toast && (
                    <div className="mt-2 rounded-[8px] bg-[#4FD1FF]/10 px-2 py-1 text-[10px] font-bold text-[#4FD1FF] text-center">
                        {t(state.toast.key, state.toast.vars)}
                    </div>
                )}
            </div>
        </div>
    );
}
