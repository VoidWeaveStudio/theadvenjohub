// src/features/game/world/locations/showcase/rooms/moon/MoonSky.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import {
    earthCloudTexture,
    earthDayTexture,
    earthNightTexture,
    galaxyTexture,
    milkyWayTexture,
    starSprite,
} from "./moonTextures";

const STAR_COUNT = 2600;
const STAR_RADIUS = 300;

const GALAXY_DIRECTION = new THREE.Vector3(-0.22, 0.84, 0.5).normalize();
const GALAXY_DISTANCE = 268;
const GALAXY_SIZE = 210;

const STAR_COLORS = [
    0xffffff, 0xf2f6ff, 0xdce6ff, 0xc4d6ff,
    0xfff2d8, 0xffd9a8, 0xffb98a, 0xd8e8ff,
];

const starVertex = /* glsl */`
    precision highp float;

    attribute vec3 aSeed;
    attribute vec3 aTint;

    uniform float uTime;

    varying float vAlpha;
    varying vec3 vTint;

    void main() {
        float phase = aSeed.x;
        float speed = aSeed.y;
        float bright = aSeed.z;

        float twinkle = 0.72 + 0.28 * sin(uTime * speed + phase * 6.2831);
        vAlpha = bright * twinkle;
        vTint = aTint;

        gl_PointSize = (1.2 + bright * 4.6) * twinkle;
        gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
    }
`;

const starFragment = /* glsl */`
    precision highp float;

    uniform sampler2D uMap;

    varying float vAlpha;
    varying vec3 vTint;

    void main() {
        vec4 texel = texture2D(uMap, gl_PointCoord);
        float alpha = texel.a * vAlpha;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(texel.rgb * vTint, alpha);
    }
`;

const earthVertex = /* glsl */`
    precision highp float;

    varying vec2 vEarthUv;
    varying vec3 vNormalW;
    varying vec3 vPosW;

    void main() {
        vEarthUv = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vPosW = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

const earthFragment = /* glsl */`
    precision highp float;

    uniform sampler2D uDay;
    uniform sampler2D uNight;
    uniform sampler2D uClouds;
    uniform vec3 uSunDir;
    uniform float uSpin;
    uniform float uCloudShift;

    varying vec2 vEarthUv;
    varying vec3 vNormalW;
    varying vec3 vPosW;

    void main() {
        vec2 uv = vec2(fract(vEarthUv.x + uSpin), vEarthUv.y);
        vec2 cloudUv = vec2(fract(vEarthUv.x + uSpin + uCloudShift), vEarthUv.y);

        vec3 normal = normalize(vNormalW);
        vec3 viewDir = normalize(cameraPosition - vPosW);

        float ndl = dot(normal, uSunDir);
        float day = smoothstep(-0.16, 0.2, ndl);
        float lambert = max(ndl, 0.0);

        vec3 dayColor = texture2D(uDay, uv).rgb;
        vec3 nightColor = texture2D(uNight, uv).rgb;

        vec3 color = mix(nightColor * 1.5, dayColor * (0.07 + lambert * 1.15), day);

        float cloud = texture2D(uClouds, cloudUv).r;
        color = mix(color, vec3(1.0) * (0.05 + lambert * 1.1), cloud * (0.12 + 0.82 * day));

        vec3 half3 = normalize(uSunDir + viewDir);
        float glint = pow(max(dot(normal, half3), 0.0), 46.0) * (1.0 - cloud) * day;
        color += vec3(1.0, 0.96, 0.86) * glint * 0.3;

        float rim = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 2.6);
        color += vec3(0.24, 0.48, 0.98) * rim * (0.22 + 0.85 * day);

        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

const atmosphereFragment = /* glsl */`
    precision highp float;

    uniform vec3 uSunDir;

    varying vec2 vEarthUv;
    varying vec3 vNormalW;
    varying vec3 vPosW;

    void main() {
        vec3 normal = normalize(vNormalW);
        vec3 viewDir = normalize(cameraPosition - vPosW);

        float rim = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 3.2);
        float lit = smoothstep(-0.42, 0.42, dot(normal, uSunDir));
        float alpha = rim * (0.1 + lit * 0.95);
        if (alpha < 0.004) discard;

        gl_FragColor = vec4(vec3(0.3, 0.56, 1.0), alpha);
    }
`;

export class MoonSky {
    private stars: THREE.Points | null = null;
    private starMaterial: THREE.ShaderMaterial | null = null;
    private band: THREE.Mesh | null = null;
    private earth: THREE.Group | null = null;
    private earthMaterial: THREE.ShaderMaterial | null = null;
    private galaxy: THREE.Mesh | null = null;
    private galaxyMaterial: THREE.MeshBasicMaterial | null = null;
    private galaxyLevel = 0;
    private elapsed = 0;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly bin: AssetBin,
        private readonly random: () => number,
        private readonly sunDirection: THREE.Vector3
    ) { }

    public create(earthPosition: THREE.Vector3, earthRadius: number) {
        this.buildStars();
        this.buildBand();
        this.buildEarth(earthPosition, earthRadius);
        this.buildSun();
        this.buildGalaxy();
    }

    private buildGalaxy() {
        const material = this.bin.material(new THREE.MeshBasicMaterial({
            map: galaxyTexture(this.bin, this.random),
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));

        const mesh = new THREE.Mesh(this.bin.geometry(new THREE.PlaneGeometry(GALAXY_SIZE, GALAXY_SIZE)), material);
        mesh.position.copy(GALAXY_DIRECTION).multiplyScalar(GALAXY_DISTANCE);
        mesh.lookAt(0, 0, 0);
        mesh.rotateZ(0.7);
        mesh.renderOrder = -8;
        mesh.visible = false;
        mesh.frustumCulled = false;
        this.scene.add(mesh);

        this.galaxy = mesh;
        this.galaxyMaterial = material;
    }

    public setGalaxy(amount: number) {
        this.galaxyLevel = THREE.MathUtils.clamp(amount, 0, 1);
        if (this.galaxy) this.galaxy.visible = this.galaxyLevel > 0.005;
    }

    private buildStars() {
        const positions = new Float32Array(STAR_COUNT * 3);
        const seeds = new Float32Array(STAR_COUNT * 3);
        const tints = new Float32Array(STAR_COUNT * 3);
        const color = new THREE.Color();

        for (let i = 0; i < STAR_COUNT; i++) {
            const theta = this.random() * Math.PI * 2;
            const phi = Math.acos(1 - this.random() * 1.12);

            positions[i * 3] = Math.sin(phi) * Math.cos(theta) * STAR_RADIUS;
            positions[i * 3 + 1] = Math.cos(phi) * STAR_RADIUS;
            positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * STAR_RADIUS;

            const rarity = Math.pow(this.random(), 3.2);
            seeds[i * 3] = this.random();
            seeds[i * 3 + 1] = 0.6 + this.random() * 2.6;
            seeds[i * 3 + 2] = 0.16 + rarity * 0.95;

            color.setHex(STAR_COLORS[Math.floor(this.random() * STAR_COLORS.length)]);
            tints[i * 3] = color.r;
            tints[i * 3 + 1] = color.g;
            tints[i * 3 + 2] = color.b;
        }

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));
        geometry.setAttribute("aTint", new THREE.BufferAttribute(tints, 3));

        const material = this.bin.material(new THREE.ShaderMaterial({
            uniforms: {
                uMap: { value: starSprite(this.bin) },
                uTime: { value: 0 },
            },
            vertexShader: starVertex,
            fragmentShader: starFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        }));

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        points.renderOrder = -10;
        this.scene.add(points);

        this.stars = points;
        this.starMaterial = material;
    }

    private buildBand() {
        const material = this.bin.material(new THREE.MeshBasicMaterial({
            map: milkyWayTexture(this.bin, this.random),
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));

        const mesh = new THREE.Mesh(this.bin.geometry(new THREE.SphereGeometry(STAR_RADIUS + 20, 42, 28)), material);
        mesh.rotation.set(0.42, 1.1, 0.62);
        mesh.frustumCulled = false;
        mesh.renderOrder = -11;
        this.scene.add(mesh);
        this.band = mesh;
    }

    private buildEarth(position: THREE.Vector3, radius: number) {
        const group = new THREE.Group();
        group.position.copy(position);

        const uniforms = {
            uDay: { value: earthDayTexture(this.bin, this.random) },
            uNight: { value: earthNightTexture(this.bin, this.random) },
            uClouds: { value: earthCloudTexture(this.bin, this.random) },
            uSunDir: { value: this.sunDirection.clone().normalize() },
            uSpin: { value: 0 },
            uCloudShift: { value: 0 },
        };

        const globeMaterial = this.bin.material(new THREE.ShaderMaterial({
            uniforms,
            vertexShader: earthVertex,
            fragmentShader: earthFragment,
        }));

        const globe = new THREE.Mesh(this.bin.geometry(new THREE.SphereGeometry(radius, 64, 48)), globeMaterial);
        globe.castShadow = false;
        globe.receiveShadow = false;
        group.add(globe);

        const atmosphereMaterial = this.bin.material(new THREE.ShaderMaterial({
            uniforms: { uSunDir: uniforms.uSunDir },
            vertexShader: earthVertex,
            fragmentShader: atmosphereFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        }));

        const atmosphere = new THREE.Mesh(
            this.bin.geometry(new THREE.SphereGeometry(radius * 1.09, 48, 32)),
            atmosphereMaterial
        );
        atmosphere.castShadow = false;
        group.add(atmosphere);

        this.scene.add(group);
        this.earth = group;
        this.earthMaterial = globeMaterial;
    }

    private buildSun() {
        const direction = this.sunDirection.clone().normalize().multiplyScalar(STAR_RADIUS - 30);

        const disc = new THREE.Mesh(
            this.bin.geometry(new THREE.CircleGeometry(5.5, 32)),
            this.bin.material(new THREE.MeshBasicMaterial({
                color: 0xfffdf4,
                toneMapped: false,
                depthWrite: false,
                fog: false,
            }))
        );
        disc.position.copy(direction);
        disc.lookAt(0, 0, 0);
        disc.renderOrder = -9;
        this.scene.add(disc);

        const flare = new THREE.Mesh(
            this.bin.geometry(new THREE.CircleGeometry(22, 32)),
            this.bin.material(new THREE.MeshBasicMaterial({
                color: 0xbfd8ff,
                transparent: true,
                opacity: 0.16,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
                fog: false,
            }))
        );
        flare.position.copy(direction);
        flare.lookAt(0, 0, 0);
        flare.renderOrder = -9;
        this.scene.add(flare);
    }

    public update(delta: number) {
        this.elapsed += delta;

        if (this.starMaterial) this.starMaterial.uniforms.uTime.value = this.elapsed;

        if (this.earthMaterial) {
            this.earthMaterial.uniforms.uSpin.value = (this.elapsed * 0.0032) % 1;
            this.earthMaterial.uniforms.uCloudShift.value = (this.elapsed * 0.0011) % 1;
        }

        if (this.galaxyMaterial) {
            const breath = 0.92 + Math.sin(this.elapsed * 0.4) * 0.08;
            this.galaxyMaterial.opacity = this.galaxyLevel * breath;
        }

        if (this.galaxy) {
            this.galaxy.scale.setScalar(0.82 + this.galaxyLevel * 0.18);
        }
    }

    public dispose() {
        if (this.stars) this.scene.remove(this.stars);
        if (this.band) this.scene.remove(this.band);
        if (this.earth) this.scene.remove(this.earth);
        if (this.galaxy) this.scene.remove(this.galaxy);
        this.galaxy = null;
        this.galaxyMaterial = null;
        this.stars = null;
        this.starMaterial = null;
        this.band = null;
        this.earth = null;
        this.earthMaterial = null;
    }
}
