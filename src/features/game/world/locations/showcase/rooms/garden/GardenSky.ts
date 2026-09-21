// src/features/game/world/locations/showcase/rooms/garden/GardenSky.ts
import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { AssetBin } from "../../../../AssetBin";
import { birdTexture, type GardenSurfaceTextures } from "./gardenTextures";
import {
    GARDEN_EXPOSURE,
    GARDEN_FOG_COLOR,
    GARDEN_GROUND_COLOR,
    GARDEN_SKY_COLOR,
    GARDEN_SUN_COLOR,
    GARDEN_SUN_DIRECTION,
    GARDEN_SUN_POSITION,
} from "./gardenShading";

const SKY_SCALE = 900;
const FLOCK_SIZE = 22;

interface Bird {
    sprite: THREE.Sprite;
    radius: number;
    height: number;
    speed: number;
    phase: number;
    bob: number;
}

export class GardenSky {
    private sky: Sky | null = null;
    private sun: THREE.DirectionalLight | null = null;
    private environment: THREE.Texture | null = null;
    private birds: Bird[] = [];
    private elapsed = 0;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly bin: AssetBin,
        private readonly random: () => number,
        private readonly fieldRadius: number,
        private readonly shadowRes: number
    ) { }

    public create(renderer: THREE.WebGLRenderer | undefined, textures: GardenSurfaceTextures) {
        this.buildLights();
        this.buildSky(renderer);
        this.buildHorizon();
        this.buildHills(textures);
        this.buildFlock();
    }

    private buildLights() {
        this.scene.add(new THREE.HemisphereLight(GARDEN_SKY_COLOR, GARDEN_GROUND_COLOR, GARDEN_EXPOSURE.hemisphere));

        const sun = new THREE.DirectionalLight(GARDEN_SUN_COLOR, GARDEN_EXPOSURE.sun);
        sun.position.copy(GARDEN_SUN_POSITION);
        sun.target.position.set(0, 0, 4);

        if (this.shadowRes > 0) {
            sun.castShadow = true;
            sun.shadow.mapSize.set(this.shadowRes, this.shadowRes);
            sun.shadow.camera.left = -this.fieldRadius;
            sun.shadow.camera.right = this.fieldRadius;
            sun.shadow.camera.top = this.fieldRadius;
            sun.shadow.camera.bottom = -this.fieldRadius;
            sun.shadow.camera.near = 8;
            sun.shadow.camera.far = 260;
            sun.shadow.bias = -0.00035;
            sun.shadow.normalBias = 0.05;
            sun.shadow.camera.updateProjectionMatrix();
        }

        this.scene.add(sun);
        this.scene.add(sun.target);
        this.sun = sun;

        const bounce = new THREE.DirectionalLight(0xc7e9ad, GARDEN_EXPOSURE.bounce);
        bounce.position.set(44, 16, 54);
        this.scene.add(bounce);
    }

    private buildSky(renderer: THREE.WebGLRenderer | undefined) {
        const sky = new Sky();
        sky.scale.setScalar(SKY_SCALE);

        const material = sky.material as THREE.ShaderMaterial;
        material.uniforms.turbidity.value = 3.4;
        material.uniforms.rayleigh.value = 1.5;
        material.uniforms.mieCoefficient.value = 0.006;
        material.uniforms.mieDirectionalG.value = 0.78;
        material.uniforms.cloudScale.value = 0.00022;
        material.uniforms.cloudSpeed.value = 0.00006;
        material.uniforms.cloudCoverage.value = 0.52;
        material.uniforms.cloudDensity.value = 0.62;
        material.uniforms.cloudElevation.value = 0.42;
        material.uniforms.sunPosition.value.copy(GARDEN_SUN_DIRECTION).multiplyScalar(100);
        material.uniforms.showSunDisc.value = 0;
        material.uniforms.uSkyGain = { value: GARDEN_EXPOSURE.skyGain };
        material.fragmentShader = material.fragmentShader
            .replace("uniform float time;", "uniform float time;\nuniform float uSkyGain;")
            .replace("gl_FragColor = vec4( texColor, 1.0 );", "gl_FragColor = vec4( texColor * uSkyGain, 1.0 );");
        material.needsUpdate = true;

        this.scene.add(sky);
        this.sky = sky;

        if (renderer) {
            const generator = new THREE.PMREMGenerator(renderer);
            const capture = new THREE.Scene();
            capture.add(sky);
            const target = generator.fromScene(capture, 0, 1, 2400);
            this.scene.add(sky);

            this.environment = target.texture;
            this.scene.environment = target.texture;
            this.scene.environmentIntensity = GARDEN_EXPOSURE.environment;
            generator.dispose();
        }

        material.uniforms.showSunDisc.value = 1;
    }

    private buildHorizon() {
        const material = this.bin.material(new THREE.MeshBasicMaterial({
            color: GARDEN_FOG_COLOR,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            fog: false,
        }));

        const geometry = this.bin.geometry(new THREE.CylinderGeometry(340, 340, 150, 48, 1, true));
        const position = geometry.getAttribute("position");
        const alpha = new Float32Array(position.count);

        for (let i = 0; i < position.count; i++) {
            const y = position.getY(i);
            alpha[i] = THREE.MathUtils.clamp(1 - (y + 75) / 150, 0, 1);
        }

        geometry.setAttribute("aFade", new THREE.BufferAttribute(alpha, 1));

        material.onBeforeCompile = (shader) => {
            shader.vertexShader = shader.vertexShader
                .replace("#include <common>", "#include <common>\nattribute float aFade;\nvarying float vFade;")
                .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFade = aFade;");
            shader.fragmentShader = shader.fragmentShader
                .replace("#include <common>", "#include <common>\nvarying float vFade;")
                .replace(
                    "#include <opaque_fragment>",
                    "diffuseColor.a *= pow(vFade, 1.6);\n#include <opaque_fragment>"
                );
        };
        material.customProgramCacheKey = () => "garden-horizon-band";

        const band = new THREE.Mesh(geometry, material);
        band.position.y = 44;
        band.renderOrder = -1;
        this.scene.add(band);
    }

    private buildHills(textures: GardenSurfaceTextures) {
        const map = textures.lawn.map.clone();
        map.repeat.set(7, 7);
        map.needsUpdate = true;
        this.bin.texture(map);

        const material = this.bin.material(new THREE.MeshStandardMaterial({
            map,
            color: 0x8fae74,
            roughness: 1,
            metalness: 0,
        }));

        const far = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x9ec1a6,
            roughness: 1,
            metalness: 0,
        }));

        for (let i = 0; i < 18; i++) {
            const angle = (i / 18) * Math.PI * 2 + this.random() * 0.24;
            const distance = this.fieldRadius + 30 + this.random() * 46;
            const radius = 18 + this.random() * 28;
            const hill = new THREE.Mesh(
                this.bin.geometry(new THREE.SphereGeometry(radius, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)),
                i % 3 === 0 ? far : material
            );
            hill.position.set(Math.cos(angle) * distance, -radius * (0.48 + this.random() * 0.2), Math.sin(angle) * distance);
            hill.scale.set(1, 0.62 + this.random() * 0.4, 1);
            hill.castShadow = false;
            hill.receiveShadow = false;
            this.scene.add(hill);
        }

        for (let i = 0; i < 9; i++) {
            const angle = (i / 9) * Math.PI * 2 + 0.7;
            const distance = this.fieldRadius + 120 + this.random() * 80;
            const radius = 46 + this.random() * 44;
            const ridge = new THREE.Mesh(
                this.bin.geometry(new THREE.SphereGeometry(radius, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
                far
            );
            ridge.position.set(Math.cos(angle) * distance, -radius * 0.55, Math.sin(angle) * distance);
            ridge.scale.set(1.4, 0.5, 1.4);
            ridge.castShadow = false;
            ridge.receiveShadow = false;
            this.scene.add(ridge);
        }
    }

    private buildFlock() {
        const map = birdTexture(this.bin);
        const material = this.bin.material(new THREE.SpriteMaterial({
            map,
            transparent: true,
            depthWrite: false,
            fog: false,
            opacity: 0.75,
        }));

        for (let i = 0; i < FLOCK_SIZE; i++) {
            const sprite = new THREE.Sprite(material);
            const size = 1.6 + this.random() * 1.4;
            sprite.scale.set(size, size * 0.5, 1);
            this.scene.add(sprite);

            this.birds.push({
                sprite,
                radius: 60 + this.random() * 90,
                height: 42 + this.random() * 40,
                speed: 0.06 + this.random() * 0.07,
                phase: this.random() * Math.PI * 2,
                bob: this.random() * Math.PI * 2,
            });
        }
    }

    public update(delta: number) {
        this.elapsed += delta;

        if (this.sky) {
            (this.sky.material as THREE.ShaderMaterial).uniforms.time.value = this.elapsed;
        }

        for (const bird of this.birds) {
            const angle = this.elapsed * bird.speed + bird.phase;
            bird.sprite.position.set(
                Math.cos(angle) * bird.radius,
                bird.height + Math.sin(this.elapsed * 0.6 + bird.bob) * 3.2,
                Math.sin(angle) * bird.radius
            );
        }
    }

    public get sunLight(): THREE.DirectionalLight | null {
        return this.sun;
    }

    public dispose() {
        if (this.sky) {
            this.scene.remove(this.sky);
            this.sky.geometry.dispose();
            (this.sky.material as THREE.Material).dispose();
        }
        this.sky = null;
        this.sun = null;
        this.birds = [];
        this.scene.environment = null;
        this.environment?.dispose();
        this.environment = null;
    }
}
