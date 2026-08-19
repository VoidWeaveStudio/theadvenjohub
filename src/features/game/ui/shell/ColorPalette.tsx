// src/features/game/ui/shell/ColorPalette.tsx
"use client";

import { useLanguage } from "@/core/i18n/LanguageContext";

interface ColorPaletteProps {
    color: string;
    onChange: (color: string) => void;
    swatchClassName?: string;
}

const PRESET_COLORS = [
    "#FFFFFF", "#D1D5DB", "#9CA3AF", "#4B5563", "#1F2937", "#000000",
    "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16", "#22C55E",
    "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1",
    "#8B5CF6", "#A855F7", "#D946EF", "#EC4899", "#F43F5E", "#78350F",
];

export function ColorPalette({ color, onChange, swatchClassName = "w-6 h-6" }: ColorPaletteProps) {
    const { t } = useLanguage();

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_COLORS.map((c) => (
                <button
                    key={c}
                    type="button"
                    onClick={() => onChange(c)}
                    style={{ backgroundColor: c }}
                    className={`${swatchClassName} rounded-full border-2 transition-transform flex-shrink-0 ${color.toLowerCase() === c.toLowerCase() ? "border-white scale-110" : "border-white/20"}`}
                    aria-label={c}
                />
            ))}
            <label
                className={`${swatchClassName} relative rounded-full border-2 border-white/20 cursor-pointer overflow-hidden flex-shrink-0`}
                style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
                title={t("g.palette.customColor")}
            >
                <input
                    type="color"
                    value={color}
                    onChange={(e) => onChange(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
            </label>
        </div>
    );
}
