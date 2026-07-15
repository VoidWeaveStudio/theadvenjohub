// src/features/game/world/locations/tower/floors/MainHall.ts
import * as THREE from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";

interface CrystalData {
    mesh: THREE.Mesh;
    light: THREE.PointLight;
    baseIntensity: number;
    offset: number;
    size: 'large' | 'medium' | 'small';
}

export class MainHall extends TowerFloor {
    private crystals: CrystalData[] = [];

    constructor() {
        super("tower-main-hall", "Gloomy Tower Main Hall");
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
        
        this.createCentralCrystal();
    }

    private createFloor(radius: number) {
        const floorGroup = new THREE.Group();

        const mosaicColors = [0xD4C5A9, 0xB8A88A, 0x9C8B6F, 0x7A6B52];
        for (let i = 0; i < mosaicColors.length; i++) {
            const innerR = i === 0 ? 0 : 8 + (i - 1) * 12;
            const outerR = 8 + i * 12;
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(innerR, outerR, 32),
                new THREE.MeshStandardMaterial({ color: mosaicColors[i], roughness: 0.8, metalness: 0.1 })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.01;
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

            const columnBody = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 30, 16), pillarMat);
            columnBody.position.set(x, 18, z);
            columnBody.castShadow = true;
            columnBody.receiveShadow = true;
            columnGroup.add(columnBody);


            const capital1 = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 1, 12), pillarMat);
            capital1.position.set(x, 33.5, z);
            capital1.castShadow = true;
            columnGroup.add(capital1);

            const capital2 = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 5), corniceMat);
            capital2.position.set(x, 34.5, z);
            capital2.castShadow = true;
            columnGroup.add(capital2);

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

            const nicheDepth = 3;
            const nicheX = Math.cos(midAngle) * (radius - nicheDepth / 2);
            const nicheZ = Math.sin(midAngle) * (radius - nicheDepth / 2);

            const niche = new THREE.Mesh(new THREE.BoxGeometry(5, 18, nicheDepth), new THREE.MeshStandardMaterial({ color: 0x8A8578, roughness: 0.9 }));
            niche.position.set(nicheX, 12, nicheZ);
            niche.lookAt(0, 12, 0);
            niche.receiveShadow = true;
            columnGroup.add(niche);

            const nicheCrystal = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.8, 0),
                new THREE.MeshStandardMaterial({ color: 0xaaddff, emissive: 0x66ccff, emissiveIntensity: 4, metalness: 0, roughness: 0.1, transparent: true, opacity: 0.9 })
            );
            nicheCrystal.position.set(nicheX * 0.92, 14, nicheZ * 0.92);
            columnGroup.add(nicheCrystal);

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

        }

        this.scene.add(secondLevel);
    }

    private createDome(radius: number, wallMat: THREE.Material, corniceMat: THREE.Material) {
        const domeGroup = new THREE.Group();
        const domeHeight = 50;
        
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
            const ringHeight = 10 + ring * 12;
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
        chandelierGroup.position.set(0, 32, 0);

        const mainRing = new THREE.Mesh(new THREE.TorusGeometry(12, 0.6, 8, 32), metalMat);
        mainRing.rotation.x = Math.PI / 2;
        chandelierGroup.add(mainRing);

        const innerRing = new THREE.Mesh(new THREE.TorusGeometry(8, 0.4, 8, 24), metalMat);
        innerRing.rotation.x = Math.PI / 2;
        innerRing.position.y = -3;
        chandelierGroup.add(innerRing);

      
        for (let i = 0; i < 2; i++) {
            const angle = (i / 2) * Math.PI * 2;
            this.addCrystal(chandelierGroup, Math.cos(angle) * 12, -8, Math.sin(angle) * 12, 'large', metalMat);
        }

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            this.addCrystal(chandelierGroup, Math.cos(angle) * 8, -6, Math.sin(angle) * 8, 'medium', metalMat);
        }

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            this.addCrystal(chandelierGroup, Math.cos(angle) * 4, -4, Math.sin(angle) * 4, 'small', metalMat);
        }

        const hallLight = new THREE.PointLight(0xb8e0ff, 15, 120, 2);
        hallLight.position.set(0, -5, 0);
        hallLight.castShadow = true;
        hallLight.shadow.mapSize.width = 1024;
        hallLight.shadow.mapSize.height = 1024;
        chandelierGroup.add(hallLight);

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

    }

    dispose() {
        super.dispose();
        this.crystals = [];
    }
}