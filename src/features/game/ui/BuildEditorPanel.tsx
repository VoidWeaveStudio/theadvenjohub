// src/features/game/ui/BuildEditorPanel.tsx
"use client";

import { useMemo, useState } from "react";
import { Hammer, Eraser, RotateCw, Save, X, Layers, Sun, Trash2 } from "lucide-react";
import { getBuildEntries, type BuildCategory } from "../world/building/BuildCatalog";
import { MAX_LEVELS } from "../world/building/BuildLayout";
import { SKY_PRESETS, LIGHT_PRESETS } from "../world/building/environmentPresets";
import type { BuildSessionState } from "../world/building/BuildSession";

const CATEGORY_LABELS: Record<BuildCategory, string> = {
    structure: "Structure",
    openings: "Doors & Windows",
    roofing: "Roofing",
    outdoor: "Outdoor",
    furniture: "Furniture",
    decor: "Decor",
};

const CATEGORY_ORDER: BuildCategory[] = ["structure", "openings", "roofing", "outdoor", "furniture", "decor"];

interface BuildEditorPanelProps {
    state: BuildSessionState;
    onSelectType: (typeId: string) => void;
    onSetTool: (tool: "place" | "erase") => void;
    onRotate: () => void;
    onSetLevel: (level: number) => void;
    onSetEnvironment: (sky: string, light: string) => void;
    onClearLot: () => void;
    onSave: () => void;
    onExit: () => void;
}

export function BuildEditorPanel({
    state,
    onSelectType,
    onSetTool,
    onRotate,
    onSetLevel,
    onSetEnvironment,
    onClearLot,
    onSave,
    onExit,
}: BuildEditorPanelProps) {
    const [category, setCategory] = useState<BuildCategory>("structure");
    const [showEnvironment, setShowEnvironment] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);

    const entries = useMemo(
        () => getBuildEntries().filter((entry) => entry.category === category),
        [category]
    );

    if (!state.active) return null;

    return (
        <>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto font-oxanium">
                <div className="flex items-center gap-2 bg-[rgba(10,14,20,0.92)] border border-[#4FD1FF]/30 rounded-xl px-3 py-2 shadow-[0_0_25px_rgba(79,209,255,0.12)]">
                    <button
                        onClick={() => onSetTool("place")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${state.tool === "place" ? "bg-[#4FD1FF]/20 text-[#4FD1FF]" : "text-[#8B8F98] hover:text-[#E5E7EB]"}`}
                    >
                        <Hammer className="w-4 h-4" /> Build
                    </button>
                    <button
                        onClick={() => onSetTool("erase")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${state.tool === "erase" ? "bg-[#FF6B7A]/20 text-[#FF6B7A]" : "text-[#8B8F98] hover:text-[#E5E7EB]"}`}
                    >
                        <Eraser className="w-4 h-4" /> Erase
                    </button>

                    <div className="w-px h-6 bg-white/10" />

                    <button
                        onClick={onRotate}
                        title="Rotate (R)"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#8B8F98] hover:text-[#E5E7EB] transition-colors"
                    >
                        <RotateCw className="w-4 h-4" /> {state.rotation * 90}°
                    </button>

                    <div className="flex items-center gap-1">
                        <Layers className="w-4 h-4 text-[#8B8F98]" />
                        {Array.from({ length: MAX_LEVELS }, (_, level) => (
                            <button
                                key={level}
                                onClick={() => onSetLevel(level)}
                                className={`w-6 h-6 rounded text-[11px] font-bold transition-colors ${state.level === level ? "bg-[#4FD1FF]/25 text-[#4FD1FF]" : "text-[#6B7280] hover:text-[#E5E7EB]"}`}
                            >
                                {level + 1}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-6 bg-white/10" />

                    <button
                        onClick={() => setShowEnvironment((open) => !open)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${showEnvironment ? "bg-[#FFD166]/20 text-[#FFD166]" : "text-[#8B8F98] hover:text-[#E5E7EB]"}`}
                    >
                        <Sun className="w-4 h-4" /> Sky
                    </button>
                    <button
                        onClick={onSave}
                        disabled={state.saving || !state.dirty}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#7FE6CF] hover:text-[#B8F5E6] disabled:opacity-40 transition-colors"
                    >
                        <Save className="w-4 h-4" /> {state.saving ? "Saving..." : "Save"}
                    </button>
                    <button
                        onClick={onExit}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#8B8F98] hover:text-[#E5E7EB] transition-colors"
                    >
                        <X className="w-4 h-4" /> Exit
                    </button>
                </div>

                {showEnvironment && (
                    <div className="mt-2 bg-[rgba(10,14,20,0.95)] border border-[#4FD1FF]/25 rounded-xl p-3 space-y-3">
                        <div>
                            <div className="text-[#8B8F98] text-[10px] uppercase tracking-wide mb-1.5">Sky</div>
                            <div className="flex flex-wrap gap-1.5">
                                {SKY_PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        onClick={() => onSetEnvironment(preset.id, state.light)}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${state.sky === preset.id ? "bg-[#4FD1FF]/20 text-[#4FD1FF]" : "bg-white/5 text-[#8B8F98] hover:text-[#E5E7EB]"}`}
                                    >
                                        {preset.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <div className="text-[#8B8F98] text-[10px] uppercase tracking-wide mb-1.5">Lighting</div>
                            <div className="flex flex-wrap gap-1.5">
                                {LIGHT_PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        onClick={() => onSetEnvironment(state.sky, preset.id)}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${state.light === preset.id ? "bg-[#FFD166]/20 text-[#FFD166]" : "bg-white/5 text-[#8B8F98] hover:text-[#E5E7EB]"}`}
                                    >
                                        {preset.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 pointer-events-auto font-oxanium">
                <div className="w-56 bg-[rgba(10,14,20,0.92)] border border-[#4FD1FF]/30 rounded-xl p-3 shadow-[0_0_25px_rgba(79,209,255,0.12)]">
                    <div className="flex flex-wrap gap-1 mb-2.5">
                        {CATEGORY_ORDER.map((id) => (
                            <button
                                key={id}
                                onClick={() => setCategory(id)}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${category === id ? "bg-[#4FD1FF]/20 text-[#4FD1FF]" : "text-[#6B7280] hover:text-[#E5E7EB]"}`}
                            >
                                {CATEGORY_LABELS[id]}
                            </button>
                        ))}
                    </div>

                    <div className="max-h-[46vh] overflow-y-auto space-y-1 pr-1">
                        {entries.map((entry) => (
                            <button
                                key={entry.id}
                                onClick={() => onSelectType(entry.id)}
                                className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors border ${state.selectedType === entry.id
                                    ? "bg-[#4FD1FF]/15 border-[#4FD1FF]/50"
                                    : "bg-black/30 border-transparent hover:border-[#4FD1FF]/30"}`}
                            >
                                <span className="text-lg">{entry.icon}</span>
                                <span className="flex-1 text-[#E5E7EB] text-xs font-bold">{entry.name}</span>
                            </button>
                        ))}
                    </div>

                    <div className="mt-2.5 pt-2.5 border-t border-white/10">
                        {confirmClear ? (
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => { onClearLot(); setConfirmClear(false); }}
                                    className="flex-1 px-2 py-1.5 rounded-md bg-[#FF4D4F]/20 text-[#FF6B7A] text-[11px] font-bold"
                                >
                                    Erase everything
                                </button>
                                <button
                                    onClick={() => setConfirmClear(false)}
                                    className="px-2 py-1.5 rounded-md bg-white/5 text-[#8B8F98] text-[11px] font-bold"
                                >
                                    No
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmClear(true)}
                                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-bold text-[#8B8F98] hover:text-[#FF6B7A] transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Clear lot
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none font-oxanium">
                <div className="bg-[rgba(10,14,20,0.85)] border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-[#8B8F98]">
                    LMB place · RMB drag to orbit · WASD pan · wheel zoom · R rotate · Q/E turn · [ ] level · X erase
                </div>
            </div>
        </>
    );
}
