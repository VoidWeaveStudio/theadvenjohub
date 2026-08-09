// src/features/game/world/locations/tower/floors/token-gates/galaxy/AdminCoreBubble.ts
import * as THREE from "three";

const plasmaVertex = /* glsl */ `
varying vec3 vLocal;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
    vLocal = normalize(position);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const plasmaFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uInner;
uniform vec3 uOuter;
varying vec3 vLocal;
varying vec3 vNormalView;
varying vec3 vViewDir;

float wave(vec3 p, float t) {
    return sin(p.x * 3.1 + t) * sin(p.y * 2.7 - t * 0.8) * sin(p.z * 3.6 + t * 0.6);
}

float turbulence(vec3 p, float t) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
        sum += abs(wave(p, t)) * amp;
        p *= 1.9;
        t *= 1.15;
        amp *= 0.55;
    }
    return sum;
}

void main() {
    float swirl = turbulence(vLocal * 1.6 + vec3(0.0, uTime * 0.06, 0.0), uTime * 0.5);
    float bands = 0.5 + 0.5 * sin(vLocal.y * 9.0 - uTime * 1.1 + swirl * 5.0);

    float facing = clamp(dot(normalize(vNormalView), normalize(vViewDir)), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 2.0);

    vec3 color = mix(uInner, uOuter, clamp(swirl * 1.5, 0.0, 1.0));
    color += uOuter * bands * 0.35;
    color += vec3(1.0, 0.92, 0.75) * fresnel * 1.4;

    gl_FragColor = vec4(color, 1.0);
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

    private plasma: THREE.Mesh;
    private ring: THREE.Mesh;
    private light: THREE.PointLight;
    private time = 0;

    constructor(private radius: number) {
        this.group = new THREE.Group();

        this.plasma = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 64, 48),
            new THREE.ShaderMaterial({
                uniforms: {
                    uTime: { value: 0 },
                    uInner: { value: new THREE.Color(0xff9a2e) },
                    uOuter: { value: new THREE.Color(0xffe9a8) },
                },
                vertexShader: plasmaVertex,
                fragmentShader: plasmaFragment,
                fog: false,
            })
        );
        this.group.add(this.plasma);

        const ringOuter = radius * 3.1;
        this.ring = new THREE.Mesh(
            new THREE.RingGeometry(radius * 1.5, ringOuter, 128, 1),
            new THREE.ShaderMaterial({
                uniforms: {
                    uTime: { value: 0 },
                    uTint: { value: new THREE.Color(0xffd9a0) },
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

        (this.plasma.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
        (this.ring.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;

        this.plasma.rotation.y += delta * 0.06;
        this.ring.rotation.z += delta * 0.08;
        this.light.intensity = 8 + Math.sin(this.time * 0.9) * 2;
    }

    dispose() {
        [this.plasma, this.ring].forEach((mesh) => {
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
        });
        this.group.removeFromParent();
    }
}
