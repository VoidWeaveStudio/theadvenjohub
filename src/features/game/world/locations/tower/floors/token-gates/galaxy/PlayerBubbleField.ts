// src/features/game/world/locations/tower/floors/token-gates/galaxy/PlayerBubbleField.ts
import * as THREE from "three";
import { GALAXY, ORBIT_OMEGA, playerBubbleOrbit, orbitPosition, findNearbyPlayerBubbles } from "./GalaxyLayout";

const MAX_BUBBLES = 60000;
const NEAR_POOL_SIZE = 20;
const NEAR_RANGE = 58;
const FADE_START = 22;
const FADE_END = 55;

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uOmega;
uniform float uViewportHeight;
uniform float uBubbleRadius;
uniform float uOwnIndex;
uniform float uWaypointIndex;
uniform float uFadeStart;
uniform float uFadeEnd;

attribute float aRadius;
attribute float aPhase;
attribute float aY;
attribute float aSeed;
attribute float aIndex;

varying vec3 vTint;
varying float vHighlight;
varying float vWaypoint;
varying float vNearFade;

vec3 bubbleTint(float seed) {
    vec3 cool = vec3(0.35, 0.75, 1.0);
    vec3 violet = vec3(0.62, 0.45, 1.0);
    vec3 mint = vec3(0.45, 1.0, 0.85);
    vec3 base = mix(cool, violet, smoothstep(0.0, 0.55, seed));
    return mix(base, mint, smoothstep(0.72, 1.0, seed));
}

void main() {
    float angle = aPhase + uOmega * uTime;
    vec3 orbit = vec3(cos(angle) * aRadius, aY, sin(angle) * aRadius);

    vec4 mvPosition = modelViewMatrix * vec4(orbit, 1.0);
    float dist = max(-mvPosition.z, 1.0);

    vHighlight = step(0.5, 1.0 - abs(aIndex - uOwnIndex));
    vWaypoint = step(0.5, 1.0 - abs(aIndex - uWaypointIndex));
    vec3 tinted = mix(bubbleTint(aSeed), vec3(1.0, 0.84, 0.42), vHighlight);
    vTint = mix(tinted, vec3(0.5, 1.0, 0.62), vWaypoint);
    vNearFade = smoothstep(uFadeStart, uFadeEnd, distance(orbit, cameraPosition));

    float marked = max(vHighlight, vWaypoint);
    float projected = uViewportHeight * projectionMatrix[1][1] * uBubbleRadius * (1.0 + marked * 0.35) / dist;
    gl_PointSize = clamp(projected, 1.5, 900.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vTint;
varying float vHighlight;
varying float vWaypoint;
varying float vNearFade;

void main() {
    if (vNearFade <= 0.001) discard;

    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;

    float core = smoothstep(0.5, 0.12, d);
    float rim = smoothstep(0.5, 0.42, d) * (1.0 - smoothstep(0.42, 0.28, d));
    float sheen = pow(max(0.0, 1.0 - length(uv - vec2(-0.13, 0.15)) * 3.2), 3.0);

    float alpha = core * 0.42 + rim * 0.85 + sheen * 0.5;
    alpha = clamp(alpha, 0.0, 1.0) * (0.75 + max(vHighlight, vWaypoint) * 0.25) * vNearFade;

    vec3 color = vTint * (0.55 + rim * 1.1 + sheen * 0.9);
    gl_FragColor = vec4(color, alpha);
}
`;

const nearVertexShader = /* glsl */ `
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const nearFragmentShader = /* glsl */ `
uniform vec3 uTint;
uniform float uOpacity;
uniform float uTime;
varying vec3 vNormalView;
varying vec3 vViewDir;

void main() {
    float facing = clamp(dot(normalize(vNormalView), normalize(vViewDir)), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 2.4);
    float shimmer = 0.5 + 0.5 * sin(uTime * 1.6 + vNormalView.y * 6.0 + vNormalView.x * 4.0);

    vec3 color = uTint * (0.35 + fresnel * 1.5) + vec3(0.25, 0.4, 0.55) * shimmer * fresnel;
    float alpha = (0.10 + fresnel * 0.85) * uOpacity;
    gl_FragColor = vec4(color, alpha);
}
`;

export interface NearBubbleHandle {
    object: THREE.Object3D;
    index: number;
}

export class PlayerBubbleField {
    private points: THREE.Points | null = null;
    private uniforms = {
        uTime: { value: 0 },
        uOmega: { value: ORBIT_OMEGA },
        uViewportHeight: { value: 800 },
        uBubbleRadius: { value: GALAXY.playerBubbleRadius },
        uOwnIndex: { value: -1 },
        uWaypointIndex: { value: -1 },
        uFadeStart: { value: FADE_START },
        uFadeEnd: { value: FADE_END },
    };
    private count = 0;

    private contacts: Array<{ position: THREE.Vector3; radius: number; orbit: boolean }> = [];
    private waypointIndex: number | null = null;
    private beacon: THREE.Mesh | null = null;
    private nearPool: THREE.Mesh[] = [];
    private nearHandles: NearBubbleHandle[] = [];
    private nearGeometry: THREE.SphereGeometry;

    private static readonly _tint = new THREE.Color();
    private static readonly _scratch = { x: 0, y: 0, z: 0 };

    constructor(private scene: THREE.Object3D) {
        this.nearGeometry = new THREE.SphereGeometry(GALAXY.playerBubbleRadius, 32, 24);
        this.buildNearPool();
        this.buildBeacon();
    }

    private buildBeacon() {
        const height = GALAXY.diskThickness * 14;
        const beacon = new THREE.Mesh(
            new THREE.CylinderGeometry(GALAXY.playerBubbleRadius * 0.5, GALAXY.playerBubbleRadius * 0.5, height, 12, 1, true),
            new THREE.MeshBasicMaterial({
                color: 0x7bff9e,
                transparent: true,
                opacity: 0.18,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
                fog: false,
            })
        );
        beacon.visible = false;
        beacon.frustumCulled = false;
        this.scene.add(beacon);
        this.beacon = beacon;
    }

    private buildNearPool() {
        for (let i = 0; i < NEAR_POOL_SIZE; i++) {
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    uTint: { value: new THREE.Color(0x66ccff) },
                    uOpacity: { value: 0 },
                    uTime: { value: 0 },
                },
                vertexShader: nearVertexShader,
                fragmentShader: nearFragmentShader,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                fog: false,
            });

            const mesh = new THREE.Mesh(this.nearGeometry, material);
            mesh.visible = false;
            mesh.frustumCulled = false;
            mesh.userData.interactionRadius = GALAXY.playerBubbleRadius * 1.6;
            this.scene.add(mesh);

            this.nearPool.push(mesh);
            this.nearHandles.push({ object: mesh, index: -1 });
        }
    }

    public getNearContacts(): Array<{ position: THREE.Vector3; radius: number; orbit: boolean }> {
        this.contacts.length = 0;
        for (const mesh of this.nearPool) {
            if (!mesh.visible) continue;
            this.contacts.push({ position: mesh.position, radius: GALAXY.playerBubbleRadius, orbit: true });
        }
        return this.contacts;
    }

    public getNearHandles(): NearBubbleHandle[] {
        return this.nearHandles;
    }

    public getInteractables(): THREE.Object3D[] {
        return this.nearPool;
    }

    public setViewportHeight(height: number) {
        this.uniforms.uViewportHeight.value = height * 0.5;
    }

    public setOwnIndex(index: number | null) {
        this.uniforms.uOwnIndex.value = index ?? -1;
    }

    public setWaypointIndex(index: number | null) {
        this.uniforms.uWaypointIndex.value = index ?? -1;
        this.waypointIndex = index;
        if (this.beacon) this.beacon.visible = index !== null;
    }

    public getCount(): number {
        return this.count;
    }

    public setCount(count: number) {
        const clamped = Math.max(0, Math.min(MAX_BUBBLES, Math.floor(count)));
        if (clamped === this.count && this.points) return;

        this.destroyPoints();
        this.count = clamped;
        if (clamped === 0) return;

        const positions = new Float32Array(clamped * 3);
        const radii = new Float32Array(clamped);
        const phases = new Float32Array(clamped);
        const ys = new Float32Array(clamped);
        const seeds = new Float32Array(clamped);
        const indices = new Float32Array(clamped);

        for (let i = 0; i < clamped; i++) {
            const orbit = playerBubbleOrbit(i);
            radii[i] = orbit.radius;
            phases[i] = orbit.phase;
            ys[i] = orbit.y;
            seeds[i] = orbit.seed;
            indices[i] = i;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
        geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
        geometry.setAttribute("aY", new THREE.BufferAttribute(ys, 1));
        geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
        geometry.setAttribute("aIndex", new THREE.BufferAttribute(indices, 1));
        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), GALAXY.maxRadius);

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false,
        });

        this.points = new THREE.Points(geometry, material);
        this.points.frustumCulled = false;
        this.points.renderOrder = -5;
        this.scene.add(this.points);
    }

    update(orbitTime: number, viewerPosition: THREE.Vector3) {
        this.uniforms.uTime.value = orbitTime;
        this.syncNearBubbles(orbitTime, viewerPosition);
        this.syncBeacon(orbitTime);
    }

    private syncBeacon(orbitTime: number) {
        if (!this.beacon) return;
        if (this.waypointIndex === null || this.waypointIndex >= this.count) {
            this.beacon.visible = false;
            return;
        }
        orbitPosition(playerBubbleOrbit(this.waypointIndex), orbitTime, PlayerBubbleField._scratch);
        this.beacon.position.set(
            PlayerBubbleField._scratch.x,
            PlayerBubbleField._scratch.y,
            PlayerBubbleField._scratch.z
        );
        this.beacon.visible = true;
    }

    private syncNearBubbles(orbitTime: number, viewerPosition: THREE.Vector3) {
        const nearby = findNearbyPlayerBubbles(viewerPosition, NEAR_RANGE, this.count, orbitTime, NEAR_POOL_SIZE);

        for (let i = 0; i < NEAR_POOL_SIZE; i++) {
            const mesh = this.nearPool[i];
            const handle = this.nearHandles[i];
            const entry = nearby[i];

            if (!entry) {
                mesh.visible = false;
                mesh.userData.interactionId = undefined;
                mesh.position.set(0, -1e6, 0);
                handle.index = -1;
                continue;
            }

            const seed = playerBubbleOrbit(entry.index).seed;
            PlayerBubbleField._tint.setHSL(0.52 + seed * 0.22, 0.75, 0.6);

            const material = mesh.material as THREE.ShaderMaterial;
            material.uniforms.uTime.value = orbitTime;
            (material.uniforms.uTint.value as THREE.Color).copy(PlayerBubbleField._tint);
            material.uniforms.uOpacity.value = 1 - THREE.MathUtils.smoothstep(entry.distance, FADE_START, FADE_END);

            mesh.position.set(entry.x, entry.y, entry.z);
            mesh.visible = material.uniforms.uOpacity.value > 0.01;
            mesh.userData.interactionId = `player-bubble-${entry.index}`;
            handle.index = entry.index;
        }
    }

    private destroyPoints() {
        if (!this.points) return;
        this.points.geometry.dispose();
        (this.points.material as THREE.Material).dispose();
        this.scene.remove(this.points);
        this.points = null;
    }

    dispose() {
        this.destroyPoints();
        this.count = 0;

        this.nearPool.forEach((mesh) => {
            (mesh.material as THREE.Material).dispose();
            this.scene.remove(mesh);
        });
        this.nearGeometry.dispose();
        this.nearPool = [];
        this.nearHandles = [];

        if (this.beacon) {
            this.beacon.geometry.dispose();
            (this.beacon.material as THREE.Material).dispose();
            this.scene.remove(this.beacon);
            this.beacon = null;
        }
    }
}
