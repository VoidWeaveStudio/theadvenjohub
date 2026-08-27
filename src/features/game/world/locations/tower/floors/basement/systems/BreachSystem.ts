// src/features/game/world/locations/tower/floors/basement/systems/BreachSystem.ts
import * as THREE from "three";
import { PORTAL_NOISE_GLSL, getPortalNoiseTexture } from "../../../../../portalNoise";
import type { InfluenceStateData } from "../../../../../../network/NetworkManager";

export const BREACH_INTERACTION = "influence-breach";

const BREACH_RADIUS = 7.5;
const BREACH_INTERACT_RADIUS = 12;
const SHARD_COUNT = 14;
const BEAM_HEIGHT = 900;
const BEAM_RADIUS = 3.4;
const MARKER_NEAR = 60;
const MARKER_FAR = 1400;

const breachVertexShader = /* glsl */`
    varying vec2 vBreachUv;

    void main() {
        vBreachUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const breachFragmentShader = /* glsl */`
    uniform float uTime;
    uniform vec3 uCore;
    uniform vec3 uEdge;
    uniform vec3 uSpark;
    uniform float uCharge;

    varying vec2 vBreachUv;

    ${PORTAL_NOISE_GLSL}

    void main() {
        vec2 centered = vBreachUv - 0.5;
        float radius = length(centered) * 2.0;
        if (radius > 1.0) discard;

        float angle = atan(centered.y, centered.x);
        float tear = abs(centered.y) * 3.4 - fbm(vec2(centered.x * 4.0, uTime * 0.09)) * 1.5;

        float lip = smoothstep(0.55, 0.0, tear);
        if (lip < 0.02) discard;

        float churn = fbm2(vec2(centered.x * 5.0 - uTime * 0.13, centered.y * 9.0 + uTime * 0.07));
        float filaments = pow(churn, 3.0) * 2.6;
        float depth = smoothstep(0.0, 0.9, lip * (0.6 + churn * 0.7));

        float rim = smoothstep(0.32, 0.62, lip) * (1.0 - smoothstep(0.62, 0.95, lip));

        vec3 color = mix(uEdge, uCore, depth);
        color += uSpark * filaments * lip;
        color += uSpark * rim * 1.8;
        color *= 0.55 + uCharge * 0.75;

        float alpha = clamp(depth * 0.86 + rim * 0.9 + filaments * 0.35, 0.0, 1.0) * lip;
        gl_FragColor = vec4(color, alpha);
    }
`;

function createMarkerTexture(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "rgba(199,155,255,0.95)";
    ctx.lineWidth = 7;

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.34, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(size / 2, size * 0.06);
    ctx.lineTo(size / 2, size * 0.24);
    ctx.moveTo(size / 2, size * 0.76);
    ctx.lineTo(size / 2, size * 0.94);
    ctx.moveTo(size * 0.06, size / 2);
    ctx.lineTo(size * 0.24, size / 2);
    ctx.moveTo(size * 0.76, size / 2);
    ctx.lineTo(size * 0.94, size / 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.08, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

export class BreachSystem {
    public readonly group: THREE.Group;

    private readonly sheet: THREE.Mesh;
    private readonly material: THREE.ShaderMaterial;
    private readonly halo: THREE.PointLight;
    private readonly beam: THREE.Mesh;
    private readonly beamMaterial: THREE.MeshBasicMaterial;
    private readonly marker: THREE.Sprite;
    private readonly markerTexture: THREE.CanvasTexture;
    private readonly shards: THREE.Mesh[] = [];
    private readonly shardMaterial: THREE.MeshStandardMaterial;
    private readonly shardGeometry: THREE.OctahedronGeometry;
    private readonly uniforms = {
        uTime: { value: 0 },
        uNoise: { value: getPortalNoiseTexture() },
        uCore: { value: new THREE.Color(0x120523) },
        uEdge: { value: new THREE.Color(0x3d1470) },
        uSpark: { value: new THREE.Color(0xc79bff) },
        uCharge: { value: 1 },
    };

    private time = 0;
    private visible = false;

    constructor(private readonly scene: THREE.Scene) {
        this.group = new THREE.Group();
        this.group.name = "influence-breach";
        this.group.visible = false;
        this.group.userData.interactionId = BREACH_INTERACTION;
        this.group.userData.interactionRadius = BREACH_INTERACT_RADIUS;

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: breachVertexShader,
            fragmentShader: breachFragmentShader,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            fog: false,
            toneMapped: false,
        });

        this.sheet = new THREE.Mesh(new THREE.PlaneGeometry(BREACH_RADIUS * 2, BREACH_RADIUS * 2.6), this.material);
        this.sheet.renderOrder = 7;
        this.group.add(this.sheet);

        const back = new THREE.Mesh(this.sheet.geometry, this.material);
        back.rotation.y = Math.PI / 2;
        back.scale.x = 0.28;
        back.renderOrder = 7;
        this.group.add(back);

        this.shardGeometry = new THREE.OctahedronGeometry(0.5, 0);
        this.shardMaterial = new THREE.MeshStandardMaterial({
            color: 0x1c1030,
            emissive: 0x7b3ce0,
            emissiveIntensity: 1.6,
            roughness: 0.35,
            metalness: 0.2,
            flatShading: true,
        });

        for (let i = 0; i < SHARD_COUNT; i++) {
            const shard = new THREE.Mesh(this.shardGeometry, this.shardMaterial);
            const scale = 0.45 + (i % 4) * 0.35;
            shard.scale.set(scale * 0.4, scale * (1.4 + (i % 3) * 0.5), scale * 0.4);
            this.shards.push(shard);
            this.group.add(shard);
        }

        this.halo = new THREE.PointLight(0x9b5bff, 24, 60, 2);
        this.group.add(this.halo);

        this.beamMaterial = new THREE.MeshBasicMaterial({
            color: 0x9b5bff,
            transparent: true,
            opacity: 0.16,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            fog: false,
            toneMapped: false,
        });

        this.beam = new THREE.Mesh(
            new THREE.CylinderGeometry(BEAM_RADIUS * 0.4, BEAM_RADIUS, BEAM_HEIGHT, 10, 1, true),
            this.beamMaterial
        );
        this.beam.name = "influence-breach-beam";
        this.beam.frustumCulled = false;
        this.beam.renderOrder = 5;
        this.group.add(this.beam);

        this.markerTexture = createMarkerTexture();
        this.marker = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.markerTexture,
            color: 0xc79bff,
            transparent: true,
            opacity: 0.9,
            depthTest: false,
            depthWrite: false,
            fog: false,
            toneMapped: false,
        }));
        this.marker.renderOrder = 999;
        this.marker.frustumCulled = false;
        this.group.add(this.marker);

        this.scene.add(this.group);
    }

    public apply(state: InfluenceStateData | null) {
        const open = state !== null && (state.status === "open" || state.status === "collapsing");
        this.visible = open;
        this.group.visible = open;

        if (!open || !state) return;

        this.group.position.set(state.breach.x, state.breach.y, state.breach.z);
        this.uniforms.uCharge.value = state.status === "collapsing" ? 1.5 : 1;

        if (state.status === "collapsing") {
            this.uniforms.uEdge.value.setHex(0x6b1220);
            this.uniforms.uSpark.value.setHex(0xff8a6b);
            this.halo.color.setHex(0xff6b4a);
        } else {
            this.uniforms.uEdge.value.setHex(0x3d1470);
            this.uniforms.uSpark.value.setHex(0xc79bff);
            this.halo.color.setHex(0x9b5bff);
        }
    }

    public faceCamera(cameraPosition: THREE.Vector3) {
        if (!this.visible) return;
        const dx = cameraPosition.x - this.group.position.x;
        const dz = cameraPosition.z - this.group.position.z;
        this.group.rotation.y = Math.atan2(dx, dz);
    }

    public update(delta: number, cameraPosition?: THREE.Vector3) {
        if (!this.visible) return;

        this.time += delta;
        this.uniforms.uTime.value = this.time;

        const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.4);
        this.halo.intensity = 16 + pulse * 16;

        if (cameraPosition) {
            const distance = cameraPosition.distanceTo(this.group.position);
            const far = THREE.MathUtils.clamp((distance - MARKER_NEAR) / (MARKER_FAR - MARKER_NEAR), 0, 1);

            this.beamMaterial.opacity = (0.06 + far * 0.2) * (0.7 + pulse * 0.5);
            this.beam.visible = distance > MARKER_NEAR * 0.4;

            this.marker.visible = distance > MARKER_NEAR;
            this.marker.position.y = BREACH_RADIUS * 1.9;
            this.marker.scale.setScalar(Math.max(3, distance * 0.035));
            (this.marker.material as THREE.SpriteMaterial).opacity = 0.35 + far * 0.55;
        }

        for (let i = 0; i < this.shards.length; i++) {
            const shard = this.shards[i];
            const phase = (i / this.shards.length) * Math.PI * 2 + this.time * (0.16 + (i % 3) * 0.05);
            const radius = BREACH_RADIUS * (0.7 + ((i * 7) % 5) * 0.12);
            const lift = Math.sin(this.time * 0.7 + i * 1.3) * BREACH_RADIUS * 0.6;

            shard.position.set(Math.cos(phase) * radius * 0.55, lift, Math.sin(phase) * radius * 0.35);
            shard.rotation.y = phase * 1.7;
            shard.rotation.x = Math.sin(this.time * 0.5 + i) * 0.7;
        }
    }

    public dispose() {
        this.scene.remove(this.group);
        this.sheet.geometry.dispose();
        this.material.dispose();
        this.shardGeometry.dispose();
        this.shardMaterial.dispose();
        this.beam.geometry.dispose();
        this.beamMaterial.dispose();
        this.marker.material.dispose();
        this.markerTexture.dispose();
    }
}
