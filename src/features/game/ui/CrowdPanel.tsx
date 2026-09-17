// src/features/game/ui/CrowdPanel.tsx
"use client";

import type { CrowdState } from "../systems/CrowdDirector";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface CrowdPanelProps {
    state: CrowdState | null;
}

const KEY_ROWS: Array<[string, string]> = [
    ["G", "g.crowd.hint.point"],
    ["C", "g.crowd.hint.path"],
    ["T", "g.crowd.hint.spawn"],
    ["Y", "g.crowd.hint.clear"],
    ["N / M", "g.crowd.hint.count"],
    ["; / '", "g.crowd.hint.spread"],
    ["V", "g.crowd.hint.set"],
    ["B", "g.crowd.hint.gait"],
    ["F7", "g.crowd.hint.exit"],
];

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <span className="text-[#8B8F98]">{label}</span>
            <span className="font-bold text-[#E5E7EB] tabular-nums">{value}</span>
        </div>
    );
}

export function CrowdPanel({ state }: CrowdPanelProps) {
    const { t } = useLanguage();

    if (!state?.active) return null;

    const path = state.points === 0
        ? t("g.crowd.path.empty")
        : state.points === 1
            ? t("g.crowd.path.one")
            : t("g.crowd.path.points", { count: state.points });

    return (
        <div className="absolute right-4 bottom-4 z-40 pointer-events-none font-oxanium select-none">
            <div className="rounded-[12px] bg-[rgba(10,13,18,0.82)] backdrop-blur-md ring-1 ring-[#a855f7]/30 px-4 py-3 w-[268px] shadow-2xl shadow-black/40">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black tracking-[0.2em] text-[#a855f7]">{t("g.crowd.title")}</span>
                    <span className="text-[10px] font-bold text-[#8B8F98]">
                        {t(state.running ? "g.crowd.gait.run" : "g.crowd.gait.walk")}
                    </span>
                </div>

                <div className="space-y-1 text-[11px]">
                    <Row label={t("g.crowd.row.set")} value={state.set} />
                    <Row label={t("g.crowd.row.count")} value={String(state.count)} />
                    <Row label={t("g.crowd.row.spread")} value={`${state.spread} m`} />
                    <Row label={t("g.crowd.row.path")} value={path} />
                    <Row label={t("g.crowd.row.actors")} value={String(state.actors)} />
                </div>

                <div className="mt-3 pt-2 border-t border-white/10 space-y-0.5 text-[10px]">
                    {KEY_ROWS.map(([keys, hint]) => (
                        <div key={keys} className="flex items-baseline justify-between gap-3">
                            <span className="font-bold text-[#a855f7]">{keys}</span>
                            <span className="text-[#8B8F98] text-right">{t(hint)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
