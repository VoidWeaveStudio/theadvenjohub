// src/features/game/world/locations/tower/floors/basement/utils/proceduralColumn.ts
import * as THREE from "three";

export const COLUMN_HEIGHT = 9.6;
export const COLUMN_TOP_RADIUS = 1.15;
export const COIN_HEIGHT_ABOVE_COLUMN = 2.6;
export const COIN_BASE_Y = COLUMN_HEIGHT + COIN_HEIGHT_ABOVE_COLUMN;

export const COLUMN_GLOW_COLOR = 0x6fd8ff;

const PAD_TOP = COLUMN_HEIGHT * 0.07;
const PYLON_TOP = COLUMN_HEIGHT * 0.80;
const PYLON_HEIGHT = PYLON_TOP - PAD_TOP;
const PYLON_MID = PAD_TOP + PYLON_HEIGHT * 0.5;
const CRADLE_Y = COLUMN_HEIGHT * 0.86;
const POOL_RADIUS = COLUMN_TOP_RADIUS * 5.2;
const CONDUIT_COUNT = 3;
const CLAW_COUNT = 3;
const CHEVRON_COUNT = 2;
const COLLAR_STOPS = [0.26, 0.54, 0.82];
const TICKER_STOP = 0.66;

const R = COLUMN_TOP_RADIUS;

const instanceApply = /* glsl */ `
mat4 columnInstance() {
#ifdef USE_INSTANCING
    return instanceMatrix;
#else
    return mat4(1.0);
#endif
}
`;

const auraVertex = /* glsl */ `
${instanceApply}
varying vec3 vNormalView;
varying vec3 vViewDir;
varying float vHeight;
void main() {
    mat4 inst = columnInstance();
    vHeight = uv.y;
    vec4 mvPosition = modelViewMatrix * inst * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * (mat3(inst) * normal));
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const auraFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec3 vNormalView;
varying vec3 vViewDir;
varying float vHeight;
void main() {
    float facing = abs(dot(normalize(vNormalView), normalize(vViewDir)));
    float rim = pow(1.0 - facing, 2.2);
    float gradient = mix(0.2, 1.0, pow(vHeight, 1.4));
    gl_FragColor = vec4(uColor, rim * gradient * uOpacity);
}
`;

const holoVertex = /* glsl */ `
${instanceApply}
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
    mat4 inst = columnInstance();
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * inst * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * (mat3(inst) * normal));
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const holoFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
    float facing = abs(dot(normalize(vNormalView), normalize(vViewDir)));
    float rim = pow(1.0 - facing, 1.4);
    float rise = pow(1.0 - vUv.y, 1.3);
    float scan = 0.55 + 0.45 * sin(vUv.y * 34.0 - uTime * 3.4);
    float ribs = 0.6 + 0.4 * sin(vUv.x * 44.0);
    gl_FragColor = vec4(uColor, rise * rim * scan * ribs * uOpacity);
}
`;

function createHullTexture(): { map: THREE.CanvasTexture; roughness: THREE.CanvasTexture } {
    const size = 512;

    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = size;
    colorCanvas.height = size;
    const ctx = colorCanvas.getContext("2d")!;

    ctx.fillStyle = "#232c38";
    ctx.fillRect(0, 0, size, size);

    const image = ctx.getImageData(0, 0, size, size);
    const data = image.data;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            const brushed = Math.sin(y * 0.9) * 5 + (Math.random() - 0.5) * 9;
            const plate = Math.floor(y / 64) % 2 === 0 ? 4 : -4;
            const shade = brushed + plate;
            data[i] = Math.max(0, Math.min(255, 35 + shade));
            data[i + 1] = Math.max(0, Math.min(255, 44 + shade));
            data[i + 2] = Math.max(0, Math.min(255, 56 + shade * 1.2));
            data[i + 3] = 255;
        }
    }
    ctx.putImageData(image, 0, 0);

    ctx.strokeStyle = "rgba(120,215,255,0.20)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
        const y = (i / 8) * size + 6;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
    }

    ctx.fillStyle = "rgba(10,14,20,0.55)";
    for (let i = 0; i < 40; i++) {
        ctx.fillRect(Math.random() * size, Math.random() * size, 3 + Math.random() * 26, 2);
    }

    const roughCanvas = document.createElement("canvas");
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rctx = roughCanvas.getContext("2d")!;
    const roughImage = rctx.createImageData(size, size);
    for (let i = 0; i < roughImage.data.length; i += 4) {
        const v = 60 + Math.random() * 70;
        roughImage.data[i] = v;
        roughImage.data[i + 1] = v;
        roughImage.data[i + 2] = v;
        roughImage.data[i + 3] = 255;
    }
    rctx.putImageData(roughImage, 0, 0);

    const map = new THREE.CanvasTexture(colorCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 8;
    map.repeat.set(1, 1.6);

    const roughness = new THREE.CanvasTexture(roughCanvas);
    roughness.wrapS = THREE.RepeatWrapping;
    roughness.wrapT = THREE.RepeatWrapping;
    roughness.repeat.set(1, 1.6);

    return { map, roughness };
}

function createTickerTexture(): THREE.CanvasTexture {
    const width = 1024;
    const height = 128;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    ctx.clearRect(0, 0, width, height);

    const candles = 64;
    const step = width / candles;
    let level = height * 0.5;

    ctx.lineWidth = 2;
    for (let i = 0; i < candles; i++) {
        const move = (Math.random() - 0.46) * height * 0.22;
        const open = level;
        const close = Math.max(height * 0.12, Math.min(height * 0.88, level + move));
        level = close;

        const up = close < open;
        const body = Math.max(3, Math.abs(close - open));
        const top = Math.min(open, close);
        const x = i * step + step * 0.3;
        const w = step * 0.4;

        ctx.strokeStyle = up ? "rgba(90,255,190,0.95)" : "rgba(255,110,140,0.95)";
        ctx.fillStyle = up ? "rgba(90,255,190,0.75)" : "rgba(255,110,140,0.75)";

        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, top - height * 0.06);
        ctx.lineTo(x + w * 0.5, top + body + height * 0.06);
        ctx.stroke();
        ctx.fillRect(x, top, w, body);
    }

    ctx.strokeStyle = "rgba(150,225,255,0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        const y = (i / 4) * height + height * 0.125;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(2, 1);
    return texture;
}

function createPoolTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(190,240,255,0.85)");
    gradient.addColorStop(0.28, "rgba(110,205,255,0.38)");
    gradient.addColorStop(0.62, "rgba(50,130,220,0.12)");
    gradient.addColorStop(1, "rgba(20,60,140,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export interface ColumnPlacement {
    x: number;
    z: number;
    seed: number;
}

export interface ColumnField {
    group: THREE.Group;
    update: (time: number) => void;
    dispose: () => void;
}

export function createColumnField(placements: ColumnPlacement[]): ColumnField {
    const group = new THREE.Group();
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    const dummy = new THREE.Object3D();

    const track = <T extends THREE.BufferGeometry>(geometry: T): T => {
        geometries.push(geometry);
        return geometry;
    };
    const trackMaterial = <T extends THREE.Material>(material: T): T => {
        materials.push(material);
        return material;
    };

    const { map, roughness } = createHullTexture();
    const tickerMap = createTickerTexture();
    const poolMap = createPoolTexture();
    textures.push(map, roughness, tickerMap, poolMap);

    const hullMaterial = trackMaterial(new THREE.MeshStandardMaterial({
        map,
        roughnessMap: roughness,
        color: 0x8ea3bd,
        roughness: 0.42,
        metalness: 0.88,
        emissive: 0x0d2130,
        emissiveIntensity: 0.5,
    }));

    const trimMaterial = trackMaterial(new THREE.MeshStandardMaterial({
        color: 0x38506b,
        roughness: 0.3,
        metalness: 0.95,
        emissive: 0x0a1c2c,
        emissiveIntensity: 0.6,
    }));

    const emissiveMaterial = trackMaterial(new THREE.MeshStandardMaterial({
        color: 0xa8ecff,
        roughness: 0.2,
        metalness: 0.1,
        emissive: COLUMN_GLOW_COLOR,
        emissiveIntensity: 2.8,
    }));

    const inlayMaterial = trackMaterial(new THREE.MeshBasicMaterial({
        color: 0x8fe6ff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
    }));

    const tickerMaterial = trackMaterial(new THREE.MeshBasicMaterial({
        map: tickerMap,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
    }));

    const holoMaterial = trackMaterial(new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(0x9fe8ff) },
            uOpacity: { value: 0.55 },
            uTime: { value: 0 },
        },
        vertexShader: holoVertex,
        fragmentShader: holoFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
    }));

    const auraMaterial = trackMaterial(new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(COLUMN_GLOW_COLOR) },
            uOpacity: { value: 0.5 },
        },
        vertexShader: auraVertex,
        fragmentShader: auraFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
    }));

    const poolMaterial = trackMaterial(new THREE.MeshBasicMaterial({
        map: poolMap,
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
    }));

    const addInstances = (
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        build: (place: ColumnPlacement, facet: number, push: () => void) => void,
        perColumn: number,
        options: { castShadow?: boolean; receiveShadow?: boolean; renderOrder?: number } = {}
    ): THREE.InstancedMesh => {
        const mesh = new THREE.InstancedMesh(track(geometry), material, placements.length * perColumn);
        mesh.castShadow = options.castShadow ?? false;
        mesh.receiveShadow = options.receiveShadow ?? false;
        if (options.renderOrder !== undefined) mesh.renderOrder = options.renderOrder;

        let index = 0;
        const push = () => {
            dummy.updateMatrix();
            mesh.setMatrixAt(index++, dummy.matrix);
        };

        for (const place of placements) {
            build(place, (place.seed % 6) * (Math.PI / 3), push);
        }

        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
        return mesh;
    };

    const reset = (place: ColumnPlacement, y: number, facet: number) => {
        dummy.position.set(place.x, y, place.z);
        dummy.rotation.set(0, facet, 0);
        dummy.scale.setScalar(1);
    };

    addInstances(
        new THREE.CircleGeometry(POOL_RADIUS, 40),
        poolMaterial,
        (place, facet, push) => {
            reset(place, 0.04, facet);
            dummy.rotation.set(-Math.PI / 2, 0, 0);
            push();
        },
        1
    );

    addInstances(
        new THREE.CylinderGeometry(R * 2.05, R * 2.35, PAD_TOP, 6),
        hullMaterial,
        (place, facet, push) => {
            reset(place, PAD_TOP * 0.5, facet);
            push();
        },
        1,
        { castShadow: true, receiveShadow: true }
    );

    addInstances(
        new THREE.TorusGeometry(R * 2.2, R * 0.09, 8, 6),
        trimMaterial,
        (place, facet, push) => {
            reset(place, PAD_TOP * 0.35, facet);
            dummy.rotation.set(Math.PI / 2, 0, facet);
            push();
        },
        1,
        { castShadow: true }
    );

    addInstances(
        new THREE.CylinderGeometry(R * 1.72, R * 1.72, COLUMN_HEIGHT * 0.008, 6),
        inlayMaterial,
        (place, facet, push) => {
            reset(place, PAD_TOP + COLUMN_HEIGHT * 0.004, facet);
            push();
        },
        1
    );

    addInstances(
        new THREE.CylinderGeometry(R * 0.82, R * 1.22, PYLON_HEIGHT, 6, 1),
        hullMaterial,
        (place, facet, push) => {
            reset(place, PYLON_MID, facet);
            push();
        },
        1,
        { castShadow: true, receiveShadow: true }
    );

    addInstances(
        new THREE.BoxGeometry(R * 0.12, PYLON_HEIGHT * 0.86, R * 0.12),
        emissiveMaterial,
        (place, facet, push) => {
            for (let i = 0; i < CONDUIT_COUNT; i++) {
                const angle = facet + (i / CONDUIT_COUNT) * Math.PI * 2;
                dummy.position.set(
                    place.x + Math.cos(angle) * R * 1.06,
                    PYLON_MID,
                    place.z + Math.sin(angle) * R * 1.06
                );
                dummy.rotation.set(0, -angle, 0);
                dummy.scale.setScalar(1);
                push();
            }
        },
        CONDUIT_COUNT
    );

    addInstances(
        new THREE.CylinderGeometry(R * 1.16, R * 1.16, COLUMN_HEIGHT * 0.045, 6),
        trimMaterial,
        (place, facet, push) => {
            for (const stop of COLLAR_STOPS) {
                reset(place, PAD_TOP + PYLON_HEIGHT * stop, facet);
                dummy.scale.setScalar(1.12 - stop * 0.2);
                push();
            }
        },
        COLLAR_STOPS.length,
        { castShadow: true }
    );

    addInstances(
        new THREE.CylinderGeometry(R * 1.05, R * 1.05, COLUMN_HEIGHT * 0.11, 24, 1, true),
        tickerMaterial,
        (place, facet, push) => {
            reset(place, PAD_TOP + PYLON_HEIGHT * TICKER_STOP, facet);
            dummy.rotation.set(0, 0, 0);
            push();
        },
        1
    );

    addInstances(
        new THREE.CylinderGeometry(R * 1.25, R * 1.65, PYLON_HEIGHT, 6, 1, true),
        auraMaterial,
        (place, facet, push) => {
            reset(place, PYLON_MID, facet);
            push();
        },
        1
    );

    addInstances(
        new THREE.TorusGeometry(R * 1.05, R * 0.075, 10, 32),
        emissiveMaterial,
        (place, facet, push) => {
            reset(place, CRADLE_Y, facet);
            dummy.rotation.set(Math.PI / 2, 0, 0);
            push();
        },
        1
    );

    addInstances(
        new THREE.CylinderGeometry(R * 0.05, R * 0.14, COLUMN_HEIGHT * 0.16, 6),
        trimMaterial,
        (place, facet, push) => {
            for (let i = 0; i < CLAW_COUNT; i++) {
                const angle = facet + (i / CLAW_COUNT) * Math.PI * 2 + Math.PI / CLAW_COUNT;
                dummy.position.set(
                    place.x + Math.cos(angle) * R * 0.95,
                    CRADLE_Y + COLUMN_HEIGHT * 0.06,
                    place.z + Math.sin(angle) * R * 0.95
                );
                dummy.rotation.set(-Math.sin(angle) * 0.42, 0, Math.cos(angle) * 0.42);
                dummy.scale.setScalar(1);
                push();
            }
        },
        CLAW_COUNT,
        { castShadow: true }
    );

    addInstances(
        new THREE.CylinderGeometry(R * 0.55, R * 1.0, COIN_BASE_Y - CRADLE_Y, 24, 1, true),
        holoMaterial,
        (place, facet, push) => {
            reset(place, (CRADLE_Y + COIN_BASE_Y) * 0.5, facet);
            dummy.rotation.set(0, 0, 0);
            push();
        },
        1
    );

    const chevrons = new THREE.InstancedMesh(
        track(new THREE.TorusGeometry(R * 0.62, R * 0.035, 6, 24)),
        inlayMaterial,
        placements.length * CHEVRON_COUNT
    );
    chevrons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    chevrons.frustumCulled = false;
    group.add(chevrons);

    const chevronRise = (COIN_BASE_Y - CRADLE_Y) * 0.85;

    return {
        group,
        update: (time: number) => {
            const pulse = 0.5 + Math.sin(time * 1.6) * 0.5;

            inlayMaterial.opacity = 0.55 + pulse * 0.35;
            auraMaterial.uniforms.uOpacity.value = 0.34 + pulse * 0.22;
            holoMaterial.uniforms.uOpacity.value = 0.42 + pulse * 0.25;
            holoMaterial.uniforms.uTime.value = time;
            poolMaterial.opacity = 0.42 + pulse * 0.18;
            emissiveMaterial.emissiveIntensity = 2.4 + pulse * 1.3;
            tickerMap.offset.x = (time * 0.06) % 1;

            let index = 0;
            for (let c = 0; c < placements.length; c++) {
                const place = placements[c];
                for (let i = 0; i < CHEVRON_COUNT; i++) {
                    const phase = (time * 0.55 + i / CHEVRON_COUNT + c * 0.11) % 1;
                    const scale = 0.6 + phase * 0.9;
                    dummy.position.set(place.x, CRADLE_Y + COLUMN_HEIGHT * 0.05 + phase * chevronRise, place.z);
                    dummy.rotation.set(Math.PI / 2, 0, time * 0.6 + c);
                    dummy.scale.setScalar(scale);
                    dummy.updateMatrix();
                    chevrons.setMatrixAt(index++, dummy.matrix);
                }
            }
            chevrons.instanceMatrix.needsUpdate = true;
        },
        dispose: () => {
            geometries.forEach((geometry) => geometry.dispose());
            materials.forEach((material) => material.dispose());
            textures.forEach((texture) => texture.dispose());
            group.removeFromParent();
        },
    };
}
