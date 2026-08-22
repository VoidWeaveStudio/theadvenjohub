// src/features/game/core/GameRenderer.ts
import * as THREE from "three";

const PROGRAM_INFO_LOG = "Program Info Log:";
const DRIVER_SHADER_NOISE = /warning\s+X\d+:|^warning:/i;

let consoleFilterInstalled = false;

function isDriverShaderNoise(message: string, params: unknown[]): boolean {
    const text = [message, ...params]
        .filter((part): part is string => typeof part === "string")
        .join("\n");

    const body = text.slice(text.indexOf(PROGRAM_INFO_LOG) + PROGRAM_INFO_LOG.length);
    const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);

    return lines.length > 0 && lines.every((line) => DRIVER_SHADER_NOISE.test(line));
}

function installShaderNoiseFilter() {
    if (consoleFilterInstalled) return;
    consoleFilterInstalled = true;

    THREE.setConsoleFunction((type, message, ...params) => {
        if (type === "warn" && message.includes(PROGRAM_INFO_LOG) && isDriverShaderNoise(message, params)) return;
        console[type](message, ...params);
    });
}

const MAX_PIXEL_RATIO = 1.5;
const TRANSMISSION_RESOLUTION_SCALE = 0.5;

function isMobileProfile(): boolean {
    if (typeof window === "undefined") return false;

    const ua = window.navigator.userAgent || "";
    const touch = "ontouchstart" in window || window.navigator.maxTouchPoints > 0;
    const smallViewport = Math.min(window.innerWidth, window.innerHeight) < 820;

    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (touch && smallViewport);
}

export function basePixelRatio(): number {
    if (typeof window === "undefined") return 1;

    return Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
}

export function createGameRenderer(canvas: HTMLCanvasElement, width: number, height: number): THREE.WebGLRenderer {
    installShaderNoiseFilter();

    const mobile = isMobileProfile();

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !mobile,
        powerPreference: "high-performance"
    });

    renderer.setSize(width, height, false);
    renderer.setPixelRatio(basePixelRatio());

    renderer.shadowMap.enabled = !mobile;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    // Anything still using MeshPhysicalMaterial.transmission (events lobby
    // glass, canyon segment shells) makes three.js re-render the opaque scene
    // into a full-viewport, >=4x MSAA target every frame it is on screen. Half
    // resolution cuts that to a quarter, and since the result is only used as a
    // blurred refraction lookup the difference does not show in motion.
    renderer.transmissionResolutionScale = TRANSMISSION_RESOLUTION_SCALE;

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    return renderer;
}
