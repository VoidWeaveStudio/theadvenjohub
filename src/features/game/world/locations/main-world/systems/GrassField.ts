// src/features/game/world/locations/main-world/systems/GrassField.ts
import * as THREE from "three";
import { bakeTerrainDepthMap, DepthMap } from "../utils/waterDepthMap";
import { FOLIAGE_PALETTE_GLSL, WorldLighting, WORLD_LIGHTING_FUNCTIONS_GLSL, WORLD_LIGHTING_UNIFORMS_GLSL } from "../utils/worldLighting";
import type { TerrainSystem } from "./TerrainSystem";
import { SEA_LEVEL, TOWER_PLAZA_FAR, TOWER_PLAZA_HALF_WIDTH, TOWER_X, TOWER_Z, WORLD_SIZE } from "../worldConfig";

interface LayerConfig {
    cell: number;
    radius: number;
    perCell: number;
    segments: number;
    minHeight: number;
    maxHeight: number;
    width: number;
    roundness: number;
}

const LAYERS: LayerConfig[] = [
    { cell: 0.24, radius: 16, perCell: 4, segments: 4, minHeight: 0.3, maxHeight: 0.58, width: 0.03, roundness: 0.62 },
    { cell: 0.46, radius: 38, perCell: 3, segments: 3, minHeight: 0.32, maxHeight: 0.66, width: 0.035, roundness: 0.52 },
    { cell: 0.9, radius: 82, perCell: 2, segments: 2, minHeight: 0.36, maxHeight: 0.76, width: 0.044, roundness: 0.4 },
    { cell: 2.1, radius: 165, perCell: 1, segments: 1, minHeight: 0.42, maxHeight: 0.95, width: 0.07, roundness: 0.3 },
];

const HEIGHT_MAP_EXTENT = WORLD_SIZE + 120;
const HEIGHT_MAP_RESOLUTION = 1024;
const FIELD_RESOLUTION = 256;
const FIELD_WORLD_SIZE = 420;

const grassVertexShader = /* glsl */`
    precision highp float;

    ${WORLD_LIGHTING_UNIFORMS_GLSL}

    attribute vec3 aInst;

    uniform sampler2D uHeightMap;
    uniform sampler2D uFieldMap;
    uniform float uHeightOrigin;
    uniform float uHeightScale;
    uniform vec2 uCamCell;
    uniform float uCell;
    uniform float uRadius;
    uniform float uPerCell;
    uniform vec2 uHeightRange;
    uniform float uWidth;
    uniform float uRoundness;
    uniform float uWaterLevel;
    uniform vec2 uWindDir;
    uniform float uWindStrength;
    uniform vec2 uCamForward;
    uniform float uCullCos;
    uniform float uWorldLimit;
    uniform vec3 uPlayerPos;
    uniform vec2 uPlayerVel;
    uniform float uPlayerPush;
    uniform float uDensityScale;
    uniform vec4 uPlaza;
    uniform float uAerial;
    uniform float uPixelScale;
    uniform vec4 uFrustum0;
    uniform vec4 uFrustum1;
    uniform vec4 uFrustum2;
    uniform vec4 uFrustum3;

    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec3 vTint;
    varying float vHeightFactor;
    varying float vDistance;

    vec4 hash42(vec2 p) {
        vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
        p4 += dot(p4, p4.wzxy + 33.33);
        return fract((p4.xxyz + p4.yzzw) * p4.zywx);
    }

    float sampleGround(vec2 worldXZ) {
        vec2 uv = (worldXZ - vec2(uHeightOrigin)) * uHeightScale;
        return texture2D(uHeightMap, clamp(uv, 0.0, 1.0)).r;
    }

    void reject() {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        vWorldPos = vec3(0.0);
        vNormal = vec3(0.0, 1.0, 0.0);
        vTint = vec3(0.0);
        vHeightFactor = 0.0;
        vDistance = 0.0;
    }

    void main() {
        float t = position.y;
        float side = position.x;

        vec2 cell = uCamCell + aInst.xy;
        vec2 seed = cell + aInst.z * vec2(37.13, 71.7);

        vec4 r0 = hash42(seed);
        vec4 r1 = hash42(seed + 19.77);
        vec4 r2 = hash42(seed - 43.19);

        vec2 crown = floor((cell + r0.xy) * uCell / 0.42) * 0.42;
        vec2 wpos = (cell + r0.xy) * uCell;
        vec2 fromCrown = wpos - (crown + 0.21);

        float dist = distance(wpos, uCamPos.xz);
        if (dist > uRadius) { reject(); return; }
        if (length(wpos) > uWorldLimit) { reject(); return; }

        if (uCullCos > -0.999 && dist > 2.5) {
            vec2 toBlade = (wpos - uCamPos.xz) / max(dist, 1e-4);
            if (dot(toBlade, uCamForward) < uCullCos) { reject(); return; }
        }

        float alongPlaza = uPlaza.x - wpos.x;
        if (alongPlaza > -8.0 && alongPlaza < uPlaza.z + 4.0 && abs(wpos.y - uPlaza.y) < uPlaza.w + 4.0) { reject(); return; }

        float ground = sampleGround(wpos);
        if (ground < uWaterLevel + 0.35) { reject(); return; }

        float tallest = uHeightRange.y * 1.7;
        vec3 bladeSphere = vec3(wpos.x, ground + tallest * 0.5, wpos.y);
        float bladeRadius = tallest * 0.5 + 1.0 + dist * uPixelScale * 2.0;
        if (dot(uFrustum0.xyz, bladeSphere) + uFrustum0.w < -bladeRadius) { reject(); return; }
        if (dot(uFrustum1.xyz, bladeSphere) + uFrustum1.w < -bladeRadius) { reject(); return; }
        if (dot(uFrustum2.xyz, bladeSphere) + uFrustum2.w < -bladeRadius) { reject(); return; }
        if (dot(uFrustum3.xyz, bladeSphere) + uFrustum3.w < -bladeRadius) { reject(); return; }

        float gx = sampleGround(wpos + vec2(0.7, 0.0)) - sampleGround(wpos - vec2(0.7, 0.0));
        float gz = sampleGround(wpos + vec2(0.0, 0.7)) - sampleGround(wpos - vec2(0.0, 0.7));
        vec3 groundNormal = normalize(vec3(-gx, 2.8, -gz));
        if (groundNormal.y < 0.72) { reject(); return; }

        vec2 fuv = fract(wpos / ${FIELD_WORLD_SIZE.toFixed(1)});
        vec3 field = texture2D(uFieldMap, fuv).rgb;
        float clump = field.r;
        float gust = field.g;
        float dryness = field.b;

        float u = clamp(dist / uRadius, 0.0, 1.0);
        float radialTaper = 1.0 - u * u * u;
        float density = smoothstep(0.14, 0.48, clump) * radialTaper * uDensityScale * (1.0 - uAerial);
        if (r2.x > density) { reject(); return; }

        float bladeH = mix(uHeightRange.x, uHeightRange.y, r0.z) * (0.65 + clump * 0.6);
        bladeH *= 1.0 - dryness * 0.25;
        if (bladeH < 0.04) { reject(); return; }

                float halfW = uWidth * (0.78 + r0.w * 0.44) * (1.0 - t * t * 0.62);
        halfW *= mix(0.3, 1.0, 1.0 - u * u);
        halfW = max(halfW, dist * uPixelScale * 0.55);

        float ang = r1.x * 6.28318;
        vec2 leanDir = vec2(cos(ang), sin(ang));
        float crownLen = length(fromCrown);
        vec2 radial = crownLen > 1e-4 ? fromCrown / crownLen : leanDir;
        leanDir = normalize(mix(leanDir, radial, 0.66) + 1e-5);

        float staticBend = mix(0.28, 1.9, pow(r1.y, 0.85));
        staticBend *= 0.45 + bladeH * 1.6;

        float flutter = sin(uTime * 3.1 + r1.w * 6.28318 + wpos.x * 1.4 + wpos.y * 1.1);
        float windAmp = uWindStrength * (0.25 + 1.1 * gust) * (0.45 + bladeH * 1.2)
                      + uWindStrength * 0.08 * flutter;
        windAmp *= mix(0.55, 1.45, r2.z);

        vec2 bendVec = leanDir * staticBend + uWindDir * windAmp;

        vec2 toBladeFromPlayer = wpos - (uPlayerPos.xz + uPlayerVel * 0.12);
        float playerDist = length(toBladeFromPlayer);
        float push = (1.0 - smoothstep(0.25, 1.15, playerDist)) * uPlayerPush;
        if (push > 0.001) {
            bendVec += normalize(toBladeFromPlayer + 1e-5) * push * 1.15;
        }

        float bend = t * t;
        vec3 base = vec3(wpos.x, ground, wpos.y);

        vec3 tangent = normalize(vec3(bendVec.x, 1.6, bendVec.y));
        vec3 sideDir = normalize(cross(tangent, vec3(0.0, 1.0, 0.0)) + vec3(1e-4, 0.0, 0.0));

        vec3 offset = vec3(bendVec.x, 0.0, bendVec.y) * bend * bladeH * 0.55;
        vec3 worldPos = base + vec3(0.0, bladeH * t, 0.0) + offset + sideDir * (side * halfW);

        vec3 faceNormal = normalize(cross(sideDir, tangent));
        vNormal = normalize(mix(faceNormal, vec3(0.0, 1.0, 0.0), uRoundness));

        vec4 clumpRandom = hash42(floor(crown * 2.4) + 7.31);
        float clumpShade = 0.86 + clumpRandom.x * 0.28;
        float clumpWarm = clumpRandom.y * 0.35;
        vTint = vec3(clumpShade, clumpWarm, dryness);

        vWorldPos = worldPos;
        vHeightFactor = t;
        vDistance = dist;

        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
    }
`;

const grassFragmentShader = /* glsl */`
    precision highp float;

    ${WORLD_LIGHTING_UNIFORMS_GLSL}
    ${WORLD_LIGHTING_FUNCTIONS_GLSL}
    ${FOLIAGE_PALETTE_GLSL}

    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec3 vTint;
    varying float vHeightFactor;
    varying float vDistance;

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(uCamPos - vWorldPos);

        float h = vHeightFactor;
        float clumpShade = vTint.x;
        float clumpWarm = vTint.y;
        float dryness = vTint.z;

        vec3 albedo = mix(GRASS_ROOT, GRASS_MID, smoothstep(0.0, 0.48, h));
        albedo = mix(albedo, GRASS_TIP, smoothstep(0.42, 1.0, h));
        albedo = mix(albedo, GRASS_DRY, dryness * 0.42);
        albedo *= clumpShade;
        albedo = mix(albedo, albedo * vec3(1.12, 1.04, 0.82), clumpWarm);

        float ao = mix(0.42, 1.0, smoothstep(0.0, 0.5, h));

        float diffuse = wrapDiffuse(normal, uSunDir, 0.5);
        vec3 sunTerm = uSunColor * diffuse * 0.98;

        float translucency = backTranslucency(viewDir, uSunDir, 3.5) * smoothstep(0.25, 1.0, h);
        sunTerm += uSunColor * vec3(1.0, 0.95, 0.6) * translucency * 0.35;

        vec3 ambient = hemiAmbient(normal) * 0.42;
        ambient = mix(vec3(dot(ambient, vec3(0.299, 0.587, 0.114))), ambient, 0.55);

        vec3 color = albedo * (ambient + sunTerm) * ao;

        float rim = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 4.0);
        color += GRASS_TIP * uSunColor * rim * 0.2 * smoothstep(0.5, 1.0, h) * (1.0 - uNightFactor);

        color = applyWorldFog(color, vDistance, vWorldPos);

        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

interface GrassLayer {
    mesh: THREE.InstancedMesh;
    material: THREE.ShaderMaterial;
    config: LayerConfig;
}

export class GrassField {
    private readonly layers: GrassLayer[] = [];
    private heightMap: DepthMap | null = null;
    private fieldMap: THREE.DataTexture | null = null;

    private readonly windDirection = new THREE.Vector2(0.72, 0.69);
    private readonly frustum = new THREE.Frustum();
    private readonly projectionView = new THREE.Matrix4();
    private readonly forward = new THREE.Vector3();
    private readonly cameraWorld = new THREE.Vector3();
    private renderer: THREE.WebGLRenderer | null = null;
    private viewportHeight = 1080;
    private readonly playerVelocity = new THREE.Vector2();
    private readonly previousPlayerPosition = new THREE.Vector3();
    private hasPreviousPosition = false;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly terrain: TerrainSystem,
        private readonly lighting: WorldLighting,
        private readonly lowEnd: boolean
    ) { }

    public create(renderer?: THREE.WebGLRenderer) {
        this.renderer = renderer ?? null;
        this.heightMap = bakeTerrainDepthMap(
            (x, z) => this.terrain.getHeightAt(x, z),
            HEIGHT_MAP_EXTENT,
            HEIGHT_MAP_RESOLUTION
        );
        this.fieldMap = this.createFieldTexture();

        const configs = this.lowEnd ? LAYERS.slice(1) : LAYERS;

        for (const config of configs) {
            this.layers.push(this.createLayer(config));
        }
    }

    private createFieldTexture(): THREE.DataTexture {
        const size = FIELD_RESOLUTION;
        const data = new Uint8Array(size * size * 4);

        const noise = (x: number, y: number, frequency: number, seed: number) => {
            const value = Math.sin((x * frequency + seed) * 12.9898) * Math.cos((y * frequency - seed) * 78.233);
            return value * 0.5 + 0.5;
        };

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const index = (y * size + x) * 4;

                const patch =
                    noise(x, y, 0.035, 3.1) * 0.5 +
                    noise(x, y, 0.011, 8.7) * 0.35 +
                    noise(x, y, 0.09, 17.3) * 0.15;

                const gust = noise(x, y, 0.02, 41.7) * 0.7 + noise(x, y, 0.055, 5.9) * 0.3;
                const dry = noise(x, y, 0.008, 23.4) * 0.8 + noise(x, y, 0.04, 61.2) * 0.2;

                data[index] = Math.floor(THREE.MathUtils.clamp(patch, 0, 1) * 255);
                data[index + 1] = Math.floor(THREE.MathUtils.clamp(gust, 0, 1) * 255);
                data[index + 2] = Math.floor(THREE.MathUtils.clamp(dry * dry, 0, 1) * 255);
                data[index + 3] = 255;
            }
        }

        const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
    }

    private createBladeGeometry(segments: number): THREE.BufferGeometry {
        const positions: number[] = [];
        const indices: number[] = [];

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            if (i === segments) {
                positions.push(0, t, 0);
            } else {
                positions.push(-1, t, 0);
                positions.push(1, t, 0);
            }
        }

        for (let i = 0; i < segments - 1; i++) {
            const a = i * 2;
            indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }

        const tip = (segments - 1) * 2;
        indices.push(tip, tip + 2, tip + 1);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices);
        return geometry;
    }

    private createLayer(config: LayerConfig): GrassLayer {
        const geometry = this.createBladeGeometry(config.segments);

        const cellsPerSide = Math.ceil((config.radius * 2) / config.cell);
        const instanceCount = cellsPerSide * cellsPerSide * config.perCell;

        const offsets = new Float32Array(instanceCount * 3);
        const half = Math.floor(cellsPerSide / 2);
        let cursor = 0;

        for (let iz = -half; iz < cellsPerSide - half; iz++) {
            for (let ix = -half; ix < cellsPerSide - half; ix++) {
                for (let k = 0; k < config.perCell; k++) {
                    offsets[cursor * 3] = ix;
                    offsets[cursor * 3 + 1] = iz;
                    offsets[cursor * 3 + 2] = k;
                    cursor++;
                }
            }
        }

        geometry.setAttribute("aInst", new THREE.InstancedBufferAttribute(offsets, 3));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                ...this.lighting.uniforms,
                uHeightMap: { value: this.heightMap!.texture },
                uFieldMap: { value: this.fieldMap },
                uHeightOrigin: { value: this.heightMap!.origin },
                uHeightScale: { value: this.heightMap!.scale },
                uCamCell: { value: new THREE.Vector2() },
                uCell: { value: config.cell },
                uRadius: { value: config.radius },
                uWorldLimit: { value: 1e6 },
                uPerCell: { value: config.perCell },
                uHeightRange: { value: new THREE.Vector2(config.minHeight, config.maxHeight) },
                uWidth: { value: config.width },
                uRoundness: { value: config.roundness },
                uWaterLevel: { value: SEA_LEVEL },
                uWindDir: { value: new THREE.Vector2(0.72, 0.69) },
                uWindStrength: { value: 0.35 },
                uCamForward: { value: new THREE.Vector2(0, 1) },
                uCullCos: { value: -1 },
                uPlayerPos: { value: new THREE.Vector3() },
                uPlayerVel: { value: new THREE.Vector2() },
                uPlayerPush: { value: 1 },
                uDensityScale: { value: 1 },
                uPlaza: { value: new THREE.Vector4(TOWER_X, TOWER_Z, TOWER_PLAZA_FAR, TOWER_PLAZA_HALF_WIDTH) },
                uAerial: { value: 0 },
                uPixelScale: { value: 0.0016 },
                uFrustum0: { value: new THREE.Vector4() },
                uFrustum1: { value: new THREE.Vector4() },
                uFrustum2: { value: new THREE.Vector4() },
                uFrustum3: { value: new THREE.Vector4() },
            },
            vertexShader: grassVertexShader,
            fragmentShader: grassFragmentShader,
            side: THREE.DoubleSide,
        });

        const mesh = new THREE.InstancedMesh(geometry, material, instanceCount);
        mesh.name = `grass-layer-${config.radius}`;
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.renderOrder = 1;
        this.scene.add(mesh);

        return { mesh, material, config };
    }

    public setVisibleRadius(radius: number | null) {
        const value = radius ?? 1e6;
        for (const layer of this.layers) {
            layer.material.uniforms.uWorldLimit.value = value;
        }
    }

    public update(delta: number, camera: THREE.Camera, playerPosition: THREE.Vector3) {
        if (this.layers.length === 0) return;

        if (this.hasPreviousPosition && delta > 0) {
            this.playerVelocity.set(
                (playerPosition.x - this.previousPlayerPosition.x) / delta,
                (playerPosition.z - this.previousPlayerPosition.z) / delta
            );
        }
        this.previousPlayerPosition.copy(playerPosition);
        this.hasPreviousPosition = true;

        const forward = this.forward;
        camera.getWorldDirection(forward);
        camera.getWorldPosition(this.cameraWorld);
        const horizontal = Math.hypot(forward.x, forward.z);
        const steep = horizontal < 0.55;

        const perspective = camera as THREE.PerspectiveCamera;
        const halfVertical = ((perspective.fov ?? 60) * Math.PI) / 360;
        const halfHorizontal = Math.atan(Math.tan(halfVertical) * (perspective.aspect ?? 1.7));
        const cullCos = Math.cos(Math.min(Math.PI * 0.95, halfHorizontal + 0.5));

        if (this.renderer) {
            this.viewportHeight = Math.max(1, this.renderer.getDrawingBufferSize(GrassField._size).y);
        }

        const pixelScale = (2 * Math.tan(halfVertical)) / this.viewportHeight;

        this.projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.projectionView);

        const groundAtCamera = this.terrain.getHeightAt(this.cameraWorld.x, this.cameraWorld.z);
        const altitude = this.cameraWorld.y - groundAtCamera;
        const aerial = THREE.MathUtils.smoothstep(altitude, 45, 115);
        const hidden = aerial >= 0.999;

        for (const layer of this.layers) {
            const uniforms = layer.material.uniforms;

            layer.mesh.visible = !hidden;
            uniforms.uAerial.value = aerial;
            uniforms.uPixelScale.value = pixelScale;

            for (let i = 0; i < 4; i++) {
                const plane = this.frustum.planes[i];
                uniforms[`uFrustum${i}`].value.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
            }

            uniforms.uCamCell.value.set(
                Math.floor(this.lighting.uniforms.uCamPos.value.x / layer.config.cell),
                Math.floor(this.lighting.uniforms.uCamPos.value.z / layer.config.cell)
            );

            uniforms.uCamForward.value.set(forward.x / (horizontal || 1), forward.z / (horizontal || 1));
            uniforms.uCullCos.value = steep ? -1 : cullCos;
            uniforms.uPlayerPos.value.copy(playerPosition);
            uniforms.uPlayerVel.value.copy(this.playerVelocity);
            uniforms.uWindDir.value.copy(this.windDirection);
        }
    }

    private static readonly _size = new THREE.Vector2();

    public setWind(direction: THREE.Vector2, strength: number) {
        this.windDirection.copy(direction).normalize();
        for (const layer of this.layers) {
            layer.material.uniforms.uWindStrength.value = strength;
        }
    }

    public dispose() {
        for (const layer of this.layers) {
            this.scene.remove(layer.mesh);
            layer.mesh.geometry.dispose();
            layer.material.dispose();
            layer.mesh.dispose();
        }

        this.layers.length = 0;
        this.heightMap?.texture.dispose();
        this.fieldMap?.dispose();
    }
}
