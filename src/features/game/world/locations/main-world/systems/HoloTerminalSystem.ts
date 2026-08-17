// src/features/game/world/locations/main-world/systems/HoloTerminalSystem.ts
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { WorldStatusData } from "../../../../network/NetworkManager";
import type { TerrainSystem } from "./TerrainSystem";

const TERMINAL_X = 0;
const TERMINAL_Z = 9;

const PANEL_WIDTH = 2.4;
const PANEL_HEIGHT = 1.8;
const PANEL_RADIUS = 1.4;
const PANEL_CENTER_Y = 2.6;
const PEDESTAL_HEIGHT = 1.6;
const PEDESTAL_RADIUS = 0.86;

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 768;
const CANVAS_SCALE = 2;
const PADDING = 48;

const ACCENT = "#b8f2ff";
const DIM = "#7fc4da";
const WARN = "#ffb454";
const GOOD = "#7dffb0";

const UNLOCK_LABELS: Record<string, string> = {
    lakes: "THE LAKES",
    rift: "THE RIFT",
    port: "THE PORT",
    tower: "THE TOWER",
};

const UNLOCK_NOTES: Record<string, string> = {
    lakes: "FISHING",
    rift: "CAVE ACCESS",
    port: "HARBOR",
    tower: "OUTER GATE",
};

const holoVertexShader = /* glsl */`
    varying vec2 vHoloUv;
    varying vec3 vHoloView;
    varying vec3 vHoloNormal;

    void main() {
        vHoloUv = uv;
        vHoloNormal = normalMatrix * normal;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vHoloView = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
    }
`;

const holoFragmentShader = /* glsl */`
    uniform sampler2D uPanel;
    uniform float uTime;
    uniform vec3 uTint;

    varying vec2 vHoloUv;
    varying vec3 vHoloView;
    varying vec3 vHoloNormal;

    float hash(float value) {
        return fract(sin(value * 91.3458) * 47453.5453);
    }

    void main() {
        vec2 uv = vHoloUv;

        float band = step(0.995, hash(floor(uTime * 7.0) + floor(uv.y * 14.0)));
        uv.x += band * 0.006;

        vec4 panel = texture2D(uPanel, uv);

        float scan = 0.82 + 0.18 * sin((uv.y + uTime * 0.06) * 900.0);
        float sweep = smoothstep(0.0, 0.08, abs(fract(uv.y - uTime * 0.12) - 0.5)) * 0.15 + 0.85;
        float flicker = 0.94 + 0.06 * sin(uTime * 31.0) * sin(uTime * 7.3);

        float edgeX = smoothstep(0.0, 0.012, uv.x) * smoothstep(1.0, 0.988, uv.x);
        float edgeY = smoothstep(0.0, 0.016, uv.y) * smoothstep(1.0, 0.984, uv.y);
        float frame = (1.0 - edgeX * edgeY) * 0.55;

        float grid = step(0.985, fract(uv.x * 42.0)) + step(0.985, fract(uv.y * 32.0));
        float haze = 0.045 + grid * 0.03;

        float facing = abs(dot(normalize(vHoloNormal), normalize(-vHoloView)));
        facing = clamp(0.2 + facing * 0.9, 0.0, 1.0);

        vec3 color = uTint * (panel.rgb * 1.15 + haze + frame);
        float alpha = (panel.a * 0.92 + haze + frame) * scan * sweep * flicker * facing;

        if (alpha <= 0.004) discard;
        gl_FragColor = vec4(color, alpha);
    }
`;

function formatUsd(value: number): string {
    return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatCountdown(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export class HoloTerminalSystem {
    public readonly position = new THREE.Vector3();

    private group: THREE.Group | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private texture: THREE.CanvasTexture | null = null;
    private material: THREE.ShaderMaterial | null = null;
    private light: THREE.PointLight | null = null;

    private status: WorldStatusData | null = null;
    private renderedKey = "";
    private time = 0;

    private readonly uniforms = {
        uPanel: { value: null as THREE.Texture | null },
        uTime: { value: 0 },
        uTint: { value: new THREE.Color(0x8ceaff) },
    };

    constructor(
        private readonly scene: THREE.Scene,
        private readonly terrain: TerrainSystem
    ) { }

    public create() {
        const groundY = this.terrain.getHeightAt(TERMINAL_X, TERMINAL_Z);
        this.position.set(TERMINAL_X, groundY, TERMINAL_Z);

        const group = new THREE.Group();
        group.position.copy(this.position);

        this.canvas = document.createElement("canvas");
        this.canvas.width = CANVAS_WIDTH * CANVAS_SCALE;
        this.canvas.height = CANVAS_HEIGHT * CANVAS_SCALE;
        this.ctx = this.canvas.getContext("2d");
        this.ctx?.scale(CANVAS_SCALE, CANVAS_SCALE);

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.anisotropy = 8;
        this.texture.minFilter = THREE.LinearMipmapLinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.generateMipmaps = true;
        this.uniforms.uPanel.value = this.texture;

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: holoVertexShader,
            fragmentShader: holoFragmentShader,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            fog: false,
            toneMapped: false,
        });

        const faces: THREE.BufferGeometry[] = [];
        for (let i = 0; i < 3; i++) {
            const angle = (i * Math.PI * 2) / 3;
            const face = new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT);
            face.rotateY(angle);
            face.translate(Math.sin(angle) * PANEL_RADIUS, PANEL_CENTER_Y, Math.cos(angle) * PANEL_RADIUS);
            faces.push(face);
        }

        const screen = new THREE.Mesh(mergeGeometries(faces, false)!, this.material);
        faces.forEach((face) => face.dispose());
        screen.renderOrder = 5;
        group.add(screen);

        group.add(this.buildPedestal());

        this.light = new THREE.PointLight(0x5fd8ff, 2.4, 18, 2);
        this.light.position.set(0, PANEL_CENTER_Y - 0.4, 0);
        this.light.castShadow = false;
        group.add(this.light);

        this.scene.add(group);
        this.group = group;

        this.draw();
    }

    private buildPedestal(): THREE.Mesh {
        const stone = new THREE.MeshStandardMaterial({
            color: 0x3a4650,
            roughness: 0.62,
            metalness: 0.35,
            flatShading: true,
        });

        const parts: THREE.BufferGeometry[] = [];

        const base = new THREE.CylinderGeometry(PEDESTAL_RADIUS, PEDESTAL_RADIUS * 1.24, 0.42, 6);
        base.translate(0, 0.21, 0);
        parts.push(base);

        const column = new THREE.CylinderGeometry(PEDESTAL_RADIUS * 0.52, PEDESTAL_RADIUS * 0.74, PEDESTAL_HEIGHT - 0.6, 6);
        column.translate(0, 0.42 + (PEDESTAL_HEIGHT - 0.6) / 2, 0);
        parts.push(column);

        const emitter = new THREE.CylinderGeometry(PEDESTAL_RADIUS * 0.94, PEDESTAL_RADIUS * 0.6, 0.22, 6);
        emitter.translate(0, PEDESTAL_HEIGHT - 0.07, 0);
        parts.push(emitter);

        const merged = mergeGeometries(parts, false)!;
        parts.forEach((part) => part.dispose());
        merged.computeVertexNormals();

        const mesh = new THREE.Mesh(merged, stone);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        return mesh;
    }

    public setStatus(status: WorldStatusData | null) {
        this.status = status;
        this.draw();
    }

    private statusKey(): string {
        const status = this.status;
        if (!status) return "empty";

        const cooldown = status.portal.status === "cooldown"
            ? Math.floor(Math.max(0, status.portal.cooldownUntil - Date.now()) / 1000)
            : 0;

        return [
            Math.round(status.mc),
            status.tier,
            status.portal.status,
            cooldown,
            status.monster.status,
            status.traders,
            status.unlocks.map((entry) => (entry.unlocked ? 1 : 0)).join(""),
        ].join("|");
    }

    private portalLine(): { text: string; color: string } {
        const status = this.status;
        if (!status) return { text: "OFFLINE", color: DIM };

        const rift = status.unlocks.find((entry) => entry.id === "rift");

        if (status.portal.status === "active") {
            return { text: "ACTIVE", color: GOOD };
        }

        if (status.portal.status === "cooldown") {
            return { text: formatCountdown(status.portal.cooldownUntil - Date.now()), color: WARN };
        }

        return { text: rift ? formatUsd(rift.mc) : "LOCKED", color: DIM };
    }

    private draw() {
        const ctx = this.ctx;
        if (!ctx || !this.texture) return;

        const key = this.statusKey();
        if (key === this.renderedKey) return;
        this.renderedKey = key;

        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.textBaseline = "alphabetic";

        const status = this.status;
        const right = CANVAS_WIDTH - PADDING;

        const divider = (y: number) => {
            ctx.fillStyle = "rgba(140, 234, 255, 0.28)";
            ctx.fillRect(PADDING, y, CANVAS_WIDTH - PADDING * 2, 2);
        };

        const label = (text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "left") => {
            ctx.font = `bold ${size}px Oxanium, Arial, sans-serif`;
            ctx.textAlign = align;

            ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
            ctx.shadowBlur = Math.max(4, size * 0.18);
            ctx.fillStyle = "rgba(4, 12, 18, 0.9)";
            ctx.fillText(text, x, y);

            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";
            ctx.fillStyle = color;
            ctx.fillText(text, x, y);
        };

        label("TANJO WORLD", PADDING, 62, 34, ACCENT);
        label("STATUS", right, 62, 26, DIM, "right");
        divider(80);

        if (!status) {
            label("AWAITING SIGNAL", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 44, DIM, "center");
            this.texture.needsUpdate = true;
            return;
        }

        const hasMarketCap = Number.isFinite(status.mc) && status.mc > 0;
        label("MARKET CAP", PADDING, 138, 24, DIM);
        label(hasMarketCap ? formatUsd(status.mc) : "NO FEED", PADDING, 208, 72, hasMarketCap ? ACCENT : WARN);

        const barY = 232;
        const barWidth = CANVAS_WIDTH - PADDING * 2;
        ctx.fillStyle = "rgba(140, 234, 255, 0.16)";
        ctx.fillRect(PADDING, barY, barWidth, 12);

        if (status.nextTierMc !== null) {
            const span = Math.max(1, status.nextTierMc - status.tierMc);
            const progress = Math.max(0, Math.min(1, (status.mc - status.tierMc) / span));
            ctx.fillStyle = ACCENT;
            ctx.fillRect(PADDING, barY, barWidth * progress, 12);
            label(`NEXT ${formatUsd(status.nextTierMc)}`, right, barY + 44, 24, DIM, "right");
        } else {
            ctx.fillStyle = GOOD;
            ctx.fillRect(PADDING, barY, barWidth, 12);
            label("MAX", right, barY + 44, 24, GOOD, "right");
        }

        const rampart = status.radius === null
            ? "RAMPART   FALLEN"
            : `RAMPART   TIER ${status.tier} / ${status.maxTier}   ·   R ${status.radius}M`;
        label(rampart, PADDING, 322, 28, status.radius === null ? GOOD : ACCENT);
        divider(344);

        label("UNLOCKS", PADDING, 388, 22, DIM);

        let rowY = 432;
        for (const entry of status.unlocks) {
            const name = UNLOCK_LABELS[entry.id] ?? entry.id.toUpperCase();
            const note = UNLOCK_NOTES[entry.id] ?? "";

            if (entry.id === "rift") {
                const line = this.portalLine();
                label(name, PADDING, rowY, 28, entry.unlocked ? ACCENT : DIM);
                label(note, PADDING + 232, rowY, 20, "rgba(61, 143, 168, 0.75)");
                label(line.text, right, rowY, 26, line.color, "right");
            } else {
                label(name, PADDING, rowY, 28, entry.unlocked ? ACCENT : DIM);
                label(note, PADDING + 232, rowY, 20, "rgba(61, 143, 168, 0.75)");
                label(
                    entry.unlocked ? "OPEN" : formatUsd(entry.mc),
                    right,
                    rowY,
                    26,
                    entry.unlocked ? GOOD : DIM,
                    "right"
                );
            }

            rowY += 46;
        }

        divider(rowY - 16);

        label("THREAT", PADDING, rowY + 30, 22, DIM);
        label(status.monster.id.toUpperCase(), PADDING, rowY + 74, 28, WARN);
        label(
            status.monster.status.toUpperCase(),
            right,
            rowY + 74,
            26,
            status.monster.status === "dormant" ? DIM : WARN,
            "right"
        );

        label("TRADERS ONLINE", PADDING, CANVAS_HEIGHT - 32, 24, DIM);
        label(String(status.traders), right, CANVAS_HEIGHT - 32, 30, ACCENT, "right");

        this.texture.needsUpdate = true;
    }

    public update(delta: number) {
        this.time += delta;
        this.uniforms.uTime.value = this.time;

        if (this.light) {
            this.light.intensity = 2.1 + Math.sin(this.time * 3.4) * 0.35;
        }

        if (this.status?.portal.status === "cooldown") {
            this.draw();
        }
    }

    public dispose() {
        if (this.group) {
            this.scene.remove(this.group);
            this.group.traverse((object) => {
                const mesh = object as THREE.Mesh;
                if (!mesh.isMesh) return;
                mesh.geometry.dispose();
                const material = mesh.material;
                if (Array.isArray(material)) material.forEach((item) => item.dispose());
                else material?.dispose();
            });
            this.group = null;
        }

        this.texture?.dispose();
        this.texture = null;
        this.material = null;
        this.light = null;
        this.canvas = null;
        this.ctx = null;
        this.renderedKey = "";
    }
}
