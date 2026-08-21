// src/features/game/core/PerfProfiler.ts
import * as THREE from "three";

interface SectionAccumulator {
    total: number;
    max: number;
    calls: number;
}

interface LoadEntry {
    label: string;
    depth: number;
    ms: number;
}

interface SweepStep {
    name: string;
    apply: () => void;
    restore: () => void;
}

interface SceneStats {
    objects: number;
    meshes: number;
    skinned: number;
    sprites: number;
    triangles: number;
    shadowCasters: number;
    shadowTriangles: number;
    transparentMeshes: number;
    transmissiveMeshes: number;
    materials: number;
    textures: number;
    textureMb: number;
    canvasTextures: number;
    lights: Record<string, number>;
    shadowLights: number;
    heaviest: { name: string; triangles: number }[];
}

const REPORT_INTERVAL_MS = 3000;
const GPU_PROBE_INTERVAL_MS = 3000;
const LONG_FRAME_MS = 25;
const STORAGE_KEY = "tanjo_perf";
const SWEEP_WARMUP_FRAMES = 8;
const SWEEP_SAMPLE_FRAMES = 20;

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function ms(value: number): string {
    return value.toFixed(1).padStart(7, " ");
}

function triangleCount(geometry: THREE.BufferGeometry): number {
    const index = geometry.getIndex();
    if (index) return index.count / 3;
    const position = geometry.getAttribute("position");
    return position ? position.count / 3 : 0;
}

function textureMegabytes(texture: THREE.Texture): number {
    const image = texture.image as { width?: number; height?: number } | undefined;
    const width = image?.width ?? 0;
    const height = image?.height ?? 0;
    if (!width || !height) return 0;
    const mip = texture.generateMipmaps ? 1.34 : 1;
    return (width * height * 4 * mip) / (1024 * 1024);
}

class PerfProfiler {
    private enabled = false;
    private renderer: THREE.WebGLRenderer | null = null;
    private scene: THREE.Scene | null = null;
    private label = "none";

    private windowSections = new Map<string, SectionAccumulator>();
    private frameSections = new Map<string, number>();
    private open: { label: string; start: number }[] = [];

    private windowStart = 0;
    private frameStart = 0;
    private frames = 0;
    private frameTotal = 0;
    private frameMax = 0;
    private longFrames = 0;
    private worstFrameMs = 0;
    private worstFrameParts = "";

    private loadEntries: LoadEntry[] = [];
    private loadDepth = 0;

    private gpuProbeAt = 0;
    private gpuWaitMs = 0;

    private timerExt: any = null;
    private activeQuery: WebGLQuery | null = null;
    private pendingQueries: WebGLQuery[] = [];
    private gpuTimeMs = 0;

    private sweepSteps: SweepStep[] = [];
    private sweepIndex = -1;
    private sweepFrames = 0;
    private sweepSamples: number[] = [];
    private sweepResults: { name: string; ms: number }[] = [];

    private toggles = new Map<string, (value: boolean | number) => void>();
    private savedFog: THREE.Fog | THREE.FogExp2 | null = null;
    private shadowCasterCache = new WeakSet<THREE.Mesh>();

    constructor() {
        if (typeof window === "undefined") return;

        const fromQuery = new URLSearchParams(window.location.search).get("perf");
        const fromStorage = (() => {
            try {
                return window.localStorage.getItem(STORAGE_KEY);
            } catch {
                return null;
            }
        })();

        this.enabled = fromQuery === "1" || fromStorage === "1";

        (window as any).tanjoPerf = {
            on: () => this.enable(),
            off: () => this.disable(),
            status: () => this.enabled,
            scene: () => this.logSceneReport(this.label, this.scene),
            set: (name: string, value: boolean | number) => this.set(name, value),
            list: () => Array.from(this.toggles.keys()),
            sweep: () => this.startSweep(),
        };

        if (this.enabled) console.log("[perf] profiler active — window.tanjoPerf.list() for toggles");
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public enable() {
        this.enabled = true;
        try {
            window.localStorage.setItem(STORAGE_KEY, "1");
        } catch { }
        this.resetWindow();
        console.log("[perf] enabled (reload the game to capture load timings)");
    }

    public disable() {
        this.enabled = false;
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch { }
        console.log("[perf] disabled");
    }

    public attach(renderer: THREE.WebGLRenderer) {
        this.renderer = renderer;
        this.timerExt = renderer.getContext().getExtension("EXT_disjoint_timer_query_webgl2");
        this.registerBuiltInToggles();
        if (this.enabled) this.logContext();
    }

    public setScene(label: string, scene: THREE.Scene | null) {
        this.label = label;
        this.scene = scene;
        this.resetWindow();
    }

    public measure<T>(label: string, fn: () => T): T {
        if (!this.enabled) return fn();

        const entry: LoadEntry = { label, depth: this.loadDepth, ms: 0 };
        this.loadEntries.push(entry);
        this.loadDepth++;
        const start = performance.now();
        try {
            return fn();
        } finally {
            entry.ms = performance.now() - start;
            this.loadDepth--;
        }
    }

    public async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
        if (!this.enabled) return fn();

        const entry: LoadEntry = { label, depth: this.loadDepth, ms: 0 };
        this.loadEntries.push(entry);
        this.loadDepth++;
        const start = performance.now();
        try {
            return await fn();
        } finally {
            entry.ms = performance.now() - start;
            this.loadDepth--;
        }
    }

    public flushLoad(label: string) {
        if (!this.enabled || this.loadEntries.length === 0) return;

        const lines = this.loadEntries.map(
            (entry) => `${ms(entry.ms)} ms  ${"    ".repeat(entry.depth)}${entry.label}`
        );
        const total = this.loadEntries
            .filter((entry) => entry.depth === 0)
            .reduce((sum, entry) => sum + entry.ms, 0);

        this.loadEntries = [];
        this.loadDepth = 0;

        console.log(
            `[perf/load] ${label} — main thread blocked ${total.toFixed(1)} ms\n${lines.join("\n")}`
        );
    }

    public frameBegin() {
        if (!this.enabled) return;
        this.frameStart = performance.now();
        this.frameSections.clear();
        this.open.length = 0;
        if (this.windowStart === 0) this.windowStart = this.frameStart;
    }

    public begin(label: string) {
        if (!this.enabled) return;
        this.open.push({ label, start: performance.now() });
    }

    public end(label: string) {
        if (!this.enabled) return;

        const index = this.open.findIndex((item) => item.label === label);
        if (index < 0) return;

        const [item] = this.open.splice(index, 1);
        const elapsed = performance.now() - item.start;
        this.frameSections.set(label, (this.frameSections.get(label) ?? 0) + elapsed);
    }

    public beginRender() {
        if (!this.enabled) return;

        this.begin("render");
        this.beginGpuQuery();
    }

    public endRender() {
        if (!this.enabled) return;

        this.endGpuQuery();
        this.pollGpuQueries();
        this.end("render");

        const now = performance.now();
        if (!this.renderer || now - this.gpuProbeAt < GPU_PROBE_INTERVAL_MS) return;

        this.gpuProbeAt = now;
        const gl = this.renderer.getContext();
        const before = performance.now();
        gl.finish();
        this.gpuWaitMs = performance.now() - before;
    }

    private beginGpuQuery() {
        const gl = this.renderer?.getContext() as WebGL2RenderingContext | undefined;
        if (!gl || !this.timerExt || this.activeQuery) return;

        const query = gl.createQuery();
        if (!query) return;

        gl.beginQuery(this.timerExt.TIME_ELAPSED_EXT, query);
        this.activeQuery = query;
    }

    private endGpuQuery() {
        const gl = this.renderer?.getContext() as WebGL2RenderingContext | undefined;
        if (!gl || !this.timerExt || !this.activeQuery) return;

        gl.endQuery(this.timerExt.TIME_ELAPSED_EXT);
        this.pendingQueries.push(this.activeQuery);
        this.activeQuery = null;
    }

    private pollGpuQueries() {
        const gl = this.renderer?.getContext() as WebGL2RenderingContext | undefined;
        if (!gl || !this.timerExt || this.pendingQueries.length === 0) return;

        const disjoint = gl.getParameter(this.timerExt.GPU_DISJOINT_EXT);
        const remaining: WebGLQuery[] = [];

        for (const query of this.pendingQueries) {
            if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
                remaining.push(query);
                continue;
            }
            if (!disjoint) this.gpuTimeMs = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
            gl.deleteQuery(query);
        }

        this.pendingQueries = remaining;
    }

    public frameEnd() {
        if (!this.enabled) return;

        const elapsed = performance.now() - this.frameStart;
        this.advanceSweep(elapsed);
        this.frames++;
        this.frameTotal += elapsed;
        if (elapsed > this.frameMax) this.frameMax = elapsed;
        if (elapsed > LONG_FRAME_MS) this.longFrames++;

        if (elapsed > this.worstFrameMs) {
            this.worstFrameMs = elapsed;
            this.worstFrameParts = Array.from(this.frameSections.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([label, value]) => `${label} ${value.toFixed(1)}`)
                .join("  ");
        }

        for (const [label, value] of this.frameSections) {
            const accumulator = this.windowSections.get(label) ?? { total: 0, max: 0, calls: 0 };
            accumulator.total += value;
            accumulator.calls++;
            if (value > accumulator.max) accumulator.max = value;
            this.windowSections.set(label, accumulator);
        }

        if (performance.now() - this.windowStart >= REPORT_INTERVAL_MS) this.report();
    }

    private report() {
        const elapsed = (performance.now() - this.windowStart) / 1000;
        if (elapsed <= 0 || this.frames === 0) return this.resetWindow();

        const fps = this.frames / elapsed;
        const avgFrame = this.frameTotal / this.frames;

        const sections = Array.from(this.windowSections.entries())
            .map(([label, value]) => ({
                label,
                avg: value.total / this.frames,
                max: value.max,
            }))
            .sort((a, b) => b.avg - a.avg)
            .map((item) => `${ms(item.avg)} ms avg  ${ms(item.max)} ms max  ${item.label}`);

        const info = this.renderer?.info;
        const memory = (performance as any).memory;

        const gpuLine = this.timerExt
            ? `gpu time (timer query): ${this.gpuTimeMs.toFixed(1)} ms`
            : `gpu drain after submit: ${this.gpuWaitMs.toFixed(1)} ms (timer query unavailable, value is unreliable under command buffer backpressure)`;

        const lines = [
            `[perf] ${this.label}  ${fps.toFixed(1)} fps  |  js frame avg ${avgFrame.toFixed(1)} ms  max ${this.frameMax.toFixed(1)} ms  |  frames > ${LONG_FRAME_MS} ms: ${this.longFrames}/${this.frames}`,
            gpuLine,
            ...sections,
        ];

        if (info) {
            lines.push(
                `draw calls ${info.render.calls}  triangles ${info.render.triangles}  programs ${info.programs?.length ?? 0}  geometries ${info.memory.geometries}  textures ${info.memory.textures}`
            );
        }

        if (memory) {
            lines.push(
                `js heap ${(memory.usedJSHeapSize / 1048576).toFixed(0)} / ${(memory.jsHeapSizeLimit / 1048576).toFixed(0)} mb`
            );
        }

        if (this.worstFrameParts) {
            lines.push(`worst frame ${this.worstFrameMs.toFixed(1)} ms: ${this.worstFrameParts}`);
        }

        console.log(lines.join("\n"));
        this.resetWindow();
    }

    private resetWindow() {
        this.windowSections.clear();
        this.frameSections.clear();
        this.open.length = 0;
        this.windowStart = performance.now();
        this.frames = 0;
        this.frameTotal = 0;
        this.frameMax = 0;
        this.longFrames = 0;
        this.worstFrameMs = 0;
        this.worstFrameParts = "";
    }

    private logContext() {
        const renderer = this.renderer;
        if (!renderer) return;

        const gl = renderer.getContext();
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        const size = renderer.getDrawingBufferSize(new THREE.Vector2());
        const navigatorAny = navigator as any;

        console.log(
            [
                `[perf/context] gpu: ${debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "unknown"}`,
                `vendor: ${debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : "unknown"}`,
                `drawing buffer ${size.x} x ${size.y}  pixelRatio ${renderer.getPixelRatio()}  (${((size.x * size.y) / 1e6).toFixed(2)} mpx per pass)`,
                `shadowMap enabled ${renderer.shadowMap.enabled}  type ${renderer.shadowMap.type}  autoUpdate ${renderer.shadowMap.autoUpdate}`,
                `maxAnisotropy ${renderer.capabilities.getMaxAnisotropy()}  maxTextureSize ${renderer.capabilities.maxTextureSize}  precision ${renderer.capabilities.precision}`,
                `hardwareConcurrency ${navigatorAny.hardwareConcurrency}  deviceMemory ${navigatorAny.deviceMemory ?? "unknown"}`,
            ].join("\n")
        );
    }

    public logSceneReport(label: string, scene: THREE.Scene | null) {
        if (!this.enabled || !scene) return;

        const stats = this.collectSceneStats(scene);
        const lights = Object.entries(stats.lights)
            .map(([type, count]) => `${type} ${count}`)
            .join("  ");

        console.log(
            [
                `[perf/scene] ${label}`,
                `objects ${stats.objects}  meshes ${stats.meshes}  skinned ${stats.skinned}  sprites ${stats.sprites}  triangles ${stats.triangles.toLocaleString()}`,
                `shadow casters ${stats.shadowCasters} (${stats.shadowTriangles.toLocaleString()} triangles re-rendered per shadow pass)`,
                `transparent meshes ${stats.transparentMeshes}  transmissive meshes ${stats.transmissiveMeshes} (each transmissive material forces an extra full scene pass)`,
                `materials ${stats.materials}  textures ${stats.textures} (~${stats.textureMb.toFixed(1)} mb vram, canvas textures ${stats.canvasTextures})`,
                `lights: ${lights}  |  shadow casting lights ${stats.shadowLights}`,
                `heaviest meshes: ${stats.heaviest.map((item) => `${item.name} ${item.triangles.toLocaleString()}`).join("  ")}`,
            ].join("\n")
        );
    }

    private collectSceneStats(scene: THREE.Scene): SceneStats {
        const materials = new Set<THREE.Material>();
        const textures = new Set<THREE.Texture>();
        const lights: Record<string, number> = {};
        const heaviest: { name: string; triangles: number }[] = [];

        const stats: SceneStats = {
            objects: 0,
            meshes: 0,
            skinned: 0,
            sprites: 0,
            triangles: 0,
            shadowCasters: 0,
            shadowTriangles: 0,
            transparentMeshes: 0,
            transmissiveMeshes: 0,
            materials: 0,
            textures: 0,
            textureMb: 0,
            canvasTextures: 0,
            lights,
            shadowLights: 0,
            heaviest,
        };

        scene.traverse((object) => {
            stats.objects++;

            const light = object as THREE.Light;
            if (light.isLight) {
                lights[light.type] = (lights[light.type] ?? 0) + 1;
                if ((light as THREE.DirectionalLight).castShadow) stats.shadowLights++;
                return;
            }

            if ((object as THREE.Sprite).isSprite) {
                stats.sprites++;
                return;
            }

            const mesh = object as THREE.Mesh;
            if (!mesh.isMesh) return;

            stats.meshes++;
            if ((mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh) stats.skinned++;

            const triangles = triangleCount(mesh.geometry);
            stats.triangles += triangles;
            heaviest.push({ name: mesh.name || mesh.material?.constructor?.name || "mesh", triangles });

            if (mesh.castShadow) {
                stats.shadowCasters++;
                stats.shadowTriangles += triangles;
            }

            const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const material of list) {
                if (!material) continue;
                materials.add(material);
                if (material.transparent) stats.transparentMeshes++;
                if (((material as THREE.MeshPhysicalMaterial).transmission ?? 0) > 0) stats.transmissiveMeshes++;

                for (const value of Object.values(material as unknown as Record<string, unknown>)) {
                    const texture = value as THREE.Texture;
                    if (texture && (texture as any).isTexture) textures.add(texture);
                }
            }
        });

        for (const texture of textures) {
            stats.textureMb += textureMegabytes(texture);
            if ((texture as THREE.CanvasTexture).isCanvasTexture) stats.canvasTextures++;
        }

        stats.materials = materials.size;
        stats.textures = textures.size;
        stats.heaviest = heaviest.sort((a, b) => b.triangles - a.triangles).slice(0, 5);

        return stats;
    }

    public startSweep() {
        if (!this.renderer || !this.scene) {
            console.log("[perf/sweep] no active scene");
            return;
        }
        if (this.sweepIndex >= 0) {
            console.log("[perf/sweep] already running");
            return;
        }
        if (!this.enabled) this.enable();

        const scene = this.scene;
        const renderer = this.renderer;
        const basePixelRatio = renderer.getPixelRatio();
        const baseEnvIntensity = scene.environmentIntensity;

        const hidden: THREE.Object3D[] = [];
        const hide = (predicate: (object: THREE.Object3D) => boolean) => {
            hidden.length = 0;
            scene.traverse((object) => {
                if (object.visible && predicate(object)) {
                    object.visible = false;
                    hidden.push(object);
                }
            });
            return [...hidden];
        };
        const restoreList = (list: THREE.Object3D[]) => () => list.forEach((object) => (object.visible = true));

        const hasMaterial = (object: THREE.Object3D, test: (material: THREE.Material) => boolean) => {
            const mesh = object as THREE.Mesh;
            if (!mesh.isMesh) return false;
            const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            return list.some((material) => material != null && test(material));
        };

        const shadowLights: THREE.Light[] = [];
        let skyHidden: THREE.Object3D[] = [];
        let transmissionHidden: THREE.Object3D[] = [];
        let transparentHidden: THREE.Object3D[] = [];
        let pointHidden: THREE.Object3D[] = [];
        let rectHidden: THREE.Object3D[] = [];

        this.sweepSteps = [
            { name: "baseline", apply: () => { }, restore: () => { } },
            {
                name: "no sky + shafts",
                apply: () => {
                    skyHidden = hide((object) => object.name === "hall-sky" || object.name === "light-shafts");
                },
                restore: () => restoreList(skyHidden)(),
            },
            {
                name: "no transmission (crystal)",
                apply: () => {
                    transmissionHidden = hide((object) =>
                        hasMaterial(object, (material) => ((material as THREE.MeshPhysicalMaterial).transmission ?? 0) > 0)
                    );
                },
                restore: () => restoreList(transmissionHidden)(),
            },
            {
                name: "no shadow map",
                apply: () => {
                    renderer.shadowMap.autoUpdate = false;
                    shadowLights.length = 0;
                    scene.traverse((object) => {
                        const light = object as THREE.Light;
                        if (light.isLight && light.castShadow) {
                            light.castShadow = false;
                            shadowLights.push(light);
                        }
                    });
                },
                restore: () => {
                    renderer.shadowMap.autoUpdate = true;
                    shadowLights.forEach((light) => (light.castShadow = true));
                },
            },
            {
                name: "no point lights",
                apply: () => {
                    pointHidden = hide((object) => (object as THREE.PointLight).isPointLight === true);
                },
                restore: () => restoreList(pointHidden)(),
            },
            {
                name: "no rect area lights",
                apply: () => {
                    rectHidden = hide((object) => (object as THREE.RectAreaLight).isRectAreaLight === true);
                },
                restore: () => restoreList(rectHidden)(),
            },
            {
                name: "no transparent meshes",
                apply: () => {
                    transparentHidden = hide((object) => hasMaterial(object, (material) => material.transparent));
                },
                restore: () => restoreList(transparentHidden)(),
            },
            {
                name: "no environment map",
                apply: () => {
                    scene.environmentIntensity = 0;
                },
                restore: () => {
                    scene.environmentIntensity = baseEnvIntensity;
                },
            },
            {
                name: "half resolution",
                apply: () => {
                    const size = renderer.getSize(new THREE.Vector2());
                    renderer.setPixelRatio(basePixelRatio * 0.5);
                    renderer.setSize(size.x, size.y, false);
                },
                restore: () => {
                    const size = renderer.getSize(new THREE.Vector2());
                    renderer.setPixelRatio(basePixelRatio);
                    renderer.setSize(size.x, size.y, false);
                },
            },
        ];

        this.sweepResults = [];
        this.sweepIndex = 0;
        this.sweepFrames = 0;
        this.sweepSamples = [];
        this.sweepSteps[0].apply();

        console.log(
            `[perf/sweep] running ${this.sweepSteps.length} experiments x ${SWEEP_WARMUP_FRAMES + SWEEP_SAMPLE_FRAMES} frames — stand still until the result table appears`
        );
    }

    private advanceSweep(frameMs: number) {
        if (this.sweepIndex < 0) return;

        this.sweepFrames++;
        if (this.sweepFrames > SWEEP_WARMUP_FRAMES) this.sweepSamples.push(frameMs);
        if (this.sweepSamples.length < SWEEP_SAMPLE_FRAMES) return;

        const step = this.sweepSteps[this.sweepIndex];
        this.sweepResults.push({ name: step.name, ms: median(this.sweepSamples) });
        step.restore();

        this.sweepIndex++;
        this.sweepFrames = 0;
        this.sweepSamples = [];

        if (this.sweepIndex < this.sweepSteps.length) {
            this.sweepSteps[this.sweepIndex].apply();
            return;
        }

        this.sweepIndex = -1;
        this.sweepSteps = [];

        const baseline = this.sweepResults[0]?.ms ?? 0;
        const rows = this.sweepResults
            .slice(1)
            .map((result) => ({ name: result.name, ms: result.ms, saved: baseline - result.ms }))
            .sort((a, b) => b.saved - a.saved)
            .map(
                (row) =>
                    `${ms(row.ms)} ms  saved ${ms(row.saved)} ms  (${((row.saved / Math.max(baseline, 0.001)) * 100).toFixed(0)}%)  ${row.name}`
            );

        console.log(
            [
                `[perf/sweep] median frame time per experiment (bigger saving = bigger culprit)`,
                `${ms(baseline)} ms  baseline`,
                ...rows,
            ].join("\n")
        );
    }

    public getGpuTimeMs(): number | null {
        return this.timerExt ? this.gpuTimeMs : null;
    }

    public getMemoryInfo(): { geometries: number; textures: number; heapMb: number | null } | null {
        const info = this.renderer?.info;
        if (!info) return null;
        const memory = (performance as any).memory;
        return {
            geometries: info.memory.geometries,
            textures: info.memory.textures,
            heapMb: memory ? Math.round(memory.usedJSHeapSize / 1048576) : null,
        };
    }

    public getContextInfo(): {
        renderer: string;
        vendor: string;
        webgl2: boolean;
        bufferWidth: number;
        bufferHeight: number;
        cssWidth: number;
        cssHeight: number;
        pixelRatio: number;
        software: boolean;
    } | null {
        if (!this.renderer) return null;

        const gl = this.renderer.getContext();
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        const rendererName = debugInfo
            ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? "")
            : "";
        const vendorName = debugInfo
            ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) ?? "")
            : "";

        const canvas = this.renderer.domElement;
        const lowered = rendererName.toLowerCase();

        return {
            renderer: rendererName || "unknown",
            vendor: vendorName || "unknown",
            webgl2: this.renderer.capabilities.isWebGL2,
            bufferWidth: canvas.width,
            bufferHeight: canvas.height,
            cssWidth: canvas.clientWidth,
            cssHeight: canvas.clientHeight,
            pixelRatio: this.renderer.getPixelRatio(),
            software: lowered.includes("swiftshader") || lowered.includes("llvmpipe") || lowered.includes("software"),
        };
    }
    public toggleNames(): string[] {
        return Array.from(this.toggles.keys());
    }

    public getRenderInfo(): { calls: number; triangles: number; programs: number } | null {
        const info = this.renderer?.info;
        if (!info) return null;
        return {
            calls: info.render.calls,
            triangles: info.render.triangles,
            programs: info.programs?.length ?? 0,
        };
    }

    public logCurrentScene() {
        this.logSceneReport(this.label, this.scene);
    }
    public registerToggle(name: string, apply: (value: boolean | number) => void) {
        this.toggles.set(name, apply);
    }

    public set(name: string, value: boolean | number) {
        const toggle = this.toggles.get(name);
        if (!toggle) {
            console.log(`[perf] unknown toggle "${name}" — available: ${Array.from(this.toggles.keys()).join(", ")}`);
            return;
        }
        toggle(value);
        console.log(`[perf] ${name} = ${value}`);
    }

    private forEachMaterial(fn: (material: THREE.Material) => void) {
        this.scene?.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (!mesh.isMesh) return;
            const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const material of list) if (material) fn(material);
        });
    }

    private registerBuiltInToggles() {
        this.registerToggle("shadows", (value) => {
            if (!this.renderer) return;
            this.renderer.shadowMap.enabled = Boolean(value);
            this.forEachMaterial((material) => {
                material.needsUpdate = true;
            });
        });

        this.registerToggle("shadowAuto", (value) => {
            if (!this.renderer) return;
            this.renderer.shadowMap.autoUpdate = Boolean(value);
            this.renderer.shadowMap.needsUpdate = true;
        });

        this.registerToggle("pointLights", (value) => {
            this.scene?.traverse((object) => {
                if ((object as THREE.PointLight).isPointLight) object.visible = Boolean(value);
            });
        });

        this.registerToggle("points", (value) => {
            this.scene?.traverse((object) => {
                if ((object as THREE.Points).isPoints) object.visible = Boolean(value);
            });
        });

        this.registerToggle("sprites", (value) => {
            this.scene?.traverse((object) => {
                if ((object as THREE.Sprite).isSprite) object.visible = Boolean(value);
            });
        });

        this.registerToggle("skinned", (value) => {
            this.scene?.traverse((object) => {
                if ((object as THREE.SkinnedMesh).isSkinnedMesh) object.visible = Boolean(value);
            });
        });

        this.registerToggle("instanced", (value) => {
            this.scene?.traverse((object) => {
                if ((object as THREE.InstancedMesh).isInstancedMesh) object.visible = Boolean(value);
            });
        });

        this.registerToggle("fog", (value) => {
            if (!this.scene) return;
            if (value) {
                if (this.savedFog) this.scene.fog = this.savedFog;
                return;
            }
            if (this.scene.fog) this.savedFog = this.scene.fog;
            this.scene.fog = null;
        });

        this.registerToggle("toneMapping", (value) => {
            if (!this.renderer) return;
            this.renderer.toneMapping = value ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
            this.forEachMaterial((material) => {
                material.needsUpdate = true;
            });
        });

        this.registerToggle("castShadows", (value) => {
            this.scene?.traverse((object) => {
                const mesh = object as THREE.Mesh;
                if (!mesh.isMesh) return;
                if (!value) {
                    if (mesh.castShadow) this.shadowCasterCache.add(mesh);
                    mesh.castShadow = false;
                } else if (this.shadowCasterCache.has(mesh)) {
                    mesh.castShadow = true;
                }
            });
            if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
        });

        this.registerToggle("shadowRes", (value) => {
            const size = Math.max(128, Math.round(Number(value) || 1024));
            this.scene?.traverse((object) => {
                const light = object as THREE.DirectionalLight;
                if (!light.isLight || !light.shadow) return;
                light.shadow.mapSize.set(size, size);
                light.shadow.map?.dispose();
                (light.shadow as any).map = null;
            });
            if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
        });

        this.registerToggle("grassDensity", (value) => {
            const scale = typeof value === "number" ? value : Number(Boolean(value));
            this.forEachMaterial((material) => {
                const uniforms = (material as THREE.ShaderMaterial).uniforms;
                if (uniforms?.uDensityScale) uniforms.uDensityScale.value = scale;
            });
        });

        this.registerToggle("lightsExceptFirst", (value) => {
            let seen = 0;
            this.scene?.traverse((object) => {
                const light = object as THREE.Light;
                if (!light.isLight) return;
                if ((light as THREE.AmbientLight).isAmbientLight) return;
                seen++;
                if (seen > 1) object.visible = Boolean(value);
            });
        });

        this.registerToggle("rectLights", (value) => {
            this.scene?.traverse((object) => {
                if ((object as THREE.RectAreaLight).isRectAreaLight) object.visible = Boolean(value);
            });
        });

        this.registerToggle("transparent", (value) => {
            this.scene?.traverse((object) => {
                const mesh = object as THREE.Mesh;
                if (!mesh.isMesh) return;
                const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                if (list.some((material) => material?.transparent)) mesh.visible = Boolean(value);
            });
        });

        this.registerToggle("transmission", (value) => {
            this.scene?.traverse((object) => {
                const mesh = object as THREE.Mesh;
                if (!mesh.isMesh) return;
                const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                if (list.some((material) => ((material as THREE.MeshPhysicalMaterial)?.transmission ?? 0) > 0)) {
                    mesh.visible = Boolean(value);
                }
            });
        });

        this.registerToggle("sky", (value) => {
            this.scene?.traverse((object) => {
                if (object.name === "hall-sky" || object.name === "light-shafts") object.visible = Boolean(value);
            });
        });

        this.registerToggle("environment", (value) => {
            if (!this.scene) return;
            this.scene.environmentIntensity = Number(value);
        });

        this.registerToggle("pixelRatio", (value) => {
            if (!this.renderer) return;
            const size = this.renderer.getSize(new THREE.Vector2());
            this.renderer.setPixelRatio(Number(value));
            this.renderer.setSize(size.x, size.y, false);
        });
    }
}

export const perf = new PerfProfiler();
