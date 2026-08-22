// src/features/game/ui/GraphicsTab.tsx
"use client";

import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import {
    DEFAULT_GRAPHICS,
    FPS_CAP_OPTIONS,
    GRAPHICS_PRESETS,
    GRASS_OPTIONS,
    GraphicsPreset,
    GraphicsSettings,
    RENDER_SCALE_OPTIONS,
    SHADOW_OPTIONS,
    applyGraphicsSettings,
    getGraphicsSettings,
    matchPreset,
    saveGraphicsSettings,
} from "../core/graphicsSettings";
import { useLanguage } from "@/core/i18n/LanguageContext";

const PRESETS: GraphicsPreset[] = ["low", "medium", "high"];

interface ToggleRow {
    key: "particles" | "pointLights" | "transmission" | "portalDetail" | "fog";
    labelKey: string;
    hintKey: string;
}

const TOGGLES: ToggleRow[] = [
    { key: "particles", labelKey: "g.graphics.particles", hintKey: "g.graphics.particlesHint" },
    { key: "pointLights", labelKey: "g.graphics.pointLights", hintKey: "g.graphics.pointLightsHint" },
    { key: "transmission", labelKey: "g.graphics.transmission", hintKey: "g.graphics.transmissionHint" },
    { key: "portalDetail", labelKey: "g.graphics.portalDetail", hintKey: "g.graphics.portalDetailHint" },
    { key: "fog", labelKey: "g.graphics.fog", hintKey: "g.graphics.fogHint" },
];

export function GraphicsTab() {
    const { t } = useLanguage();
    const [settings, setSettings] = useState<GraphicsSettings>(() => ({ ...getGraphicsSettings() }));

    const commit = (next: GraphicsSettings) => {
        setSettings(next);
        saveGraphicsSettings(next);
        applyGraphicsSettings(next);
    };

    const patch = (change: Partial<GraphicsSettings>) => commit({ ...settings, ...change });

    const activePreset = matchPreset(settings);

    const shadowLabel = (value: number) => {
        if (value === 0) return t("g.graphics.off");
        if (value === 512) return t("g.graphics.low");
        if (value === 1024) return t("g.graphics.medium");
        return t("g.graphics.high");
    };

    const grassLabel = (value: number) => (value === 0 ? t("g.graphics.off") : `${Math.round(value * 100)}%`);

    const renderRow = <T extends number>(
        titleKey: string,
        options: T[],
        value: T,
        label: (option: T) => string,
        onPick: (option: T) => void
    ) => (
        <div>
            <div className="mb-1.5 text-[10px] font-black tracking-wider text-[#6B7280]">
                {t(titleKey).toUpperCase()}
            </div>
            <div className="flex gap-1.5">
                {options.map((option) => (
                    <button
                        key={option}
                        onClick={() => onPick(option)}
                        className={`flex-1 rounded-lg border px-1 py-2 text-[11px] font-bold transition-colors ${value === option
                            ? "border-[#4FD1FF] bg-[#4FD1FF] text-[#0A0E14]"
                            : "border-white/10 bg-white/5 text-[#C9CDD3] hover:bg-white/10"
                            }`}
                    >
                        {label(option)}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div>
                <div className="mb-1.5 text-[10px] font-black tracking-wider text-[#6B7280]">
                    {t("g.graphics.preset").toUpperCase()}
                </div>
                <div className="flex gap-1.5">
                    {PRESETS.map((preset) => (
                        <button
                            key={preset}
                            onClick={() => commit({ ...GRAPHICS_PRESETS[preset] })}
                            className={`flex-1 rounded-lg border px-2 py-2 text-[11px] font-bold transition-colors ${activePreset === preset
                                ? "border-[#4FD1FF] bg-[#4FD1FF] text-[#0A0E14]"
                                : "border-white/10 bg-white/5 text-[#C9CDD3] hover:bg-white/10"
                                }`}
                        >
                            {t(`g.graphics.preset.${preset}`)}
                        </button>
                    ))}
                    <div
                        className={`flex-1 rounded-lg border px-2 py-2 text-center text-[11px] font-bold ${activePreset === null
                            ? "border-[#4FD1FF]/60 bg-[rgba(79,209,255,0.12)] text-[#4FD1FF]"
                            : "border-white/10 bg-white/5 text-[#4B5563]"
                            }`}
                    >
                        {t("g.graphics.preset.custom")}
                    </div>
                </div>
            </div>

            {renderRow(
                "g.graphics.fpsCap",
                FPS_CAP_OPTIONS,
                settings.fpsCap,
                (option) => (option === 0 ? t("g.graphics.unlimited") : String(option)),
                (option) => patch({ fpsCap: option })
            )}

            {renderRow(
                "g.graphics.renderScale",
                RENDER_SCALE_OPTIONS,
                settings.renderScale,
                (option) => `${Math.round(option * 100)}%`,
                (option) => patch({ renderScale: option })
            )}

            {renderRow(
                "g.graphics.shadows",
                SHADOW_OPTIONS,
                settings.shadowRes,
                shadowLabel,
                (option) => patch({ shadowRes: option })
            )}

            {renderRow(
                "g.graphics.grass",
                GRASS_OPTIONS,
                settings.grassDensity,
                grassLabel,
                (option) => patch({ grassDensity: option })
            )}

            <div className="space-y-1.5">
                {TOGGLES.map((row) => {
                    const on = settings[row.key];
                    return (
                        <button
                            key={row.key}
                            onClick={() => patch({ [row.key]: !on } as Partial<GraphicsSettings>)}
                            className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${on
                                ? "border-white/10 bg-white/5 hover:bg-white/10"
                                : "border-white/10 bg-transparent hover:bg-white/5"
                                }`}
                        >
                            <span className="min-w-0">
                                <span className="block truncate text-[13px] font-medium text-[#E5E7EB]">
                                    {t(row.labelKey)}
                                </span>
                                <span className="block truncate text-[11px] text-[#6B7280]">{t(row.hintKey)}</span>
                            </span>
                            <span
                                className={`flex h-5 w-9 flex-shrink-0 items-center rounded-full px-0.5 transition-colors ${on ? "bg-[#4FD1FF]" : "bg-white/12"
                                    }`}
                            >
                                <span
                                    className={`h-4 w-4 rounded-full bg-[#0A0E14] transition-transform ${on ? "translate-x-4" : "translate-x-0"
                                        }`}
                                />
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[rgba(255,255,255,0.08)] pt-3">
                <span className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
                    <Check className="h-3.5 w-3.5 text-[#4ADE80]" />
                    {t("g.graphics.saved")}
                </span>
                <button
                    onClick={() => commit({ ...DEFAULT_GRAPHICS })}
                    className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-[11px]"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t("g.graphics.reset")}
                </button>
            </div>
        </div>
    );
}
