// src/features/game/world/liftCrystal.ts
import * as THREE from "three";

const shellVertexShader = /* glsl */`
    varying vec3 vNormalW;
    varying vec3 vViewW;

    void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewW = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

const shellFragmentShader = /* glsl */`
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec3 uRimColor;

    varying vec3 vNormalW;
    varying vec3 vViewW;

    void main() {
        float facing = abs(dot(normalize(vNormalW), normalize(vViewW)));
        float fresnel = pow(1.0 - facing, 2.4);
        float pulse = 0.85 + 0.15 * sin(uTime * 1.8);

        vec3 color = mix(uColor, uRimColor, fresnel);
        float alpha = (0.12 + fresnel * 0.7) * pulse;
        gl_FragColor = vec4(color, alpha);
    }
`;

function createHaloTexture(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(190,238,255,0.95)");
    gradient.addColorStop(0.35, "rgba(102,204,255,0.35)");
    gradient.addColorStop(1, "rgba(102,204,255,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export class LiftCrystal {
    public readonly group: THREE.Group;

    private readonly core: THREE.Mesh;
    private readonly shell: THREE.Mesh;
    private readonly halo: THREE.Sprite;
    private readonly light: THREE.PointLight;
    private readonly shellUniforms;
    private readonly haloTexture: THREE.CanvasTexture;

    private time = 0;

    constructor() {
        this.group = new THREE.Group();

        this.core = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.8, 1),
            new THREE.MeshStandardMaterial({
                color: 0x66ccff,
                emissive: 0x3399ff,
                emissiveIntensity: 2.4,
                roughness: 0.15,
                metalness: 0.1,
                toneMapped: false,
            })
        );
        this.core.name = "crystal-core";
        this.core.position.y = 1.5;
        this.core.castShadow = true;

        this.shellUniforms = {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(0x99ddff) },
            uRimColor: { value: new THREE.Color(0xe6f8ff) },
        };

        this.shell = new THREE.Mesh(
            new THREE.OctahedronGeometry(1.5, 1),
            new THREE.ShaderMaterial({
                uniforms: this.shellUniforms,
                vertexShader: shellVertexShader,
                fragmentShader: shellFragmentShader,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                fog: false,
                toneMapped: false,
            })
        );
        this.shell.name = "crystal-shell";
        this.shell.position.y = 1.5;

        this.haloTexture = createHaloTexture();
        this.halo = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: this.haloTexture,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                fog: false,
                toneMapped: false,
            })
        );
        this.halo.position.y = 1.5;
        this.halo.scale.setScalar(6.5);

        this.light = new THREE.PointLight(0x66ccff, 9, 45);
        this.light.position.y = 1.5;
        this.light.castShadow = false;

        this.group.add(this.core, this.shell, this.halo, this.light);
    }

    public update(delta: number) {
        this.time += delta;

        this.core.rotation.y += delta * 0.6;
        this.core.rotation.x += delta * 0.18;
        this.shell.rotation.y -= delta * 0.24;

        const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.6);
        this.halo.scale.setScalar(6.1 + pulse * 0.9);
        this.halo.material.opacity = 0.55 + pulse * 0.25;
        this.light.intensity = 8 + pulse * 3;
        this.shellUniforms.uTime.value = this.time;
    }

    public dispose() {
        this.group.removeFromParent();
        this.core.geometry.dispose();
        (this.core.material as THREE.Material).dispose();
        this.shell.geometry.dispose();
        (this.shell.material as THREE.Material).dispose();
        this.halo.material.dispose();
        this.haloTexture.dispose();
    }
}
