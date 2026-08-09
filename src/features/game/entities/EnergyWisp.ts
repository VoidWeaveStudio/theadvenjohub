// src/features/game/entities/EnergyWisp.ts
import * as THREE from "three";

const TRAIL_POINTS = 90;
const SPARK_COUNT = 5;
const TRAIL_MIN_STEP = 0.28;
const FORWARD = new THREE.Vector3(0, 0, 1);

let sharedGlowTexture: THREE.Texture | null = null;

function getGlowTexture(): THREE.Texture {
    if (sharedGlowTexture) return sharedGlowTexture;

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(200,238,255,0.42)");
    gradient.addColorStop(0.25, "rgba(120,195,240,0.16)");
    gradient.addColorStop(0.55, "rgba(60,130,220,0.04)");
    gradient.addColorStop(1, "rgba(30,70,160,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    sharedGlowTexture = new THREE.CanvasTexture(canvas);
    return sharedGlowTexture;
}

const trailVertex = /* glsl */ `
attribute float aAge;
attribute float aPower;
varying float vAlpha;
varying float vPower;
varying float vAge;
void main() {
    vAge = aAge;
    vAlpha = clamp(1.0 - aAge, 0.0, 1.0);
    vPower = aPower;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float taper = pow(vAlpha, 0.65);
    gl_PointSize = clamp((2.0 + aPower * 5.0) * taper * (220.0 / max(-mvPosition.z, 1.0)), 0.0, 34.0);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const trailFragment = /* glsl */ `
varying float vAlpha;
varying float vPower;
varying float vAge;
void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float falloff = smoothstep(0.5, 0.05, d);
    vec3 head = vec3(0.78, 0.92, 1.0);
    vec3 tail = vec3(0.18, 0.42, 0.85);
    vec3 color = mix(head, tail, vAge);
    color = mix(color, vec3(0.95, 0.85, 0.65), vPower * 0.35);
    gl_FragColor = vec4(color, falloff * vAlpha * (0.10 + vPower * 0.12));
}
`;

const cometVertex = /* glsl */ `
varying float vAlong;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
    vAlong = clamp(-position.z, 0.0, 1.0);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const cometFragment = /* glsl */ `
uniform float uPower;
uniform float uTime;
varying float vAlong;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
    float facing = clamp(dot(normalize(vNormalView), normalize(vViewDir)), 0.0, 1.0);
    float rim = pow(1.0 - facing, 1.6);
    float fade = pow(1.0 - vAlong, 1.8);
    float ripple = 0.75 + 0.25 * sin(vAlong * 26.0 - uTime * 9.0);

    vec3 color = mix(vec3(0.35, 0.72, 1.0), vec3(0.85, 0.94, 1.0), uPower);
    float alpha = fade * rim * ripple * uPower * 0.55;
    gl_FragColor = vec4(color, alpha);
}
`;

export class EnergyWisp {
    public readonly group: THREE.Group;

    private align: THREE.Group;
    private core: THREE.Mesh;
    private shell: THREE.Mesh;
    private comet: THREE.Mesh;
    private corona: THREE.Sprite;
    private sparks: THREE.Mesh[] = [];
    private light: THREE.PointLight | null;

    private trail: THREE.Points | null = null;
    private trailScene: THREE.Scene | null = null;
    private trailPositions!: Float32Array;
    private trailAges!: Float32Array;
    private trailPowers!: Float32Array;
    private trailHead = 0;
    private trailFilled = 0;
    private lastTrailPoint = new THREE.Vector3();

    private time = 0;
    private power = 0;

    private static readonly _world = new THREE.Vector3();
    private static readonly _dir = new THREE.Vector3();
    private static readonly _worldQuat = new THREE.Quaternion();
    private static readonly _parentQuat = new THREE.Quaternion();
    private static readonly _targetQuat = new THREE.Quaternion();

    constructor(options: { withTrail: boolean; withLight: boolean }) {
        this.group = new THREE.Group();
        this.group.visible = false;

        this.align = new THREE.Group();
        this.group.add(this.align);

        this.core = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.3, 3),
            new THREE.MeshBasicMaterial({ color: 0x9fd8f2, fog: false })
        );
        this.align.add(this.core);

        this.shell = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.58, 1),
            new THREE.MeshBasicMaterial({
                color: 0x4aa8e0,
                transparent: true,
                opacity: 0.14,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                wireframe: true,
                fog: false,
            })
        );
        this.align.add(this.shell);

        const cometGeometry = new THREE.ConeGeometry(0.52, 1, 18, 1, true);
        cometGeometry.rotateX(Math.PI / 2);
        cometGeometry.translate(0, 0, -0.5);
        this.comet = new THREE.Mesh(
            cometGeometry,
            new THREE.ShaderMaterial({
                uniforms: {
                    uPower: { value: 0 },
                    uTime: { value: 0 },
                },
                vertexShader: cometVertex,
                fragmentShader: cometFragment,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                fog: false,
            })
        );
        this.align.add(this.comet);

        this.corona = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: getGlowTexture(),
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                fog: false,
            })
        );
        this.corona.scale.setScalar(1.0);
        this.group.add(this.corona);

        const sparkGeometry = new THREE.SphereGeometry(0.07, 6, 5);
        const sparkMaterial = new THREE.MeshBasicMaterial({
            color: 0xa8e8ff,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false,
        });
        for (let i = 0; i < SPARK_COUNT; i++) {
            const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
            this.align.add(spark);
            this.sparks.push(spark);
        }

        this.light = options.withLight ? new THREE.PointLight(0x6fd8ff, 0.5, 12, 1.8) : null;
        if (this.light) this.group.add(this.light);

        if (options.withTrail) this.buildTrail();
    }

    private buildTrail() {
        this.trailPositions = new Float32Array(TRAIL_POINTS * 3);
        this.trailAges = new Float32Array(TRAIL_POINTS).fill(1);
        this.trailPowers = new Float32Array(TRAIL_POINTS);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(this.trailPositions, 3));
        geometry.setAttribute("aAge", new THREE.BufferAttribute(this.trailAges, 1));
        geometry.setAttribute("aPower", new THREE.BufferAttribute(this.trailPowers, 1));

        const material = new THREE.ShaderMaterial({
            vertexShader: trailVertex,
            fragmentShader: trailFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false,
        });

        this.trail = new THREE.Points(geometry, material);
        this.trail.frustumCulled = false;
        this.trail.renderOrder = 6;
    }

    public attach(parent: THREE.Object3D, scene: THREE.Scene | null) {
        parent.add(this.group);
        if (this.trail && scene) {
            scene.add(this.trail);
            this.trailScene = scene;
        }
    }

    public moveTrailToScene(scene: THREE.Scene) {
        if (!this.trail) return;
        this.trailScene?.remove(this.trail);
        scene.add(this.trail);
        this.trailScene = scene;
        this.resetTrail();
    }

    public setActive(active: boolean) {
        if (this.group.visible === active) return;
        this.group.visible = active;
        if (this.trail) this.trail.visible = active;
        if (!active) this.resetTrail();
    }

    public isActive(): boolean {
        return this.group.visible;
    }

    private resetTrail() {
        if (!this.trail) return;
        this.trailAges.fill(1);
        this.trailFilled = 0;
        this.trailHead = 0;
        this.trail.geometry.attributes.aAge.needsUpdate = true;
    }

    private alignToVelocity(worldVelocity: THREE.Vector3) {
        if (worldVelocity.lengthSq() < 0.04) return;

        EnergyWisp._dir.copy(worldVelocity).normalize();
        EnergyWisp._worldQuat.setFromUnitVectors(FORWARD, EnergyWisp._dir);

        const parent = this.group.parent;
        if (parent) {
            parent.getWorldQuaternion(EnergyWisp._parentQuat);
            EnergyWisp._targetQuat.copy(EnergyWisp._parentQuat).invert().multiply(EnergyWisp._worldQuat);
        } else {
            EnergyWisp._targetQuat.copy(EnergyWisp._worldQuat);
        }

        this.align.quaternion.slerp(EnergyWisp._targetQuat, 0.25);
    }

    update(delta: number, speedRatio: number, boosting: boolean, worldVelocity: THREE.Vector3) {
        if (!this.group.visible) return;

        this.time += delta;
        const target = THREE.MathUtils.clamp(speedRatio, 0, 1) * (boosting ? 1 : 0.75);
        this.power += (target - this.power) * Math.min(1, 6 * delta);

        this.alignToVelocity(worldVelocity);

        const pulse = 1 + Math.sin(this.time * 6) * 0.05;
        const stretch = 1 + this.power * 2.6;
        const squash = 1 / Math.sqrt(stretch);

        this.core.scale.set(pulse * squash, pulse * squash, pulse * stretch);
        this.shell.scale.set(squash, squash, stretch);
        this.shell.rotation.z += delta * (0.8 + this.power * 5);

        this.comet.scale.set(1 + this.power * 0.4, 1 + this.power * 0.4, 2.5 + this.power * 9);
        const cometMaterial = this.comet.material as THREE.ShaderMaterial;
        cometMaterial.uniforms.uPower.value = this.power;
        cometMaterial.uniforms.uTime.value = this.time;
        this.comet.visible = this.power > 0.02;

        this.corona.scale.setScalar(0.95 + this.power * 0.3 + Math.sin(this.time * 4) * 0.04);
        (this.corona.material as THREE.SpriteMaterial).opacity = 0.13 + this.power * 0.1;

        const coreMaterial = this.core.material as THREE.MeshBasicMaterial;
        coreMaterial.color.setRGB(0.5 + this.power * 0.24, 0.76 + this.power * 0.14, 0.95);

        this.sparks.forEach((spark, i) => {
            const angle = this.time * (2.4 + i * 0.5) + (i / SPARK_COUNT) * Math.PI * 2;
            const radius = 0.55 + Math.sin(this.time * 3 + i) * 0.12 + this.power * 0.35;
            spark.position.set(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                -0.3 - this.power * (1.6 + (i % 3) * 0.9)
            );
            spark.scale.setScalar(0.35 + this.power * 0.45);
        });

        if (this.light) {
            this.light.intensity = 0.45 + this.power * 0.5;
            this.light.distance = 11 + this.power * 6;
        }

        this.updateTrail(delta);
    }

    private updateTrail(delta: number) {
        if (!this.trail) return;

        for (let i = 0; i < TRAIL_POINTS; i++) {
            this.trailAges[i] = Math.min(1, this.trailAges[i] + delta * 0.9);
        }

        this.group.getWorldPosition(EnergyWisp._world);
        if (this.trailFilled === 0 || this.lastTrailPoint.distanceTo(EnergyWisp._world) > TRAIL_MIN_STEP) {
            const offset = this.trailHead * 3;
            this.trailPositions[offset] = EnergyWisp._world.x;
            this.trailPositions[offset + 1] = EnergyWisp._world.y;
            this.trailPositions[offset + 2] = EnergyWisp._world.z;
            this.trailAges[this.trailHead] = 0;
            this.trailPowers[this.trailHead] = this.power;

            this.trailHead = (this.trailHead + 1) % TRAIL_POINTS;
            this.trailFilled = Math.min(TRAIL_POINTS, this.trailFilled + 1);
            this.lastTrailPoint.copy(EnergyWisp._world);

            this.trail.geometry.attributes.position.needsUpdate = true;
            this.trail.geometry.attributes.aPower.needsUpdate = true;
        }

        this.trail.geometry.attributes.aAge.needsUpdate = true;
        this.trail.geometry.setDrawRange(0, this.trailFilled);
    }

    dispose() {
        this.group.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh) {
                mesh.geometry.dispose();
                (mesh.material as THREE.Material).dispose();
            }
        });
        (this.corona.material as THREE.SpriteMaterial).dispose();
        this.group.removeFromParent();

        if (this.trail) {
            this.trail.geometry.dispose();
            (this.trail.material as THREE.Material).dispose();
            this.trailScene?.remove(this.trail);
            this.trail = null;
        }
    }
}
