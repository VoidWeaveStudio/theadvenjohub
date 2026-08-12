// src/features/game/world/locations/tower/floors/main-hall/systems/HallSky.ts
import * as THREE from "three";
import { EditorSky } from "../../../../../building/EditorSky";
import { AssetBin } from "../utils/assetBin";
import { createLightShaftMaterial } from "../textures";
import { VAULT_HEIGHT, isLowEndDevice } from "../layout";

const SUN_ELEVATION = THREE.MathUtils.degToRad(29);
const SUN_AZIMUTH = THREE.MathUtils.degToRad(126);

const SHAFT_BOTTOM_Y = 3.2;
const OCULUS_RADIUS = 11;

export class HallSky {
    private sky: EditorSky | null = null;
    private shafts: THREE.Mesh | null = null;
    private elapsed = 0;

    public readonly sunDirection = new THREE.Vector3();

    constructor(
        private readonly scene: THREE.Scene,
        private readonly bin: AssetBin
    ) { }

    create() {
        this.sunDirection.set(
            Math.cos(SUN_ELEVATION) * Math.sin(SUN_AZIMUTH),
            Math.sin(SUN_ELEVATION),
            Math.cos(SUN_ELEVATION) * Math.cos(SUN_AZIMUTH)
        );

        this.sky = new EditorSky();
        this.sky.name = "hall-sky";
        this.sky.scale.setScalar(14000);
        this.sky.renderOrder = -1000;
        this.sky.frustumCulled = false;

        const uniforms = this.sky.material.uniforms;
        uniforms.turbidity.value = 6;
        uniforms.rayleigh.value = 2.1;
        uniforms.mieCoefficient.value = 0.005;
        uniforms.mieDirectionalG.value = 0.78;
        uniforms.sunPosition.value.copy(this.sunDirection).multiplyScalar(1000);
        uniforms.cloudScale.value = 0.003;
        uniforms.cloudSpeed.value = 0.00006;
        uniforms.cloudCoverage.value = 0.55;
        uniforms.cloudDensity.value = 0.85;
        uniforms.cloudElevation.value = 0.5;
        uniforms.showSunDisc.value = 1;

        this.scene.add(this.sky);

        if (!isLowEndDevice()) this.createShafts();
    }


    private createShafts() {
        const bottom = SHAFT_BOTTOM_Y;
        const height = VAULT_HEIGHT - 2 - bottom;

        const geometry = this.bin.geometry(
            new THREE.CylinderGeometry(OCULUS_RADIUS * 0.78, OCULUS_RADIUS * 1.35, height, 48, 1, true)
        );

        const mesh = new THREE.Mesh(geometry, createLightShaftMaterial(this.bin));
        mesh.name = "light-shafts";
        mesh.position.y = bottom + height / 2;
        mesh.renderOrder = 6;
        mesh.frustumCulled = false;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();

        this.scene.add(mesh);
        this.shafts = mesh;
    }

    setShaftsVisible(visible: boolean) {
        if (this.shafts) this.shafts.visible = visible;
    }

    update(delta: number) {
        this.elapsed += delta;
        if (this.sky) this.sky.material.uniforms.time.value = this.elapsed;
    }

    dispose() {
        if (this.sky) {
            this.scene.remove(this.sky);
            this.sky.geometry.dispose();
            this.sky.material.dispose();
            this.sky = null;
        }
        this.shafts = null;
    }
}
