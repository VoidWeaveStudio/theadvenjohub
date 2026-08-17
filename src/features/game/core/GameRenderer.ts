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

export function createGameRenderer(canvas: HTMLCanvasElement, width: number, height: number): THREE.WebGLRenderer {
    installShaderNoiseFilter();

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: "high-performance"
    });

    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    return renderer;
}
