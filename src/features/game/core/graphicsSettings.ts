// src/features/game/core/graphicsSettings.ts
import { perf } from "./PerfProfiler";

export interface GraphicsSettings {
    fpsCap: number;
    renderScale: number;
    shadowRes: number;
    grassDensity: number;
    particles: boolean;
    pointLights: boolean;
    transmission: boolean;
    portalDetail: boolean;
    fog: boolean;
}

export type GraphicsPreset = "mobile" | "low" | "medium" | "high";

export const FPS_CAP_OPTIONS = [30, 60, 90, 120, 144, 0];
export const RENDER_SCALE_OPTIONS = [0.5, 0.6, 0.75, 1, 1.25, 1.5];
export const SHADOW_OPTIONS = [0, 512, 1024, 2048];
export const GRASS_OPTIONS = [0, 0.25, 0.5, 1];

export const DEFAULT_GRAPHICS: GraphicsSettings = {
    fpsCap: 144,
    renderScale: 1,
    shadowRes: 2048,
    grassDensity: 1,
    particles: true,
    pointLights: true,
    transmission: true,
    portalDetail: true,
    fog: true,
};

export const GRAPHICS_PRESETS: Record<GraphicsPreset, GraphicsSettings> = {
    mobile: {
        fpsCap: 60,
        renderScale: 0.75,
        shadowRes: 0,
        grassDensity: 0,
        particles: false,
        pointLights: false,
        transmission: false,
        portalDetail: false,
        fog: true,
    },
    low: {
        fpsCap: 60,
        renderScale: 1,
        shadowRes: 0,
        grassDensity: 0,
        particles: false,
        pointLights: false,
        transmission: false,
        portalDetail: false,
        fog: true,
    },
    medium: {
        fpsCap: 144,
        renderScale: 1,
        shadowRes: 1024,
        grassDensity: 0.5,
        particles: true,
        pointLights: false,
        transmission: false,
        portalDetail: false,
        fog: true,
    },
    high: {
        fpsCap: 144,
        renderScale: 1,
        shadowRes: 2048,
        grassDensity: 1,
        particles: true,
        pointLights: true,
        transmission: true,
        portalDetail: true,
        fog: true,
    },
};

const STORAGE_KEY = "tanjo_graphics";

let current: GraphicsSettings = { ...DEFAULT_GRAPHICS };
let loaded = false;

function sanitize(raw: unknown): GraphicsSettings {
    const source = (raw ?? {}) as Partial<GraphicsSettings>;
    const pick = (value: unknown, options: number[], fallback: number) =>
        typeof value === "number" && options.includes(value) ? value : fallback;

    return {
        fpsCap: pick(source.fpsCap, FPS_CAP_OPTIONS, DEFAULT_GRAPHICS.fpsCap),
        renderScale: pick(source.renderScale, RENDER_SCALE_OPTIONS, DEFAULT_GRAPHICS.renderScale),
        shadowRes: pick(source.shadowRes, SHADOW_OPTIONS, DEFAULT_GRAPHICS.shadowRes),
        grassDensity: pick(source.grassDensity, GRASS_OPTIONS, DEFAULT_GRAPHICS.grassDensity),
        particles: typeof source.particles === "boolean" ? source.particles : DEFAULT_GRAPHICS.particles,
        pointLights: typeof source.pointLights === "boolean" ? source.pointLights : DEFAULT_GRAPHICS.pointLights,
        transmission: typeof source.transmission === "boolean" ? source.transmission : DEFAULT_GRAPHICS.transmission,
        portalDetail: typeof source.portalDetail === "boolean" ? source.portalDetail : DEFAULT_GRAPHICS.portalDetail,
        fog: typeof source.fog === "boolean" ? source.fog : DEFAULT_GRAPHICS.fog,
    };
}

export function prefersMobileProfile(): boolean {
    if (typeof window === "undefined") return false;

    const ua = window.navigator.userAgent || "";
    const touch = "ontouchstart" in window || window.navigator.maxTouchPoints > 0;
    const smallViewport = Math.min(window.innerWidth, window.innerHeight) < 820;

    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (touch && smallViewport);
}

export function getGraphicsSettings(): GraphicsSettings {
    if (loaded) return current;
    loaded = true;

    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);

        if (!stored && prefersMobileProfile()) {
            current = { ...GRAPHICS_PRESETS.mobile };
            return current;
        }

        current = sanitize(stored ? JSON.parse(stored) : null);
    } catch {
        current = prefersMobileProfile() ? { ...GRAPHICS_PRESETS.mobile } : { ...DEFAULT_GRAPHICS };
    }

    return current;
}

export function saveGraphicsSettings(settings: GraphicsSettings) {
    current = sanitize(settings);
    loaded = true;

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch { }
}

export function applyGraphicsSettings(settings: GraphicsSettings = getGraphicsSettings()) {
    perf.set("fpsCap", settings.fpsCap, true);
    perf.set("pixelRatio", settings.renderScale, true);
    perf.set("shadows", settings.shadowRes > 0, true);
    if (settings.shadowRes > 0) perf.set("shadowRes", settings.shadowRes, true);
    perf.set("grassDensity", settings.grassDensity, true);
    perf.set("points", settings.particles, true);
    perf.set("pointLights", settings.pointLights, true);
    perf.set("transmission", settings.transmission, true);
    perf.set("portalDetail", settings.portalDetail, true);
    perf.set("fog", settings.fog, true);
}

export function reapplySceneGraphics(settings: GraphicsSettings = getGraphicsSettings()) {
    if (!settings.particles) perf.set("points", false, true);
    if (!settings.pointLights) perf.set("pointLights", false, true);
    if (!settings.transmission) perf.set("transmission", false, true);
    if (!settings.portalDetail) perf.set("portalDetail", false, true);
    if (!settings.fog) perf.set("fog", false, true);
    if (settings.shadowRes > 0 && settings.shadowRes !== DEFAULT_GRAPHICS.shadowRes) {
        perf.set("shadowRes", settings.shadowRes, true);
    }
    if (settings.grassDensity !== DEFAULT_GRAPHICS.grassDensity) {
        perf.set("grassDensity", settings.grassDensity, true);
    }
}

export function matchPreset(settings: GraphicsSettings): GraphicsPreset | null {
    const keys = Object.keys(DEFAULT_GRAPHICS) as (keyof GraphicsSettings)[];

    for (const name of Object.keys(GRAPHICS_PRESETS) as GraphicsPreset[]) {
        const preset = GRAPHICS_PRESETS[name];
        if (keys.every((key) => preset[key] === settings[key])) return name;
    }

    return null;
}
