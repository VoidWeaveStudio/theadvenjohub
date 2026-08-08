// src/features/game/world/locations/tower/floors/MainHall.ts
import * as THREE from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";
import { createHullPanelMaterial, disposeMaterialMaps } from "./mainHallTextures";
import { createMainHallNpcs, MainHallNpc } from "./mainHallNpcs";
import {
    buildPlazaFloor,
    buildPerimeter,
    buildCityBlocks,
    buildSkyDome,
    buildHoloCanopy,
    buildBuildings,
    BuildingHandles,
    CityHandles,
    CrystalData,
} from "./mainHallArchitecture";
import { PLAZA_RADIUS } from "./mainHallLayout";

export class MainHall extends TowerFloor {
    public readonly hallRadius = 92;

    private crystals: CrystalData[] = [];
    private resourceManager!: ResourceManager;
    private npcs: MainHallNpc[] = [];
    private buildings!: BuildingHandles;
    private city!: CityHandles;

    private floorMaterial!: THREE.MeshStandardMaterial;
    private hullMaterial!: THREE.MeshStandardMaterial;
    private skyMaterial!: THREE.MeshBasicMaterial;
    private dustMotes: THREE.Points | null = null;
    private daisGlow: THREE.Mesh | null = null;
    private crystalRings: THREE.Mesh[] = [];

    constructor() {
        super("tower-main-hall", "Gloomy Tower Main Hall");
    }

    create(rm: ResourceManager) {
        this.resourceManager = rm;
        const bgColor = 0x54648f;
        this.scene.background = new THREE.Color(bgColor);
        this.scene.fog = new THREE.FogExp2(0x6c7ba8, 0.0022);

        const ambient = new THREE.AmbientLight(0xb9cdec, 1.35);
        this.scene.add(ambient);
        const hemiLight = new THREE.HemisphereLight(0xd6ecff, 0x6a5f96, 1.25);
        this.scene.add(hemiLight);

        this.createKeyLight();

        this.hullMaterial = createHullPanelMaterial();

        const radius = this.hallRadius;

        this.floorMaterial = buildPlazaFloor(this.scene, radius);
        buildPerimeter(this.scene, this.collisionGrid, radius, this.hullMaterial);
        this.city = buildCityBlocks(this.scene, this.collisionGrid, radius);
        this.skyMaterial = buildSkyDome(this.scene, radius);
        this.crystals = buildHoloCanopy(this.scene);
        this.buildings = buildBuildings(this.scene, this.collisionGrid);

        this.createCentralCrystal();
        this.npcs = createMainHallNpcs(this.scene, this.collisionGrid, this.resourceManager);
        this.createDustMotes();
        this.createDaisGlow();
    }

    protected override createCentralCrystal() {
        this.centralCrystal = new THREE.Group();

        const core = new THREE.Mesh(
            new THREE.IcosahedronGeometry(1.6, 1),
            new THREE.MeshStandardMaterial({ color: 0x8ce9ff, emissive: 0x2ce4ff, emissiveIntensity: 3.5 })
        );
        core.position.y = 4.2;
        core.castShadow = true;

        const shell = new THREE.Mesh(
            new THREE.OctahedronGeometry(3, 1),
            new THREE.MeshPhysicalMaterial({
                color: 0xa8ecff, transmission: 1, opacity: 0.5,
                transparent: true, roughness: 0, thickness: 0.8
            })
        );
        shell.position.y = 4.2;

        const light = new THREE.PointLight(0x4fd1ff, 22, 80);
        light.position.y = 4.6;
        light.castShadow = true;
        light.shadow.mapSize.width = 512;
        light.shadow.mapSize.height = 512;
        light.shadow.camera.far = 80;
        light.shadow.camera.updateProjectionMatrix();

        const pedestal = new THREE.Mesh(
            new THREE.CylinderGeometry(2.2, 3.4, 2, 8),
            new THREE.MeshStandardMaterial({ color: 0x0d131c, roughness: 0.35, metalness: 0.9 })
        );
        pedestal.position.y = 1.7;
        pedestal.castShadow = true;
        pedestal.receiveShadow = true;

        this.centralCrystal.add(core, shell, light, pedestal);

        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(4.2 + i * 1.3, 0.09, 8, 48),
                new THREE.MeshStandardMaterial({
                    color: 0x0a0f16,
                    emissive: i % 2 === 0 ? 0x2ce4ff : 0xff3ea5,
                    emissiveIntensity: 6,
                    roughness: 0.3,
                })
            );
            ring.position.y = 4.2;
            ring.rotation.x = Math.PI / 2 + (i - 1) * 0.5;
            this.crystalRings.push(ring);
            this.centralCrystal.add(ring);
        }

        this.centralCrystal.position.set(0, 0, 0);
        this.scene.add(this.centralCrystal);

        this.centralCrystal.userData.interactionId = "tower-crystal";

        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(-2.6, 0, -2.6),
            new THREE.Vector3(2.6, 4, 2.6)
        ));
    }

    private createKeyLight() {
        const isLowEnd = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency != null)
            ? navigator.hardwareConcurrency <= 4
            : false;
        const shadowRes = isLowEnd ? 1024 : 2048;

        const keyLight = new THREE.DirectionalLight(0xdcefff, 2.1);
        keyLight.position.set(60, 110, 40);
        keyLight.target.position.set(0, 10, 0);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(shadowRes, shadowRes);
        keyLight.shadow.camera.left = -100;
        keyLight.shadow.camera.right = 100;
        keyLight.shadow.camera.top = 100;
        keyLight.shadow.camera.bottom = -100;
        keyLight.shadow.camera.near = 10;
        keyLight.shadow.camera.far = 240;
        keyLight.shadow.bias = -0.0003;
        keyLight.shadow.normalBias = 0.03;
        keyLight.shadow.camera.updateProjectionMatrix();
        this.scene.add(keyLight);
        this.scene.add(keyLight.target);
    }

    private createDustMotes() {
        const count = 220;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * this.hallRadius * 0.75;
            pos[i * 3] = Math.cos(angle) * r;
            pos[i * 3 + 1] = 2 + Math.random() * 40;
            pos[i * 3 + 2] = Math.sin(angle) * r;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: 0x8fe3ff,
            size: 0.16,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        this.dustMotes = new THREE.Points(geo, mat);
        this.scene.add(this.dustMotes);
    }

    private createDaisGlow() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(120, 235, 255, 0.85)');
        gradient.addColorStop(0.5, 'rgba(60, 170, 255, 0.28)');
        gradient.addColorStop(1, 'rgba(40, 120, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.7,
        });
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(PLAZA_RADIUS * 2.4, PLAZA_RADIUS * 2.4), mat);
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.3;
        this.daisGlow = glow;
        this.scene.add(glow);
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        this.crystals.forEach((c, i) => {
            c.mesh.position.y += Math.sin(this.time * 0.8 + i) * 0.005;
            c.mesh.rotation.y += delta * 0.25;
        });

        this.crystalRings.forEach((ring, i) => {
            ring.rotation.z += delta * (0.35 + i * 0.18) * (i % 2 === 0 ? 1 : -1);
        });

        for (const npc of this.npcs) {
            npc.time += delta;
            npc.handle.group.rotation.y = npc.baseRotation + Math.sin(npc.time * 0.4) * 0.3;
            npc.handle.update(delta);
        }

        for (const sign of this.buildings.signs) {
            const material = sign.material as THREE.MeshBasicMaterial;
            material.opacity = 0.82 + Math.sin(this.time * 2.4) * 0.08;
        }

        if (this.dustMotes) {
            const positions = this.dustMotes.geometry.attributes.position.array as Float32Array;
            for (let i = 0; i < positions.length / 3; i++) {
                positions[i * 3 + 1] -= delta * 0.6;
                if (positions[i * 3 + 1] < 2) {
                    positions[i * 3 + 1] = 42;
                }
            }
            this.dustMotes.geometry.attributes.position.needsUpdate = true;
        }
    }

    public override getInteractables(): THREE.Object3D[] {
        return [...super.getInteractables(), ...this.npcs.map((npc) => npc.handle.group)];
    }

    dispose() {
        disposeMaterialMaps(this.floorMaterial);
        disposeMaterialMaps(this.hullMaterial);
        disposeMaterialMaps(this.skyMaterial);
        this.buildings?.facadeMaterials.forEach(disposeMaterialMaps);
        this.city?.materials.forEach(disposeMaterialMaps);
        this.buildings?.signs.forEach((sign) => (sign.material as THREE.MeshBasicMaterial).map?.dispose());

        if (this.daisGlow) {
            (this.daisGlow.material as THREE.MeshBasicMaterial).map?.dispose();
        }

        if (this.dustMotes) {
            this.dustMotes.geometry.dispose();
            (this.dustMotes.material as THREE.Material).dispose();
        }

        super.dispose();
        this.crystals = [];
        this.crystalRings = [];
        this.npcs = [];
    }
}
