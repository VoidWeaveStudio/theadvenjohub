// src/features/game/world/locations/showcase/rooms/launch/LaunchSky.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import { starSprite } from "../moon/moonTextures";
import { glowSprite, moonDiscTexture, nightSkyTexture } from "./launchTextures";

const DOME_RADIUS = 620;
const STAR_COUNT = 900;
const MOON_DISTANCE = 520;
const MOON_RADIUS = 34;

const cloudVertex = /* glsl */`
    varying vec2 vCloudUv;

    void main() {
        vCloudUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const cloudFragment = /* glsl */`
    precision highp float;

    uniform sampler2D uMap;
    uniform float uShift;
    uniform float uOpacity;

    varying vec2 vCloudUv;

    void main() {
        vec2 uv = vec2(fract(vCloudUv.x + uShift), vCloudUv.y);
        vec4 texel = texture2D(uMap, uv);

        float band = smoothstep(0.5, 0.56, vCloudUv.y) * (1.0 - smoothstep(0.62, 0.84, vCloudUv.y));
        float alpha = texel.r * band * uOpacity;
        if (alpha < 0.004) discard;

        gl_FragColor = vec4(mix(vec3(0.16, 0.22, 0.33), vec3(0.72, 0.8, 0.95), texel.r) , alpha);
    }
`;

export class LaunchSky {
    private dome: THREE.Mesh | null = null;
    private stars: THREE.Points | null = null;
    private clouds: THREE.Mesh | null = null;
    private cloudMaterial: THREE.ShaderMaterial | null = null;
    private moon: THREE.Group | null = null;
    private elapsed = 0;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly bin: AssetBin,
        private readonly random: () => number,
        private readonly moonDirection: THREE.Vector3
    ) { }

    public create() {
        this.buildDome();
        this.buildStars();
        this.buildClouds();
        this.buildMoon();
    }

    private buildDome() {
        const material = this.bin.material(new THREE.MeshBasicMaterial({
            map: nightSkyTexture(this.bin, this.random),
            side: THREE.BackSide,
            depthWrite: false,
            toneMapped: false,
            fog: false,
        }));

        const mesh = new THREE.Mesh(this.bin.geometry(new THREE.SphereGeometry(DOME_RADIUS, 48, 32)), material);
        mesh.frustumCulled = false;
        mesh.renderOrder = -12;
        this.scene.add(mesh);
        this.dome = mesh;
    }

    private buildStars() {
        const positions = new Float32Array(STAR_COUNT * 3);

        for (let i = 0; i < STAR_COUNT; i++) {
            const theta = this.random() * Math.PI * 2;
            const phi = Math.acos(1 - this.random() * 0.94);
            const radius = DOME_RADIUS - 40;

            positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
            positions[i * 3 + 1] = Math.cos(phi) * radius;
            positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
        }

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = this.bin.material(new THREE.PointsMaterial({
            map: starSprite(this.bin),
            color: 0xdce8ff,
            size: 4.2,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        points.renderOrder = -11;
        this.scene.add(points);
        this.stars = points;
    }

    private buildClouds() {
        const canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 256;
        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "lighter";

        for (let i = 0; i < 160; i++) {
            const x = this.random() * canvas.width;
            const y = canvas.height * (0.18 + this.random() * 0.66);
            const w = 60 + this.random() * 200;
            const h = 14 + this.random() * 40;
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, w / 2);
            gradient.addColorStop(0, `rgba(255, 255, 255, ${0.06 + this.random() * 0.12})`);
            gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
            ctx.fillStyle = gradient;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(1, h / (w / 2));
            ctx.beginPath();
            ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        const texture = this.bin.texture(new THREE.CanvasTexture(canvas));
        texture.wrapS = THREE.RepeatWrapping;
        texture.needsUpdate = true;

        const material = this.bin.material(new THREE.ShaderMaterial({
            uniforms: {
                uMap: { value: texture },
                uShift: { value: 0 },
                uOpacity: { value: 0.85 },
            },
            vertexShader: cloudVertex,
            fragmentShader: cloudFragment,
            transparent: true,
            depthWrite: false,
            side: THREE.BackSide,
            toneMapped: false,
            fog: false,
        }));

        const mesh = new THREE.Mesh(this.bin.geometry(new THREE.SphereGeometry(DOME_RADIUS - 60, 48, 24)), material);
        mesh.frustumCulled = false;
        mesh.renderOrder = -10;
        this.scene.add(mesh);

        this.clouds = mesh;
        this.cloudMaterial = material;
    }

    private buildMoon() {
        const group = new THREE.Group();
        group.position.copy(this.moonDirection).multiplyScalar(MOON_DISTANCE);

        const disc = new THREE.Mesh(
            this.bin.geometry(new THREE.PlaneGeometry(MOON_RADIUS * 2, MOON_RADIUS * 2)),
            this.bin.material(new THREE.MeshBasicMaterial({
                map: moonDiscTexture(this.bin, this.random),
                transparent: true,
                depthWrite: false,
                toneMapped: false,
                fog: false,
            }))
        );
        disc.renderOrder = -9;
        group.add(disc);

        const halo = new THREE.Mesh(
            this.bin.geometry(new THREE.PlaneGeometry(MOON_RADIUS * 9, MOON_RADIUS * 9)),
            this.bin.material(new THREE.MeshBasicMaterial({
                map: glowSprite(this.bin, 0xbcd4ff),
                transparent: true,
                opacity: 0.3,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
                fog: false,
            }))
        );
        halo.renderOrder = -10;
        group.add(halo);

        group.lookAt(0, 0, 0);
        this.scene.add(group);
        this.moon = group;
    }

    public update(delta: number) {
        this.elapsed += delta;
        if (this.cloudMaterial) this.cloudMaterial.uniforms.uShift.value = (this.elapsed * 0.0016) % 1;
    }

    public dispose() {
        if (this.dome) this.scene.remove(this.dome);
        if (this.stars) this.scene.remove(this.stars);
        if (this.clouds) this.scene.remove(this.clouds);
        if (this.moon) this.scene.remove(this.moon);
        this.dome = null;
        this.stars = null;
        this.clouds = null;
        this.cloudMaterial = null;
        this.moon = null;
    }
}
