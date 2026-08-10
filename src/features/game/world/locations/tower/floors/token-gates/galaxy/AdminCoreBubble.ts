// src/features/game/world/locations/tower/floors/token-gates/galaxy/AdminCoreBubble.ts
import * as THREE from "three";

const CLOUD_TEXTURE_SIZE = 128;
const LAVA_TEXTURE_SIZE = 256;
const LAVA_UV_SCALE = new THREE.Vector2(4, 2);
const LAVA_TIME_SCALE = 0.9;
const CORONA_SCALE = 1.16;

let sharedCloudTexture: THREE.Texture | null = null;
let sharedLavaTexture: THREE.Texture | null = null;

function hash2(ix: number, iy: number, seed: number): number {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function tileableNoise(x: number, y: number, freq: number, seed: number): number {
    const fx = x * freq;
    const fy = y * freq;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);

    const x0 = ((ix % freq) + freq) % freq;
    const y0 = ((iy % freq) + freq) % freq;
    const x1 = (x0 + 1) % freq;
    const y1 = (y0 + 1) % freq;

    const v00 = hash2(x0, y0, seed);
    const v10 = hash2(x1, y0, seed);
    const v01 = hash2(x0, y1, seed);
    const v11 = hash2(x1, y1, seed);

    return (v00 * (1 - sx) + v10 * sx) * (1 - sy) + (v01 * (1 - sx) + v11 * sx) * sy;
}

function tileableFbm(x: number, y: number, baseFreq: number, octaves: number, seed: number): number {
    let sum = 0;
    let amplitude = 1;
    let total = 0;
    let freq = baseFreq;

    for (let o = 0; o < octaves; o++) {
        sum += tileableNoise(x, y, freq, seed + o * 97) * amplitude;
        total += amplitude;
        amplitude *= 0.5;
        freq *= 2;
    }

    return sum / total;
}

function getCloudTexture(): THREE.Texture {
    if (sharedCloudTexture) return sharedCloudTexture;

    const size = CLOUD_TEXTURE_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const u = x / size;
            const v = y / size;
            const i = (y * size + x) * 4;
            image.data[i] = tileableFbm(u, v, 4, 4, 11) * 255;
            image.data[i + 1] = tileableFbm(u, v, 4, 4, 733) * 255;
            image.data[i + 2] = tileableFbm(u, v, 4, 4, 1571) * 255;
            image.data[i + 3] = tileableFbm(u, v, 3, 4, 2999) * 255;
        }
    }
    ctx.putImageData(image, 0, 0);

    sharedCloudTexture = new THREE.CanvasTexture(canvas);
    sharedCloudTexture.wrapS = THREE.RepeatWrapping;
    sharedCloudTexture.wrapT = THREE.RepeatWrapping;
    return sharedCloudTexture;
}

function getLavaTexture(): THREE.Texture {
    if (sharedLavaTexture) return sharedLavaTexture;

    const size = LAVA_TEXTURE_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(size, size);

    const stops = [
        { t: 0.0, r: 24, g: 6, b: 4 },
        { t: 0.35, r: 96, g: 16, b: 8 },
        { t: 0.58, r: 190, g: 52, b: 12 },
        { t: 0.78, r: 246, g: 132, b: 26 },
        { t: 1.0, r: 255, g: 232, b: 150 },
    ];

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const u = x / size;
            const v = y / size;

            const base = tileableFbm(u, v, 4, 5, 401);
            const veins = 1 - Math.abs(tileableFbm(u, v, 8, 4, 907) * 2 - 1);
            const heat = Math.min(1, Math.pow(base, 1.5) * 0.75 + Math.pow(veins, 4) * 0.9);

            let lower = stops[0];
            let upper = stops[stops.length - 1];
            for (let s = 0; s < stops.length - 1; s++) {
                if (heat >= stops[s].t && heat <= stops[s + 1].t) {
                    lower = stops[s];
                    upper = stops[s + 1];
                    break;
                }
            }
            const span = Math.max(1e-5, upper.t - lower.t);
            const k = Math.min(1, Math.max(0, (heat - lower.t) / span));

            const i = (y * size + x) * 4;
            image.data[i] = lower.r + (upper.r - lower.r) * k;
            image.data[i + 1] = lower.g + (upper.g - lower.g) * k;
            image.data[i + 2] = lower.b + (upper.b - lower.b) * k;
            image.data[i + 3] = 255;
        }
    }
    ctx.putImageData(image, 0, 0);

    sharedLavaTexture = new THREE.CanvasTexture(canvas);
    sharedLavaTexture.colorSpace = THREE.SRGBColorSpace;
    sharedLavaTexture.wrapS = THREE.RepeatWrapping;
    sharedLavaTexture.wrapT = THREE.RepeatWrapping;
    return sharedLavaTexture;
}

const lavaVertex = /* glsl */ `
uniform vec2 uvScale;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
    vUv = uvScale * uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const lavaFragment = /* glsl */ `
uniform float time;
uniform float fogDensity;
uniform vec3 fogColor;
uniform vec3 rimColor;
uniform sampler2D texture1;
uniform sampler2D texture2;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;

void main( void ) {
    vec4 noise = texture2D( texture1, vUv );
    vec2 T1 = vUv + vec2( 1.5, - 1.5 ) * time * 0.02;
    vec2 T2 = vUv + vec2( - 0.5, 2.0 ) * time * 0.01;

    T1.x += noise.x * 2.0;
    T1.y += noise.y * 2.0;
    T2.x -= noise.y * 0.2;
    T2.y += noise.z * 0.2;

    float p = texture2D( texture1, T1 * 2.0 ).a;

    vec4 color = texture2D( texture2, T2 * 2.0 );
    vec4 temp = color * ( vec4( p, p, p, p ) * 2.0 ) + ( color * color - 0.1 );

    if( temp.r > 1.0 ) { temp.bg += clamp( temp.r - 2.0, 0.0, 100.0 ); }
    if( temp.g > 1.0 ) { temp.rb += temp.g - 1.0; }
    if( temp.b > 1.0 ) { temp.rg += temp.b - 1.0; }

    gl_FragColor = temp;

    float facing = clamp( dot( normalize( vNormalView ), normalize( vViewDir ) ), 0.0, 1.0 );
    float fresnel = pow( 1.0 - facing, 2.6 );
    gl_FragColor.rgb += rimColor * fresnel * 1.5;

    float depth = gl_FragCoord.z / gl_FragCoord.w;
    const float LOG2 = 1.442695;
    float fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );
    fogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );

    gl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );
    gl_FragColor.a = 1.0;
}
`;

const coronaVertex = /* glsl */ `
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const coronaFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
    float facing = clamp(dot(normalize(vNormalView), normalize(vViewDir)), 0.0, 1.0);
    float rim = pow(1.0 - facing, 3.0);
    float flicker = 0.85 + 0.15 * sin(uTime * 2.3);
    gl_FragColor = vec4(uColor, rim * 0.75 * flicker);
}
`;

const ringVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vLocal;
void main() {
    vUv = uv;
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ringFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uTint;
uniform float uInnerRadius;
uniform float uOuterRadius;
varying vec3 vLocal;

void main() {
    float r = length(vLocal.xy);
    float t = (r - uInnerRadius) / max(uOuterRadius - uInnerRadius, 0.001);
    if (t < 0.0 || t > 1.0) discard;

    float angle = atan(vLocal.y, vLocal.x);
    float streaks = 0.5 + 0.5 * sin(angle * 26.0 - uTime * 1.8 + r * 0.08);
    float shell = smoothstep(0.0, 0.25, t) * (1.0 - smoothstep(0.55, 1.0, t));

    float alpha = shell * (0.25 + streaks * 0.55);
    gl_FragColor = vec4(uTint * (0.7 + streaks * 0.8), alpha);
}
`;

export class AdminCoreBubble {
    public readonly group: THREE.Group;

    private lava: THREE.Mesh;
    private corona: THREE.Mesh;
    private ring: THREE.Mesh;
    private light: THREE.PointLight;
    private time = 0;

    constructor(private radius: number) {
        this.group = new THREE.Group();

        this.lava = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 96, 64),
            new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 1 },
                    fogDensity: { value: 0 },
                    fogColor: { value: new THREE.Vector3(0, 0, 0) },
                    rimColor: { value: new THREE.Color(0xff7a1e) },
                    uvScale: { value: LAVA_UV_SCALE.clone() },
                    texture1: { value: getCloudTexture() },
                    texture2: { value: getLavaTexture() },
                },
                vertexShader: lavaVertex,
                fragmentShader: lavaFragment,
                fog: false,
            })
        );
        this.group.add(this.lava);

        this.corona = new THREE.Mesh(
            new THREE.SphereGeometry(radius * CORONA_SCALE, 48, 32),
            new THREE.ShaderMaterial({
                uniforms: {
                    uTime: { value: 0 },
                    uColor: { value: new THREE.Color(0xff9a3c) },
                },
                vertexShader: coronaVertex,
                fragmentShader: coronaFragment,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.BackSide,
                fog: false,
            })
        );
        this.group.add(this.corona);

        const ringOuter = radius * 3.1;
        this.ring = new THREE.Mesh(
            new THREE.RingGeometry(radius * 1.5, ringOuter, 128, 1),
            new THREE.ShaderMaterial({
                uniforms: {
                    uTime: { value: 0 },
                    uTint: { value: new THREE.Color(0xffb066) },
                    uInnerRadius: { value: radius * 1.5 },
                    uOuterRadius: { value: ringOuter },
                },
                vertexShader: ringVertex,
                fragmentShader: ringFragment,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                fog: false,
            })
        );
        this.ring.rotation.x = -Math.PI / 2 + 0.34;
        this.group.add(this.ring);

        this.light = new THREE.PointLight(0xffb968, 9, radius * 26, 1.5);
        this.group.add(this.light);
    }

    update(delta: number) {
        this.time += delta;

        (this.lava.material as THREE.ShaderMaterial).uniforms.time.value += delta * LAVA_TIME_SCALE;
        (this.corona.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
        (this.ring.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;

        this.lava.rotation.y += delta * 0.035;
        this.ring.rotation.z += delta * 0.08;
        this.light.intensity = 8 + Math.sin(this.time * 0.9) * 2;
    }

    dispose() {
        [this.lava, this.corona, this.ring].forEach((mesh) => {
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
        });
        this.group.removeFromParent();
    }
}
