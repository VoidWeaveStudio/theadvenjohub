// src/features/game/world/locations/Tower.ts
import * as THREE from "three";
import { Location } from "../Location";
import { ResourceManager } from "../../core/ResourceManager";
import { CollisionGrid } from "../CollisionGrid";

interface CrystalData {
    mesh: THREE.Mesh;
    light: THREE.PointLight;
    baseIntensity: number;
    offset: number;
    size: 'large' | 'medium' | 'small';
}

export class Tower extends Location {
    public collisionGrid: CollisionGrid;
    private time: number = 0;
    private crystals: CrystalData[] = [];
    private particleSystem: THREE.Points | null = null;
    private particleSpeeds: Float32Array | null = null;

    constructor() {
        super("tower", "Gloomy Tower Interior");
        this.collisionGrid = new CollisionGrid(20);
    }

    create(rm: ResourceManager) {
        const bgColor = 0x1a1f28;
        this.scene.background = new THREE.Color(bgColor);
        this.scene.fog = new THREE.FogExp2(bgColor, 0.004);

        const ambient = new THREE.AmbientLight(0x1a1f2a, 0.3);
        this.scene.add(ambient);

        const hemiLight = new THREE.HemisphereLight(0xb8d4e8, 0x2a2f38, 0.8);
        this.scene.add(hemiLight);

        const wallMat = new THREE.MeshStandardMaterial({ color: 0xCAC7C2, roughness: 0.85, metalness: 0.05 });
        const corniceMat = new THREE.MeshStandardMaterial({ color: 0xF0ECE5, roughness: 0.7, metalness: 0.1 });
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0xDDD9D1, roughness: 0.6, metalness: 0.15 });
        const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.9, metalness: 0.05 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.4, metalness: 0.9 });

        const radius = 46;

        this.createFloor(radius);
        this.createWalls(radius, wallMat, corniceMat, darkStoneMat);
        this.createColumns(radius, pillarMat, corniceMat);
        this.createSecondLevel(radius, wallMat, corniceMat, pillarMat, metalMat);
        this.createDome(radius, wallMat, corniceMat);
        this.createChandelier(metalMat);
        this.createParticles();
        this.createAltar();
    }

    private createFloor(radius: number) {
        const floorGroup = new THREE.Group();

        const mosaicColors = [0xD4C5A9, 0xB8A88A, 0x9C8B6F, 0x7A6B52];
        for (let i = mosaicColors.length - 1; i >= 0; i--) {
            const ringRadius = 8 + i * 3;
            const mosaicMat = new THREE.MeshStandardMaterial({ color: mosaicColors[i], roughness: 0.5, metalness: 0.1 });
            const ring = new THREE.Mesh(new THREE.RingGeometry(ringRadius - 2, ringRadius, 32), mosaicMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.01 + i * 0.01;
            ring.receiveShadow = true;
            floorGroup.add(ring);
        }

        const medallion = new THREE.Mesh(
            new THREE.CircleGeometry(4, 32),
            new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.4, metalness: 0.2 })
        );
        medallion.rotation.x = -Math.PI / 2;
        medallion.position.y = 0.05;
        medallion.receiveShadow = true;
        floorGroup.add(medallion);

        const tileSizes = [12, 10, 8, 6];
        for (let ring = 0; ring < 3; ring++) {
            const ringRadius = 12 + ring * 10;
            const tileSize = tileSizes[ring];
            const count = Math.floor((2 * Math.PI * ringRadius) / tileSize);
            
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const x = Math.cos(angle) * ringRadius;
                const z = Math.sin(angle) * ringRadius;
                
                if (Math.sqrt(x * x + z * z) > radius - 2) continue;

                const color = 0xB8A88A + Math.floor(Math.random() * 0x202020);
                const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 + Math.random() * 0.2, metalness: 0.1 });
                const geo = new THREE.BoxGeometry(tileSize * (0.9 + Math.random() * 0.2), 0.4 + Math.random() * 0.1, tileSize * (0.9 + Math.random() * 0.2));
                const tile = new THREE.Mesh(geo, mat);
                tile.position.set(x, Math.random() * 0.1, z);
                tile.rotation.y = angle + (Math.random() - 0.5) * 0.1;
                tile.receiveShadow = true;
                tile.castShadow = true;
                floorGroup.add(tile);
            }
        }

        this.scene.add(floorGroup);
        

    }

    private createWalls(radius: number, wallMat: THREE.Material, corniceMat: THREE.Material, darkStoneMat: THREE.Material) {
        const wallGroup = new THREE.Group();
        const beltHeights = [10, 12, 14];
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

            const blockCount = 16;
            for (let i = 0; i < blockCount; i++) {
                const angle = (i / blockCount) * Math.PI * 2;
                const x = Math.cos(angle) * (radius - 0.5);
                const z = Math.sin(angle) * (radius - 0.5);
                
                const blockWidth = 3 + Math.random() * 2;
                const blockHeight = 1.5 + Math.random();
                
                const block = new THREE.Mesh(
                    new THREE.BoxGeometry(blockWidth, blockHeight, 1.5),
                    belt % 2 === 0 ? wallMat : darkStoneMat
                );
                block.position.set(x, currentY + height / 2, z);
                block.lookAt(0, currentY + height / 2, 0);
                block.rotateY(Math.PI);
                block.castShadow = true;
                block.receiveShadow = true;
                wallGroup.add(block);
            }

            currentY += height;
        }

        this.scene.add(wallGroup);

        const wallSegments = 32;
        for (let i = 0; i < wallSegments; i++) {
            const midAngle = ((i + 0.5) / wallSegments) * Math.PI * 2;
            const x = Math.cos(midAngle) * radius;
            const z = Math.sin(midAngle) * radius;
            
      
            const segmentSize = 10; 
            
            const wallBox = new THREE.Box3(
                new THREE.Vector3(x - segmentSize / 2, 0, z - segmentSize / 2),
                new THREE.Vector3(x + segmentSize / 2, 40, z + segmentSize / 2)
            );
            this.collisionGrid.insert(wallBox);
        }
    }

    private createColumns(radius: number, pillarMat: THREE.Material, corniceMat: THREE.Material) {
        const columnGroup = new THREE.Group();
        const columnCount = 16;
        const columnRadius = 38;

        for (let i = 0; i < columnCount; i++) {
            const angle = (i / columnCount) * Math.PI * 2;
            const x = Math.cos(angle) * columnRadius;
            const z = Math.sin(angle) * columnRadius;

            const base1 = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5, 1, 12), pillarMat);
            base1.position.set(x, 0.5, z);
            base1.castShadow = true;
            base1.receiveShadow = true;
            columnGroup.add(base1);

            const base2 = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.5, 1.5, 12), pillarMat);
            base2.position.set(x, 1.75, z);
            base2.castShadow = true;
            columnGroup.add(base2);

            const columnBody = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 30, 24, 1), pillarMat);
            columnBody.position.set(x, 18, z);
            columnBody.castShadow = true;
            columnBody.receiveShadow = true;
            columnGroup.add(columnBody);

            for (let j = 0; j < 12; j++) {
                const fluteAngle = (j / 12) * Math.PI * 2;
                const flute = new THREE.Mesh(
                    new THREE.BoxGeometry(0.3, 29, 0.3),
                    new THREE.MeshStandardMaterial({ color: 0xA8A39A, roughness: 0.9 })
                );
                flute.position.set(x + Math.cos(fluteAngle) * 3.1, 18, z + Math.sin(fluteAngle) * 3.1);
                flute.rotation.y = fluteAngle;
                columnGroup.add(flute);
            }

            const capital1 = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3, 1, 12), pillarMat);
            capital1.position.set(x, 33.5, z);
            capital1.castShadow = true;
            columnGroup.add(capital1);

            const capital2 = new THREE.Mesh(new THREE.CylinderGeometry(4, 3.2, 1.5, 12), corniceMat);
            capital2.position.set(x, 34.75, z);
            capital2.castShadow = true;
            columnGroup.add(capital2);

            const capital3 = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 5), corniceMat);
            capital3.position.set(x, 36, z);
            capital3.castShadow = true;
            columnGroup.add(capital3);

            this.collisionGrid.insert(new THREE.Box3(
                new THREE.Vector3(x - 2.5, 0, z - 2.5),
                new THREE.Vector3(x + 2.5, 36, z + 2.5)
            ));

            const nextAngle = ((i + 1) / columnCount) * Math.PI * 2;
            const midAngle = (angle + nextAngle) / 2;
            const midX = Math.cos(midAngle) * columnRadius;
            const midZ = Math.sin(midAngle) * columnRadius;

            const arch = new THREE.Mesh(new THREE.BoxGeometry(6, 15, 2), new THREE.MeshStandardMaterial({ color: 0xB8B0A0, roughness: 0.8 }));
            arch.position.set(midX, 20, midZ);
            arch.lookAt(0, 20, 0);
            arch.receiveShadow = true;
            columnGroup.add(arch);

            const archTop = new THREE.Mesh(
                new THREE.CylinderGeometry(3, 3, 2, 12, 1, false, 0, Math.PI),
                new THREE.MeshStandardMaterial({ color: 0xB8B0A0, roughness: 0.8 })
            );
            archTop.position.set(midX, 27, midZ);
            archTop.lookAt(0, 27, 0);
            archTop.rotateX(Math.PI / 2);
            archTop.receiveShadow = true;
            columnGroup.add(archTop);

            const nicheDepth = 3;
            const nicheX = Math.cos(midAngle) * (radius - nicheDepth / 2);
            const nicheZ = Math.sin(midAngle) * (radius - nicheDepth / 2);

            const niche = new THREE.Mesh(new THREE.BoxGeometry(5, 18, nicheDepth), new THREE.MeshStandardMaterial({ color: 0x8A8578, roughness: 0.9 }));
            niche.position.set(nicheX, 12, nicheZ);
            niche.lookAt(0, 12, 0);
            niche.receiveShadow = true;
            columnGroup.add(niche);

            const nicheArch = new THREE.Mesh(
                new THREE.CylinderGeometry(2.5, 2.5, nicheDepth, 12, 1, false, 0, Math.PI),
                new THREE.MeshStandardMaterial({ color: 0xA8A39A, roughness: 0.8 })
            );
            nicheArch.position.set(nicheX, 21, nicheZ);
            nicheArch.lookAt(0, 21, 0);
            nicheArch.rotateX(Math.PI / 2);
            columnGroup.add(nicheArch);

            const nicheCrystal = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.8, 0),
                new THREE.MeshStandardMaterial({ color: 0xaaddff, emissive: 0x66ccff, emissiveIntensity: 4, metalness: 0, roughness: 0.1, transparent: true, opacity: 0.9 })
            );
            nicheCrystal.position.set(nicheX * 0.92, 14, nicheZ * 0.92);
            columnGroup.add(nicheCrystal);

            const nicheLight = new THREE.PointLight(0x8FD9FF, 3, 20, 2);
            nicheLight.position.set(nicheX * 0.92, 14, nicheZ * 0.92);
            columnGroup.add(nicheLight);
        }

        this.scene.add(columnGroup);
    }

    private createSecondLevel(radius: number, wallMat: THREE.Material, corniceMat: THREE.Material, pillarMat: THREE.Material, metalMat: THREE.Material) {
        const secondLevel = new THREE.Group();
        const galleryHeight = 16;
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

        const railingCount = 32;
        for (let i = 0; i < railingCount; i++) {
            const angle = (i / railingCount) * Math.PI * 2;
            const x = Math.cos(angle) * (radius - galleryWidth);
            const z = Math.sin(angle) * (radius - galleryWidth);

            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1, 6), metalMat);
            post.position.set(x, galleryHeight + 0.5, z);
            post.castShadow = true;
            secondLevel.add(post);
        }

        const balconyHeight = 38;
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
                new THREE.BoxGeometry(3, 5, 1),
                new THREE.MeshStandardMaterial({ color: 0x2a3a4a, emissive: 0x4a6a8a, emissiveIntensity: 2, metalness: 0.3, roughness: 0.2 })
            );
            window.position.set(x, galleryHeight + 5, z);
            window.lookAt(0, galleryHeight + 5, 0);
            window.receiveShadow = true;
            secondLevel.add(window);

            const windowLight = new THREE.PointLight(0x6a8aaa, 2, 15, 2);
            windowLight.position.set(x * 0.95, galleryHeight + 5, z * 0.95);
            secondLevel.add(windowLight);
        }

        this.scene.add(secondLevel);
    }

    private createDome(radius: number, wallMat: THREE.Material, corniceMat: THREE.Material) {
        const domeGroup = new THREE.Group();
        const domeHeight = 50;
        
        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0xCAC7C2, roughness: 0.85, side: THREE.BackSide })
        );
        dome.position.y = 0;
        dome.scale.y = domeHeight / radius;
        dome.receiveShadow = true;
        domeGroup.add(dome);

        const ribCount = 16;
        for (let i = 0; i < ribCount; i++) {
            const angle = (i / ribCount) * Math.PI * 2;
            const ribPoints: THREE.Vector3[] = [];
            for (let j = 0; j <= 20; j++) {
                const t = j / 20;
                const phi = t * Math.PI / 2;
                const r = radius * (1 - t * 0.1);
                ribPoints.push(new THREE.Vector3(
                    Math.cos(angle) * r * Math.sin(phi),
                    r * Math.cos(phi) * (domeHeight / radius),
                    Math.sin(angle) * r * Math.sin(phi)
                ));
            }

            const ribCurve = new THREE.CatmullRomCurve3(ribPoints);
            const ribGeo = new THREE.TubeGeometry(ribCurve, 20, 0.4, 8, false);
            const rib = new THREE.Mesh(ribGeo, corniceMat);
            rib.castShadow = true;
            domeGroup.add(rib);
        }

        for (let ring = 0; ring < 5; ring++) {
            const ringHeight = 5 + ring * 9;
            const ringRadius = radius * Math.cos(Math.asin(ringHeight / domeHeight)) * 0.95;
            
            const domeRing = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.3, 8, 32), corniceMat);
            domeRing.position.y = ringHeight;
            domeRing.rotation.x = Math.PI / 2;
            domeRing.castShadow = true;
            domeGroup.add(domeRing);
        }

        const chainCount = 8;
        for (let i = 0; i < chainCount; i++) {
            const angle = (i / chainCount) * Math.PI * 2;
            const x = Math.cos(angle) * (radius * 0.7);
            const z = Math.sin(angle) * (radius * 0.7);

            const chain = new THREE.Mesh(
                new THREE.CylinderGeometry(0.1, 0.1, 15, 6),
                new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.9, roughness: 0.4 })
            );
            chain.position.set(x, domeHeight - 10, z);
            chain.castShadow = true;
            domeGroup.add(chain);
        }

        this.scene.add(domeGroup);
    }

    private createChandelier(metalMat: THREE.Material) {
        const chandelierGroup = new THREE.Group();
        chandelierGroup.position.set(0, 32, 0);

        const mainRing = new THREE.Mesh(new THREE.TorusGeometry(12, 0.6, 12, 48), metalMat);
        mainRing.rotation.x = Math.PI / 2;
        chandelierGroup.add(mainRing);

        const innerRing = new THREE.Mesh(new THREE.TorusGeometry(8, 0.4, 8, 32), metalMat);
        innerRing.rotation.x = Math.PI / 2;
        innerRing.position.y = -3;
        chandelierGroup.add(innerRing);

        const coreRing = new THREE.Mesh(new THREE.TorusGeometry(4, 0.3, 8, 24), metalMat);
        coreRing.rotation.x = Math.PI / 2;
        coreRing.position.y = -6;
        chandelierGroup.add(coreRing);

        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 8, 8), metalMat);
            chain.position.set(Math.cos(angle) * 12, 4, Math.sin(angle) * 12);
            chain.castShadow = true;
            chandelierGroup.add(chain);
        }

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const cx = Math.cos(angle) * 12;
            const cz = Math.sin(angle) * 12;
            this.addCrystal(chandelierGroup, cx, -8, cz, 'large', metalMat);
        }

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
            const cx = Math.cos(angle) * 8;
            const cz = Math.sin(angle) * 8;
            this.addCrystal(chandelierGroup, cx, -6, cz, 'medium', metalMat);
        }

        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const cx = Math.cos(angle) * 4;
            const cz = Math.sin(angle) * 4;
            this.addCrystal(chandelierGroup, cx, -4, cz, 'small', metalMat);
        }

        const hallLight = new THREE.PointLight(0xb8e0ff, 25, 150, 2);
        hallLight.position.set(0, 0, 0);
        hallLight.castShadow = true;
        hallLight.shadow.mapSize.width = 2048;
        hallLight.shadow.mapSize.height = 2048;
        chandelierGroup.add(hallLight);

        this.scene.add(chandelierGroup);
    }

    private addCrystal(group: THREE.Group, x: number, y: number, z: number, size: 'large' | 'medium' | 'small', metalMat: THREE.Material) {
        const sizeMap = {
            large: { radius: 1.5, height: 6, intensity: 20, distance: 80 },
            medium: { radius: 1.0, height: 4, intensity: 12, distance: 50 },
            small: { radius: 0.6, height: 2.5, intensity: 6, distance: 30 }
        };

        const params = sizeMap[size];

        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 6), metalMat);
        chain.position.set(x, y + 3, z);
        chain.castShadow = true;
        group.add(chain);

        const crystalGeo = new THREE.OctahedronGeometry(params.radius, 0);
        const crystalMat = new THREE.MeshStandardMaterial({
            color: 0xaaddff, emissive: 0x66ccff, emissiveIntensity: 8, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.95
        });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        crystal.position.set(x, y, z);
        crystal.scale.y = params.height / (params.radius * 2);
        crystal.rotation.y = Math.random() * Math.PI;
        group.add(crystal);

        const pLight = new THREE.PointLight(0x8FD9FF, params.intensity, params.distance, 2);
        pLight.position.set(x, y, z);
        pLight.castShadow = size === 'large';
        if (pLight.castShadow) {
            pLight.shadow.mapSize.width = 1024;
            pLight.shadow.mapSize.height = 1024;
        }
        group.add(pLight);

        if (size === 'large' || size === 'medium') {
            const sLight = new THREE.SpotLight(0x8FD9FF, params.intensity * 0.5, params.distance, Math.PI / 8, 0.6, 2);
            sLight.position.set(x, y, z);
            sLight.target.position.set(x, -40, z);
            group.add(sLight);
            group.add(sLight.target);
        }

        this.crystals.push({ mesh: crystal, light: pLight, baseIntensity: params.intensity, offset: this.crystals.length, size });
    }

    private createParticles() {
        const particleCount = 600;
        const pGeo = new THREE.BufferGeometry();
        const pPos = new Float32Array(particleCount * 3);
        const pSizes = new Float32Array(particleCount);
        this.particleSpeeds = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 5 + Math.random() * 35;
            pPos[i * 3] = Math.cos(angle) * r;
            pPos[i * 3 + 1] = 5 + Math.random() * 30;
            pPos[i * 3 + 2] = Math.sin(angle) * r;
            pSizes[i] = 0.1 + Math.random() * 0.3;
            this.particleSpeeds[i] = 0.1 + Math.random() * 0.4;
        }

        pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        pGeo.setAttribute('size', new THREE.BufferAttribute(pSizes, 1));

        const pMat = new THREE.PointsMaterial({
            color: 0xb8d8f8, size: 0.25, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
        });

        this.particleSystem = new THREE.Points(pGeo, pMat);
        this.scene.add(this.particleSystem);
    }

    private createAltar() {
        const altarGroup = new THREE.Group();

        const altarBase = new THREE.Mesh(
            new THREE.CylinderGeometry(6, 7, 4, 16),
            new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.8, metalness: 0.3 })
        );
        altarBase.position.set(0, -18, -38);
        altarBase.receiveShadow = true;
        altarBase.castShadow = true;
        altarGroup.add(altarBase);

        const altarGlow = new THREE.Mesh(
            new THREE.SphereGeometry(2, 32, 32),
            new THREE.MeshStandardMaterial({ color: 0x220033, emissive: 0x8a2be2, emissiveIntensity: 8 })
        );
        altarGlow.position.set(0, -15, -38);
        altarGroup.add(altarGlow);

        const basementLight = new THREE.PointLight(0x8a2be2, 8, 50, 2);
        basementLight.position.set(0, -12, -38);
        basementLight.castShadow = true;
        altarGroup.add(basementLight);

        this.scene.add(altarGroup);
        this.collisionGrid.insert(new THREE.Box3().setFromObject(altarBase));
    }

    update(playerPosition: THREE.Vector3, delta: number) {
        this.time += delta;

        if (this.crystals) {
            this.crystals.forEach((c, i) => {
                const noise = Math.sin(this.time * 1.5 + i) * 0.03 +
                              Math.sin(this.time * 3.7 + i * 2) * 0.02 +
                              Math.sin(this.time * 0.5) * 0.01;

                const intensityMultiplier = 1.0 + noise;
                c.light.intensity = c.baseIntensity * intensityMultiplier;
                
                const material = c.mesh.material as THREE.MeshStandardMaterial;
                material.emissiveIntensity = 8 * intensityMultiplier;

                const baseY = c.mesh.position.y;
                c.mesh.position.y += Math.sin(this.time * 0.8 + i) * 0.01;
                c.light.position.y = c.mesh.position.y;
            });
        }

        if (this.particleSystem && this.particleSpeeds) {
            const positions = this.particleSystem.geometry.attributes.position.array as Float32Array;
            for (let i = 0; i < positions.length / 3; i++) {
                const i3 = i * 3;
                const x = positions[i3];
                const z = positions[i3 + 2];

                const speed = this.particleSpeeds[i] * delta * 0.15;
                const cos = Math.cos(speed);
                const sin = Math.sin(speed);
                positions[i3] = x * cos - z * sin;
                positions[i3 + 2] = x * sin + z * cos;

                positions[i3 + 1] += Math.sin(this.time * 0.5 + i) * delta * 0.15;

                if (positions[i3 + 1] < 5) positions[i3 + 1] = 35;
                if (positions[i3 + 1] > 40) positions[i3 + 1] = 5;
            }
            this.particleSystem.geometry.attributes.position.needsUpdate = true;
        }
    }

    getSpawnPoint(): THREE.Vector3 {
        return new THREE.Vector3(0, 2, 0);
    }

    dispose() {
        this.collisionGrid.clear();
        this.scene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh) {
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m: THREE.Material) => m.dispose());
                } else if (mesh.material) {
                    mesh.material.dispose();
                }
            }
        });
        
        this.crystals = [];
        if (this.particleSystem) {
            this.particleSystem.geometry.dispose();
            (this.particleSystem.material as THREE.Material).dispose();
            this.particleSystem = null;
        }
    }
}