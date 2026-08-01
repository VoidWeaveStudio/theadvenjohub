// src/features/game/world/locations/tower/floors/MainHall.ts
import * as THREE from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";
import { createWallStoneMaterial, createPillarMarbleMaterial } from "./mainHallTextures";
import { NpcHandle } from "../../../../entities/npcModel";
import { createVendorNPC, createSolaNPC, createFactionBrokerNPC, createAlfredoNPC } from "./mainHallNpcs";
import { buildFloor, buildWalls, buildColumns, buildSecondLevel, buildDome, buildChandelier, CrystalData } from "./mainHallArchitecture";

export class MainHall extends TowerFloor {
    public readonly hallRadius = 92;

    private crystals: CrystalData[] = [];
    private resourceManager!: ResourceManager;
    private vendorNpc!: NpcHandle;
    private vendorTime: number = 0;
    private solaNpc!: NpcHandle;
    private solaTime: number = 0;
    private factionBrokerNpc!: NpcHandle;
    private factionBrokerTime: number = 0;
    private alfredoNpc!: NpcHandle;
    private alfredoTime: number = 0;

    private floorMaterial!: THREE.MeshStandardMaterial;
    private wallMaterialRef!: THREE.MeshStandardMaterial;
    private pillarMaterialRef!: THREE.MeshStandardMaterial;
    private dustMotes: THREE.Points | null = null;
    private medallionGlow: THREE.Mesh | null = null;

    constructor() {
        super("tower-main-hall", "Gloomy Tower Main Hall");
    }

    create(rm: ResourceManager) {
        this.resourceManager = rm;
        const bgColor = 0x2a3038;
        this.scene.background = new THREE.Color(bgColor);
        this.scene.fog = new THREE.FogExp2(bgColor, 0.0015);

        const ambient = new THREE.AmbientLight(0x3a4048, 0.25);
        this.scene.add(ambient);
        const hemiLight = new THREE.HemisphereLight(0xd8e8f5, 0x3a4048, 0.55);
        this.scene.add(hemiLight);

        this.createKeyLight();

        this.wallMaterialRef = createWallStoneMaterial();
        this.pillarMaterialRef = createPillarMarbleMaterial();
        const wallMat = this.wallMaterialRef;
        const corniceMat = new THREE.MeshStandardMaterial({ color: 0xF0ECE5, roughness: 0.7, metalness: 0.1 });
        const pillarMat = this.pillarMaterialRef;
        const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.9, metalness: 0.05 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.4, metalness: 0.9 });

        const radius = this.hallRadius;

        this.floorMaterial = buildFloor(this.scene, radius);
        buildWalls(this.scene, this.collisionGrid, radius, wallMat, corniceMat, darkStoneMat);
        buildColumns(this.scene, this.collisionGrid, radius, pillarMat, corniceMat);
        buildSecondLevel(this.scene, radius, wallMat, corniceMat, pillarMat, metalMat);
        buildDome(this.scene, radius, wallMat, corniceMat);
        this.crystals = buildChandelier(this.scene, metalMat);

        this.createCentralCrystal();
        this.vendorNpc = createVendorNPC(this.scene, this.collisionGrid, this.resourceManager);
        this.solaNpc = createSolaNPC(this.scene, this.collisionGrid, this.resourceManager);
        this.factionBrokerNpc = createFactionBrokerNPC(this.scene, this.collisionGrid, this.resourceManager);
        this.alfredoNpc = createAlfredoNPC(this.scene, this.collisionGrid, this.resourceManager);
        this.createDustMotes();
        this.createMedallionGlow();
    }

    private createKeyLight() {
        const isLowEnd = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency != null)
            ? navigator.hardwareConcurrency <= 4
            : false;
        const shadowRes = isLowEnd ? 1024 : 2048;

        const keyLight = new THREE.DirectionalLight(0xfff2d8, 1.6);
        keyLight.position.set(60, 130, 40);
        keyLight.target.position.set(0, 20, 0);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(shadowRes, shadowRes);
        keyLight.shadow.camera.left = -100;
        keyLight.shadow.camera.right = 100;
        keyLight.shadow.camera.top = 100;
        keyLight.shadow.camera.bottom = -100;
        keyLight.shadow.camera.near = 10;
        keyLight.shadow.camera.far = 260;
        keyLight.shadow.bias = -0.0003;
        keyLight.shadow.normalBias = 0.03;
        keyLight.shadow.camera.updateProjectionMatrix();
        this.scene.add(keyLight);
        this.scene.add(keyLight.target);
    }

    private createDustMotes() {
        const count = 180;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * this.hallRadius * 0.7;
            pos[i * 3] = Math.cos(angle) * r;
            pos[i * 3 + 1] = 2 + Math.random() * 53;
            pos[i * 3 + 2] = Math.sin(angle) * r;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xfff2d8,
            size: 0.12,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        this.dustMotes = new THREE.Points(geo, mat);
        this.scene.add(this.dustMotes);
    }

    private createMedallionGlow() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 240, 200, 0.9)');
        gradient.addColorStop(0.5, 'rgba(255, 220, 150, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 220, 150, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.6,
        });
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), mat);
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = 0.12;
        this.medallionGlow = glow;
        this.scene.add(glow);
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        if (this.crystals) {
            this.crystals.forEach((c, i) => {
                c.mesh.position.y += Math.sin(this.time * 0.8 + i) * 0.005;
            });
        }

        if (this.vendorNpc) {
            this.vendorTime += delta;
            this.vendorNpc.group.rotation.y = Math.sin(this.vendorTime * 0.4) * 0.3;
            this.vendorNpc.update(delta);
        }

        if (this.solaNpc) {
            this.solaTime += delta;
            this.solaNpc.group.rotation.y = Math.sin(this.solaTime * 0.4) * 0.3;
            this.solaNpc.update(delta);
        }

        if (this.factionBrokerNpc) {
            this.factionBrokerTime += delta;
            this.factionBrokerNpc.group.rotation.y = Math.sin(this.factionBrokerTime * 0.4) * 0.3;
            this.factionBrokerNpc.update(delta);
        }

        if (this.alfredoNpc) {
            this.alfredoTime += delta;
            this.alfredoNpc.group.rotation.y = Math.sin(this.alfredoTime * 0.4) * 0.3;
            this.alfredoNpc.update(delta);
        }

        if (this.dustMotes) {
            const positions = this.dustMotes.geometry.attributes.position.array as Float32Array;
            for (let i = 0; i < positions.length / 3; i++) {
                positions[i * 3 + 1] -= delta * 0.6;
                if (positions[i * 3 + 1] < 2) {
                    positions[i * 3 + 1] = 55;
                }
            }
            this.dustMotes.geometry.attributes.position.needsUpdate = true;
        }
    }

    public override getInteractables(): THREE.Object3D[] {
        return [...super.getInteractables(), this.vendorNpc.group, this.solaNpc.group, this.factionBrokerNpc.group, this.alfredoNpc.group];
    }

    dispose() {
        this.floorMaterial?.map?.dispose();
        this.floorMaterial?.roughnessMap?.dispose();
        this.wallMaterialRef?.map?.dispose();
        this.wallMaterialRef?.roughnessMap?.dispose();
        this.pillarMaterialRef?.map?.dispose();
        this.pillarMaterialRef?.roughnessMap?.dispose();

        if (this.medallionGlow) {
            (this.medallionGlow.material as THREE.MeshBasicMaterial).map?.dispose();
        }

        if (this.dustMotes) {
            this.dustMotes.geometry.dispose();
            (this.dustMotes.material as THREE.Material).dispose();
        }

        super.dispose();
        this.crystals = [];
    }
}
