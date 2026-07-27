// src/features/game/world/locations/tower/floors/MainHall.ts
import * as THREE from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";
import { createMarbleFloorMaterial, createWallStoneMaterial, createPillarMarbleMaterial } from "./mainHallTextures";
import { createNpcModel, NpcHandle } from "../../../../entities/npcModel";

interface CrystalData {
    mesh: THREE.Mesh;
    light: THREE.PointLight;
    baseIntensity: number;
    offset: number;
    size: 'large' | 'medium' | 'small';
}

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

        this.createFloor(radius);
        this.createWalls(radius, wallMat, corniceMat, darkStoneMat);
        this.createColumns(radius, pillarMat, corniceMat);
        this.createSecondLevel(radius, wallMat, corniceMat, pillarMat, metalMat);
        this.createDome(radius, wallMat, corniceMat);
        this.createChandelier(metalMat);

        this.createCentralCrystal();
        this.createVendorNPC();
        this.createSolaNPC();
        this.createFactionBrokerNPC();
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

    private createVendorNPC() {
        const STALL_Z = -36;

        const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85, metalness: 0.05 });
        const clothMat = new THREE.MeshStandardMaterial({ color: 0x7a2f3a, roughness: 0.7, metalness: 0.05 });

        const stallGroup = new THREE.Group();
        stallGroup.position.set(0, 0, STALL_Z);

        const counter = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 1.2), woodMat);
        counter.position.set(0, 0.55, 0.6);
        counter.castShadow = true;
        counter.receiveShadow = true;
        stallGroup.add(counter);

        const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 3, 8);
        const postPositions: [number, number][] = [[-1.9, -1.5], [1.9, -1.5], [-1.9, 1.5], [1.9, 1.5]];
        for (const [x, z] of postPositions) {
            const post = new THREE.Mesh(postGeo, woodMat);
            post.position.set(x, 1.5, z);
            post.castShadow = true;
            stallGroup.add(post);
        }

        const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.15, 3.4), clothMat);
        canopy.position.set(0, 3, 0);
        canopy.castShadow = true;
        stallGroup.add(canopy);

        this.scene.add(stallGroup);

        this.vendorNpc = createNpcModel(this.resourceManager, 0x7a2f3a, (headPos) => {
            const hat = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.4, 12), woodMat);
            hat.position.set(headPos.x, headPos.y + 0.38, headPos.z);

            const glow = new THREE.PointLight(0xffcc66, 1.5, 6);
            glow.position.set(headPos.x, headPos.y - 0.2, headPos.z + 0.3);

            return [hat, glow];
        });
        this.vendorNpc.group.position.set(0, 0, STALL_Z - 0.6);
        this.vendorNpc.group.userData.interactionId = "token-vendor";
        this.scene.add(this.vendorNpc.group);

        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(-2.2, 0, STALL_Z - 1.8),
            new THREE.Vector3(2.2, 3.2, STALL_Z + 1.8)
        ));
    }

    private createSolaNPC() {
        const x = 40;
        const z = 28;

        this.solaNpc = createNpcModel(this.resourceManager, 0x2f6b4a, (headPos) => {
            const hood = new THREE.Mesh(
                new THREE.ConeGeometry(0.34, 0.5, 12),
                new THREE.MeshStandardMaterial({ color: 0x214a35, roughness: 0.8 })
            );
            hood.position.set(headPos.x, headPos.y + 0.3, headPos.z);

            const marker = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.18, 0),
                new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffcc33, emissiveIntensity: 5 })
            );
            marker.position.set(headPos.x, headPos.y + 0.9, headPos.z);

            const glow = new THREE.PointLight(0x66ffb3, 1.4, 6);
            glow.position.set(headPos.x, headPos.y - 0.2, headPos.z + 0.3);

            return [hood, marker, glow];
        });
        this.solaNpc.group.position.set(x, 0, z);
        this.solaNpc.group.userData.interactionId = "quest-giver-sola";
        this.scene.add(this.solaNpc.group);

        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(x - 0.5, 0, z - 0.5),
            new THREE.Vector3(x + 0.5, 2.5, z + 0.5)
        ));
    }

    private createFactionBrokerNPC() {
        const x = -40;
        const z = 28;

        this.factionBrokerNpc = createNpcModel(this.resourceManager, 0x8b2fc9, (headPos) => {
            const circlet = new THREE.Mesh(
                new THREE.TorusGeometry(0.22, 0.03, 8, 16),
                new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.4, metalness: 0.8 })
            );
            circlet.rotation.x = Math.PI / 2;
            circlet.position.set(headPos.x, headPos.y + 0.28, headPos.z);

            const marker = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.18, 0),
                new THREE.MeshStandardMaterial({ color: 0xd8a6ff, emissive: 0x8b2fc9, emissiveIntensity: 5 })
            );
            marker.position.set(headPos.x, headPos.y + 0.9, headPos.z);

            const glow = new THREE.PointLight(0xa855f7, 1.4, 6);
            glow.position.set(headPos.x, headPos.y - 0.2, headPos.z + 0.3);

            return [circlet, marker, glow];
        });
        this.factionBrokerNpc.group.position.set(x, 0, z);
        this.factionBrokerNpc.group.userData.interactionId = "faction-broker";
        this.scene.add(this.factionBrokerNpc.group);

        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(x - 0.5, 0, z - 0.5),
            new THREE.Vector3(x + 0.5, 2.5, z + 0.5)
        ));
    }

    private createFloor(radius: number) {
        const floorGroup = new THREE.Group();

        this.floorMaterial = createMarbleFloorMaterial();

        const mosaicColors = [0xD4C5A9, 0xB8A88A, 0x9C8B6F, 0x7A6B52];
        for (let i = 0; i < mosaicColors.length; i++) {
            const innerR = i === 0 ? 0 : 16 + (i - 1) * 24;
            const outerR = 16 + i * 24;
            const ringMaterial = this.floorMaterial.clone();
            ringMaterial.color.set(mosaicColors[i]);
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(innerR, outerR, 32),
                ringMaterial
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.01;
            ring.receiveShadow = true;
            floorGroup.add(ring);
        }

        const medallionMaterial = this.floorMaterial.clone();
        medallionMaterial.color.set(0x8B7355);
        medallionMaterial.roughness = 0.35;
        medallionMaterial.metalness = 0.2;
        const medallion = new THREE.Mesh(
            new THREE.CircleGeometry(8, 32),
            medallionMaterial
        );
        medallion.rotation.x = -Math.PI / 2;
        medallion.position.y = 0.05;
        medallion.receiveShadow = true;
        floorGroup.add(medallion);

        this.scene.add(floorGroup);
    }

    private createWalls(radius: number, wallMat: THREE.Material, corniceMat: THREE.Material, darkStoneMat: THREE.Material) {
        const wallGroup = new THREE.Group();
        const beltHeights = [20, 24, 28];
        let currentY = 0;

        for (let belt = 0; belt < 3; belt++) {
            const height = beltHeights[belt];

            const wall = new THREE.Mesh(
                new THREE.CylinderGeometry(radius, radius, height, 32, 1, true),
                wallMat
            );
            wall.position.y = currentY + height / 2;
            wall.receiveShadow = true;
            wallGroup.add(wall);

            const cornice = new THREE.Mesh(
                new THREE.TorusGeometry(radius, 0.8, 8, 32),
                corniceMat
            );
            cornice.position.y = currentY + height;
            cornice.rotation.x = Math.PI / 2;
            cornice.castShadow = true;
            wallGroup.add(cornice);


            currentY += height;
        }

        this.scene.add(wallGroup);

        const wallSegments = 32;
        for (let i = 0; i < wallSegments; i++) {
            const midAngle = ((i + 0.5) / wallSegments) * Math.PI * 2;
            const x = Math.cos(midAngle) * radius;
            const z = Math.sin(midAngle) * radius;

            const segmentSize = 20;
            const wallBox = new THREE.Box3(
                new THREE.Vector3(x - segmentSize / 2, 0, z - segmentSize / 2),
                new THREE.Vector3(x + segmentSize / 2, 80, z + segmentSize / 2)
            );
            this.collisionGrid.insert(wallBox);
        }
    }

    private createColumns(radius: number, pillarMat: THREE.Material, corniceMat: THREE.Material) {
        const columnGroup = new THREE.Group();
        const columnCount = 16;
        const columnRadius = 76;

        for (let i = 0; i < columnCount; i++) {
            const angle = (i / columnCount) * Math.PI * 2;
            const x = Math.cos(angle) * columnRadius;
            const z = Math.sin(angle) * columnRadius;

            const base1 = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5, 1, 12), pillarMat);
            base1.position.set(x, 0.5, z);
            base1.castShadow = true;
            base1.receiveShadow = true;
            columnGroup.add(base1);

            const columnBody = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 60, 16), pillarMat);
            columnBody.position.set(x, 33, z);
            columnBody.castShadow = true;
            columnBody.receiveShadow = true;
            columnGroup.add(columnBody);


            const capital1 = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 1, 12), pillarMat);
            capital1.position.set(x, 63.5, z);
            capital1.castShadow = true;
            columnGroup.add(capital1);

            const capital2 = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 5), corniceMat);
            capital2.position.set(x, 64.5, z);
            capital2.castShadow = true;
            columnGroup.add(capital2);

            this.collisionGrid.insert(new THREE.Box3(
                new THREE.Vector3(x - 2.5, 0, z - 2.5),
                new THREE.Vector3(x + 2.5, 66, z + 2.5)
            ));

            const nextAngle = ((i + 1) / columnCount) * Math.PI * 2;
            const midAngle = (angle + nextAngle) / 2;
            const midX = Math.cos(midAngle) * columnRadius;
            const midZ = Math.sin(midAngle) * columnRadius;

            const arch = new THREE.Mesh(new THREE.BoxGeometry(12, 30, 2), new THREE.MeshStandardMaterial({ color: 0xB8B0A0, roughness: 0.8 }));
            arch.position.set(midX, 40, midZ);
            arch.lookAt(0, 40, 0);
            arch.receiveShadow = true;
            columnGroup.add(arch);

            const nicheDepth = 3;
            const nicheX = Math.cos(midAngle) * (radius - nicheDepth / 2);
            const nicheZ = Math.sin(midAngle) * (radius - nicheDepth / 2);

            const niche = new THREE.Mesh(new THREE.BoxGeometry(10, 36, nicheDepth), new THREE.MeshStandardMaterial({ color: 0x8A8578, roughness: 0.9 }));
            niche.position.set(nicheX, 24, nicheZ);
            niche.lookAt(0, 24, 0);
            niche.receiveShadow = true;
            columnGroup.add(niche);

            const nicheCrystal = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.8, 0),
                new THREE.MeshStandardMaterial({ color: 0xaaddff, emissive: 0x66ccff, emissiveIntensity: 4, metalness: 0, roughness: 0.1, transparent: true, opacity: 0.9 })
            );
            nicheCrystal.position.set(nicheX * 0.92, 28, nicheZ * 0.92);
            columnGroup.add(nicheCrystal);

        }

        this.scene.add(columnGroup);
    }

    private createSecondLevel(radius: number, wallMat: THREE.Material, corniceMat: THREE.Material, pillarMat: THREE.Material, metalMat: THREE.Material) {
        const secondLevel = new THREE.Group();
        const galleryHeight = 32;
        const galleryWidth = 6;

        const galleryFloor = new THREE.Mesh(
            new THREE.TorusGeometry(radius - galleryWidth / 2, galleryWidth / 2, 8, 32),
            new THREE.MeshStandardMaterial({ color: 0xCAC7C2, roughness: 0.8 })
        );
        galleryFloor.position.y = galleryHeight;
        galleryFloor.rotation.x = Math.PI / 2;
        galleryFloor.receiveShadow = true;
        secondLevel.add(galleryFloor);

        const railing = new THREE.Mesh(new THREE.TorusGeometry(radius - galleryWidth, 0.2, 8, 32), metalMat);
        railing.position.y = galleryHeight + 1;
        railing.rotation.x = Math.PI / 2;
        railing.castShadow = true;
        secondLevel.add(railing);


        const balconyHeight = 76;
        const balcony = new THREE.Mesh(
            new THREE.TorusGeometry(radius - 3, 1.5, 8, 32),
            new THREE.MeshStandardMaterial({ color: 0xDDD9D1, roughness: 0.7 })
        );
        balcony.position.y = balconyHeight;
        balcony.rotation.x = Math.PI / 2;
        balcony.receiveShadow = true;
        secondLevel.add(balcony);

        const windowCount = 16;
        for (let i = 0; i < windowCount; i++) {
            const angle = (i / windowCount) * Math.PI * 2;
            const x = Math.cos(angle) * (radius - 1);
            const z = Math.sin(angle) * (radius - 1);

            const window = new THREE.Mesh(
                new THREE.BoxGeometry(6, 10, 1),
                new THREE.MeshStandardMaterial({ color: 0x3a5a72, emissive: 0x6a9ac2, emissiveIntensity: 2.5, metalness: 0.3, roughness: 0.2 })
            );
            window.position.set(x, galleryHeight + 10, z);
            window.lookAt(0, galleryHeight + 10, 0);
            window.receiveShadow = true;
            secondLevel.add(window);

        }

        this.scene.add(secondLevel);
    }

    private createDome(radius: number, wallMat: THREE.Material, corniceMat: THREE.Material) {
        const domeGroup = new THREE.Group();
        const domeHeight = 100;

        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0xCAC7C2, roughness: 0.85, side: THREE.BackSide })
        );
        dome.position.y = 0;
        dome.scale.y = domeHeight / radius;
        dome.receiveShadow = true;
        domeGroup.add(dome);

        const ribCount = 8;
        for (let i = 0; i < ribCount; i++) {
            const angle = (i / ribCount) * Math.PI * 2;
            const ribPoints: THREE.Vector3[] = [];
            for (let j = 0; j <= 10; j++) {
                const t = j / 10;
                const phi = t * Math.PI / 2;
                const r = radius * (1 - t * 0.1);
                ribPoints.push(new THREE.Vector3(
                    Math.cos(angle) * r * Math.sin(phi),
                    r * Math.cos(phi) * (domeHeight / radius),
                    Math.sin(angle) * r * Math.sin(phi)
                ));
            }

            const ribCurve = new THREE.CatmullRomCurve3(ribPoints);
            const ribGeo = new THREE.TubeGeometry(ribCurve, 10, 0.4, 6, false);
            const rib = new THREE.Mesh(ribGeo, corniceMat);
            rib.castShadow = true;
            domeGroup.add(rib);
        }

        for (let ring = 0; ring < 3; ring++) {
            const ringHeight = 20 + ring * 24;
            const ringRadius = radius * Math.cos(Math.asin(ringHeight / domeHeight)) * 0.95;

            const domeRing = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.3, 8, 32), corniceMat);
            domeRing.position.y = ringHeight;
            domeRing.rotation.x = Math.PI / 2;
            domeRing.castShadow = true;
            domeGroup.add(domeRing);
        }

        this.scene.add(domeGroup);
    }

    private createChandelier(metalMat: THREE.Material) {
        const chandelierGroup = new THREE.Group();
        chandelierGroup.position.set(0, 64, 0);

        const mainRing = new THREE.Mesh(new THREE.TorusGeometry(24, 1.0, 8, 32), metalMat);
        mainRing.rotation.x = Math.PI / 2;
        chandelierGroup.add(mainRing);

        const innerRing = new THREE.Mesh(new THREE.TorusGeometry(16, 0.7, 8, 24), metalMat);
        innerRing.rotation.x = Math.PI / 2;
        innerRing.position.y = -6;
        chandelierGroup.add(innerRing);


        for (let i = 0; i < 2; i++) {
            const angle = (i / 2) * Math.PI * 2;
            this.addCrystal(chandelierGroup, Math.cos(angle) * 24, -16, Math.sin(angle) * 24, 'large', metalMat);
        }

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            this.addCrystal(chandelierGroup, Math.cos(angle) * 16, -12, Math.sin(angle) * 16, 'medium', metalMat);
        }

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            this.addCrystal(chandelierGroup, Math.cos(angle) * 8, -8, Math.sin(angle) * 8, 'small', metalMat);
        }

        const hallLight = new THREE.PointLight(0xd8ecff, 30, 240, 2);
        hallLight.position.set(0, -10, 0);
        chandelierGroup.add(hallLight);

        const fillLight = new THREE.PointLight(0xfff2d8, 12, 200, 2);
        fillLight.position.set(0, -40, 0);
        chandelierGroup.add(fillLight);

        this.scene.add(chandelierGroup);
    }

    private addCrystal(group: THREE.Group, x: number, y: number, z: number, size: 'large' | 'medium' | 'small', metalMat: THREE.Material) {
        const sizeMap = {
            large: { radius: 1.5, height: 6, intensity: 0 },
            medium: { radius: 1.0, height: 4, intensity: 0 },
            small: { radius: 0.6, height: 2.5, intensity: 0 }
        };

        const params = sizeMap[size];

        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 6), metalMat);
        chain.position.set(x, y + 3, z);
        chain.castShadow = true;
        group.add(chain);

        const crystalGeo = new THREE.OctahedronGeometry(params.radius, 0);
        const crystalMat = new THREE.MeshStandardMaterial({
            color: 0xaaddff, emissive: 0x66ccff, emissiveIntensity: 4, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.95
        });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        crystal.position.set(x, y, z);
        crystal.scale.y = params.height / (params.radius * 2);
        crystal.rotation.y = Math.random() * Math.PI;
        group.add(crystal);


        this.crystals.push({ mesh: crystal, light: null as any, baseIntensity: 0, offset: this.crystals.length, size });
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
        return [...super.getInteractables(), this.vendorNpc.group, this.solaNpc.group, this.factionBrokerNpc.group];
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
