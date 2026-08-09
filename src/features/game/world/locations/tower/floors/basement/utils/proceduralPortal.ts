// src/features/game/world/locations/tower/floors/basement/utils/proceduralPortal.ts
import * as THREE from "three";

const vortexVertex = /* glsl */ `
varying vec2 vLocal;
void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const vortexFragment = /* glsl */ `
uniform float uTime;
uniform float uRadius;
uniform vec3 uInner;
uniform vec3 uOuter;
varying vec2 vLocal;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

void main() {
    float r = length(vLocal) / uRadius;
    if (r > 1.0) discard;

    float angle = atan(vLocal.y, vLocal.x);
    float swirl = angle + (1.0 - r) * 5.0 - uTime * 0.7;

    float arms = 0.5 + 0.5 * sin(swirl * 3.0);
    float turbulence = noise(vec2(swirl * 1.4, r * 6.0 - uTime * 0.9));

    float core = smoothstep(0.55, 0.0, r);
    float ring = smoothstep(1.0, 0.72, r) * (1.0 - smoothstep(0.72, 0.42, r));

    vec3 color = mix(uOuter, uInner, core);
    color += uInner * arms * 0.5 * (1.0 - r);
    color += vec3(0.7, 0.9, 1.0) * ring * 0.9;

    float alpha = (core * 0.85 + ring * 0.95 + arms * 0.22 * (1.0 - r)) * (0.55 + turbulence * 0.45);
    alpha *= smoothstep(1.0, 0.9, r);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
}
`;

export interface ProceduralPortal {
    group: THREE.Group;
    update: (delta: number) => void;
    dispose: () => void;
}

export function createProceduralPortal(options: {
    radius: number;
    inner: number;
    outer: number;
    ringColor: number;
    facing: "down" | "up";
}): ProceduralPortal {
    const group = new THREE.Group();
    const uniforms = {
        uTime: { value: 0 },
        uRadius: { value: options.radius },
        uInner: { value: new THREE.Color(options.inner) },
        uOuter: { value: new THREE.Color(options.outer) },
    };

    const vortex = new THREE.Mesh(
        new THREE.CircleGeometry(options.radius, 96),
        new THREE.ShaderMaterial({
            uniforms,
            vertexShader: vortexVertex,
            fragmentShader: vortexFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            fog: false,
        })
    );
    vortex.rotation.x = options.facing === "down" ? Math.PI / 2 : -Math.PI / 2;
    group.add(vortex);

    const rimMaterial = new THREE.MeshStandardMaterial({
        color: options.ringColor,
        emissive: options.ringColor,
        emissiveIntensity: 2.6,
        roughness: 0.32,
        metalness: 0.55,
    });

    const rim = new THREE.Mesh(new THREE.TorusGeometry(options.radius, options.radius * 0.045, 12, 96), rimMaterial);
    rim.rotation.x = Math.PI / 2;
    group.add(rim);

    const outerRim = new THREE.Mesh(
        new THREE.TorusGeometry(options.radius * 1.14, options.radius * 0.018, 8, 96),
        rimMaterial
    );
    outerRim.rotation.x = Math.PI / 2;
    group.add(outerRim);

    const shards: THREE.Mesh[] = [];
    const shardGeometry = new THREE.OctahedronGeometry(options.radius * 0.07, 0);
    for (let i = 0; i < 10; i++) {
        const shard = new THREE.Mesh(shardGeometry, rimMaterial);
        const angle = (i / 10) * Math.PI * 2;
        shard.position.set(
            Math.cos(angle) * options.radius * 1.22,
            0,
            Math.sin(angle) * options.radius * 1.22
        );
        shard.userData.angle = angle;
        group.add(shard);
        shards.push(shard);
    }

    let time = 0;

    return {
        group,
        update: (delta: number) => {
            time += delta;
            uniforms.uTime.value = time;
            rim.rotation.z += delta * 0.25;
            outerRim.rotation.z -= delta * 0.4;
            rimMaterial.emissiveIntensity = 2.2 + Math.sin(time * 1.6) * 0.6;

            shards.forEach((shard, i) => {
                const angle = (shard.userData.angle as number) + time * 0.22;
                const bob = Math.sin(time * 1.4 + i) * options.radius * 0.06;
                shard.position.set(
                    Math.cos(angle) * options.radius * 1.22,
                    bob,
                    Math.sin(angle) * options.radius * 1.22
                );
                shard.rotation.y += delta * 0.9;
                shard.rotation.x += delta * 0.5;
            });
        },
        dispose: () => {
            vortex.geometry.dispose();
            (vortex.material as THREE.Material).dispose();
            rim.geometry.dispose();
            outerRim.geometry.dispose();
            shardGeometry.dispose();
            rimMaterial.dispose();
            group.removeFromParent();
        },
    };
}
