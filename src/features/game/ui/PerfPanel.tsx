// src/features/game/ui/PerfPanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, X } from "lucide-react";
import { perf } from "../core/PerfProfiler";

interface PerfPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SwitchRow {
    name: string;
    label: string;
    hint: string;
}

const SWITCHES: SwitchRow[] = [
    { name: "lightsExceptFirst", label: "Extra lights", hint: "off = only one light + ambient" },
    { name: "pointLights", label: "Point lights", hint: "off = all point lights hidden" },
    { name: "rectLights", label: "Rect area lights", hint: "off = all rect lights hidden" },
    { name: "shadows", label: "Shadows", hint: "off = shadow maps disabled" },
    { name: "shadowAuto", label: "Shadow auto-update", hint: "off = shadows frozen after one pass" },
    { name: "transparent", label: "Transparent meshes", hint: "off = hides overdraw-heavy meshes" },
    { name: "transmission", label: "Transmission (glass)", hint: "off = disables refraction pass" },
    { name: "sky", label: "Sky", hint: "off = hides sky dome" },
    { name: "environment", label: "Environment map", hint: "off = drops scene.environment" },
    { name: "castShadows", label: "Shadow casters", hint: "off = lights keep shadows but nothing casts" },
    { name: "points", label: "Particles (Points)", hint: "off = hides sparks, embers, trails" },
    { name: "sprites", label: "Sprites", hint: "off = hides nametags, health bars, billboards" },
    { name: "skinned", label: "Characters (skinned)", hint: "off = hides players, NPCs, enemies" },
    { name: "instanced", label: "Instanced meshes", hint: "off = hides grass, undergrowth, props" },
    { name: "fog", label: "Fog", hint: "off = scene.fog removed" },
    { name: "toneMapping", label: "Tone mapping", hint: "off = NoToneMapping, recompiles shaders" },
];

const PIXEL_RATIOS = [0.5, 0.75, 1, 1.25, 1.5];
const GRASS_DENSITIES = [0, 0.25, 0.5, 1];
const FPS_CAPS = [30, 60, 90, 120, 0];
const SHADOW_RES = [256, 512, 1024, 2048];

export function PerfPanel({ isOpen, onClose }: PerfPanelProps) {
    const [fps, setFps] = useState(0);
    const [frameMs, setFrameMs] = useState(0);
    const [avgMs, setAvgMs] = useState(0);
    const [fpsCap, setFpsCap] = useState<number | null>(null);
    const [info, setInfo] = useState<{ calls: number; triangles: number; programs: number } | null>(null);
    const [switches, setSwitches] = useState<Record<string, boolean>>({});
    const [pixelRatio, setPixelRatio] = useState<number | null>(null);
    const [grassDensity, setGrassDensity] = useState<number | null>(null);
    const [shadowRes, setShadowRes] = useState<number | null>(null);
    const [gpuMs, setGpuMs] = useState<number | null>(null);
    const [memory, setMemory] = useState<{ geometries: number; textures: number; heapMb: number | null } | null>(null);
    const [context, setContext] = useState<ReturnType<typeof perf.getContextInfo>>(null);
    const frameRef = useRef(0);

    useEffect(() => {
        if (!isOpen) return;

        let frames = 0;
        let windowStart = performance.now();
        let worst = 0;
        let last = windowStart;
        let cancelled = false;

        const tick = () => {
            if (cancelled) return;
            frameRef.current = requestAnimationFrame(tick);

            const now = performance.now();
            const delta = now - last;
            last = now;
            frames++;
            if (delta > worst) worst = delta;

            const elapsed = now - windowStart;
            if (elapsed >= 500) {
                setFps(Math.round((frames * 1000) / elapsed));
                setFrameMs(Math.round(worst * 10) / 10);
                setAvgMs(Math.round((elapsed / frames) * 10) / 10);
                setInfo(perf.getRenderInfo());
                setGpuMs(perf.getGpuTimeMs());
                setMemory(perf.getMemoryInfo());
                frames = 0;
                worst = 0;
                windowStart = now;
            }
        };

        frameRef.current = requestAnimationFrame(tick);
        return () => {
            cancelled = true;
            cancelAnimationFrame(frameRef.current);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setContext(perf.getContextInfo());
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const wasEnabled = perf.isEnabled();
        if (!wasEnabled) perf.enable();
        return () => {
            if (!wasEnabled) perf.disable();
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const available = new Set(perf.toggleNames());
        setSwitches((prev) => {
            const next = { ...prev };
            for (const row of SWITCHES) {
                if (available.has(row.name) && next[row.name] === undefined) next[row.name] = true;
            }
            return next;
        });
    }, [isOpen]);

    if (!isOpen) return null;

    const flip = (name: string) => {
        const next = !(switches[name] ?? true);
        setSwitches((prev) => ({ ...prev, [name]: next }));
        perf.set(name, next);
    };

    const applyPixelRatio = (value: number) => {
        setPixelRatio(value);
        perf.set("pixelRatio", value);
        setContext(perf.getContextInfo());
    };

    const applyGrassDensity = (value: number) => {
        setGrassDensity(value);
        perf.set("grassDensity", value);
    };

    const applyFpsCap = (value: number) => {
        setFpsCap(value);
        perf.set("fpsCap", value);
    };

    const applyShadowRes = (value: number) => {
        setShadowRes(value);
        perf.set("shadowRes", value);
    };

    const resetAll = () => {
        for (const row of SWITCHES) perf.set(row.name, true);
        perf.set("pixelRatio", 1);
        perf.set("grassDensity", 1);
        perf.set("fpsCap", 0);
        perf.set("shadowRes", 2048);
        setSwitches(Object.fromEntries(SWITCHES.map((row) => [row.name, true])));
        setPixelRatio(null);
        setGrassDensity(null);
        setFpsCap(null);
        setShadowRes(null);
    };

    const fpsColor = fps >= 55 ? "#4ADE80" : fps >= 30 ? "#FFD166" : "#FF5757";

    return (
        <div className="pointer-events-auto absolute top-4 left-4 z-[80] w-[292px] rounded-xl border border-white/12 bg-[rgba(10,14,20,0.94)] font-oxanium shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-sm">
            <div className="flex items-center justify-between px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-xs font-black tracking-wider text-[#E5E7EB]">
                    <Activity className="h-3.5 w-3.5 text-[#4FD1FF]" />
                    PERFORMANCE
                </span>
                <button
                    onClick={onClose}
                    className="flex h-6 w-6 items-center justify-center rounded-full border-0 bg-white/8 p-0 text-[#C5C9D1] transition-colors hover:bg-white/15"
                >
                    <X className="h-3 w-3" strokeWidth={2.5} />
                </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 px-3 pb-2">
                <div className="rounded-lg bg-white/5 px-2 py-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-[#6B7280]">FPS</div>
                    <div className="text-base font-black" style={{ color: fpsColor }}>{fps}</div>
                </div>
                <div className="rounded-lg bg-white/5 px-2 py-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-[#6B7280]">Worst ms</div>
                    <div className="text-base font-black text-[#E5E7EB]">{frameMs}</div>
                </div>
                <div className="rounded-lg bg-white/5 px-2 py-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-[#6B7280]">Draws</div>
                    <div className="text-base font-black text-[#E5E7EB]">{info?.calls ?? "—"}</div>
                </div>
            </div>

            <div className="space-y-0.5 px-3 pb-2 text-[10px] text-[#6B7280]">
                <div>
                    avg frame {avgMs} ms · gpu {gpuMs === null ? "n/a" : `${gpuMs.toFixed(1)} ms`}
                </div>
                <div>
                    triangles {info ? info.triangles.toLocaleString("en-US") : "—"} · shaders {info?.programs ?? "—"}
                </div>
                <div>
                    geometries {memory?.geometries ?? "—"} · textures {memory?.textures ?? "—"}
                    {memory?.heapMb != null && ` · heap ${memory.heapMb} MB`}
                </div>
            </div>

            {context && (
                <div
                    className="mx-3 mb-2 rounded-lg border px-2.5 py-2 text-[10px] leading-relaxed"
                    style={{
                        borderColor: context.software ? "rgba(255,87,87,0.5)" : "rgba(255,255,255,0.1)",
                        background: context.software ? "rgba(255,87,87,0.12)" : "rgba(255,255,255,0.04)",
                    }}
                >
                    <div className="mb-0.5 text-[9px] uppercase tracking-wider text-[#6B7280]">GPU context</div>
                    <div className={context.software ? "font-bold text-[#FF5757]" : "text-[#E5E7EB]"}>
                        {context.software ? "SOFTWARE RENDERING — " : ""}
                        {context.renderer}
                    </div>
                    <div className="text-[#6B7280]">{context.vendor}</div>
                    <div className="text-[#6B7280]">
                        {context.webgl2 ? "WebGL2" : "WebGL1"} · buffer {context.bufferWidth}×{context.bufferHeight} ·
                        css {context.cssWidth}×{context.cssHeight} · dpr {context.pixelRatio}
                    </div>
                </div>
            )}

            <div className="max-h-[30vh] space-y-1 overflow-y-auto px-3">
                {SWITCHES.map((row) => {
                    const on = switches[row.name] ?? true;
                    return (
                        <button
                            key={row.name}
                            onClick={() => flip(row.name)}
                            title={row.hint}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${on
                                ? "border-white/10 bg-white/5"
                                : "border-[#FF5757]/40 bg-[rgba(255,87,87,0.12)]"
                                }`}
                        >
                            <span className="truncate text-[11px] font-bold text-[#E5E7EB]">{row.label}</span>
                            <span
                                className={`flex-shrink-0 rounded-full px-1.5 text-[9px] font-black ${on ? "bg-[#4ADE80]/20 text-[#4ADE80]" : "bg-[#FF5757]/20 text-[#FF5757]"
                                    }`}
                            >
                                {on ? "ON" : "OFF"}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="space-y-2 px-3 pt-2.5">
                <div>
                    <div className="mb-1 text-[9px] uppercase tracking-wider text-[#6B7280]">Pixel ratio</div>
                    <div className="flex gap-1">
                        {PIXEL_RATIOS.map((value) => (
                            <button
                                key={value}
                                onClick={() => applyPixelRatio(value)}
                                className={`flex-1 rounded-md border px-1 py-1 text-[10px] font-bold transition-colors ${pixelRatio === value
                                    ? "border-[#4FD1FF] bg-[#4FD1FF] text-[#0A0E14]"
                                    : "border-white/10 bg-white/5 text-[#C9CDD3]"
                                    }`}
                            >
                                {value}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="mb-1 text-[9px] uppercase tracking-wider text-[#6B7280]">FPS cap</div>
                    <div className="flex gap-1">
                        {FPS_CAPS.map((value) => (
                            <button
                                key={value}
                                onClick={() => applyFpsCap(value)}
                                className={`flex-1 rounded-md border px-1 py-1 text-[10px] font-bold transition-colors ${fpsCap === value
                                    ? "border-[#4FD1FF] bg-[#4FD1FF] text-[#0A0E14]"
                                    : "border-white/10 bg-white/5 text-[#C9CDD3]"
                                    }`}
                            >
                                {value === 0 ? "off" : value}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="mb-1 text-[9px] uppercase tracking-wider text-[#6B7280]">Shadow resolution</div>
                    <div className="flex gap-1">
                        {SHADOW_RES.map((value) => (
                            <button
                                key={value}
                                onClick={() => applyShadowRes(value)}
                                className={`flex-1 rounded-md border px-1 py-1 text-[10px] font-bold transition-colors ${shadowRes === value
                                    ? "border-[#4FD1FF] bg-[#4FD1FF] text-[#0A0E14]"
                                    : "border-white/10 bg-white/5 text-[#C9CDD3]"
                                    }`}
                            >
                                {value}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="mb-1 text-[9px] uppercase tracking-wider text-[#6B7280]">Grass density</div>
                    <div className="flex gap-1">
                        {GRASS_DENSITIES.map((value) => (
                            <button
                                key={value}
                                onClick={() => applyGrassDensity(value)}
                                className={`flex-1 rounded-md border px-1 py-1 text-[10px] font-bold transition-colors ${grassDensity === value
                                    ? "border-[#4FD1FF] bg-[#4FD1FF] text-[#0A0E14]"
                                    : "border-white/10 bg-white/5 text-[#C9CDD3]"
                                    }`}
                            >
                                {value}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex gap-1.5 px-3 py-3">
                <button onClick={resetAll} className="btn-secondary flex-1 px-2 py-1.5 text-[11px]">
                    Reset all
                </button>
                <button onClick={() => perf.logCurrentScene()} className="btn-secondary flex-1 px-2 py-1.5 text-[11px]">
                    Scene report
                </button>
            </div>
        </div>
    );
}
