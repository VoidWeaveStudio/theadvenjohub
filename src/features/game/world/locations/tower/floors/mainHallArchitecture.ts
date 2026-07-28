// src/features/game/world/locations/tower/floors/mainHallArchitecture.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../CollisionGrid";
import { createMarbleFloorMaterial } from "./mainHallTextures";

export interface CrystalData {
    mesh: THREE.Mesh;
    light: THREE.PointLight;
    baseIntensity: number;
    offset: number;
    size: 'large' | 'medium' | 'small';
}

export function buildFloor(scene: THREE.Scene, radius: number): THREE.MeshStandardMaterial {
    const floorGroup = new THREE.Group();

    const floorMaterial = createMarbleFloorMaterial();

    const mosaicColors = [0xD4C5A9, 0xB8A88A, 0x9C8B6F, 0x7A6B52];
    for (let i = 0; i < mosaicColors.length; i++) {
        const innerR = i === 0 ? 0 : 16 + (i - 1) * 24;
        const outerR = 16 + i * 24;
        const ringMaterial = floorMaterial.clone();
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

    const medallionMaterial = floorMaterial.clone();
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

    scene.add(floorGroup);

    return floorMaterial;
}

export function buildWalls(scene: THREE.Scene, collisionGrid: CollisionGrid, radius: number, wallMat: THREE.Material, corniceMat: THREE.Material, darkStoneMat: THREE.Material) {
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

    scene.add(wallGroup);

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
        collisionGrid.insert(wallBox);
    }
}

export function buildColumns(scene: THREE.Scene, collisionGrid: CollisionGrid, radius: number, pillarMat: THREE.Material, corniceMat: THREE.Material) {
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

        collisionGrid.insert(new THREE.Box3(
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

    scene.add(columnGroup);
}

export function buildSecondLevel(scene: THREE.Scene, radius: number, wallMat: THREE.Material, corniceMat: THREE.Material, pillarMat: THREE.Material, metalMat: THREE.Material) {
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

    scene.add(secondLevel);
}

export function buildDome(scene: THREE.Scene, radius: number, wallMat: THREE.Material, corniceMat: THREE.Material) {
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

    scene.add(domeGroup);
}

function addCrystal(group: THREE.Group, crystals: CrystalData[], x: number, y: number, z: number, size: 'large' | 'medium' | 'small', metalMat: THREE.Material) {
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

    crystals.push({ mesh: crystal, light: null as any, baseIntensity: 0, offset: crystals.length, size });
}

export function buildChandelier(scene: THREE.Scene, metalMat: THREE.Material): CrystalData[] {
    const crystals: CrystalData[] = [];

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
        addCrystal(chandelierGroup, crystals, Math.cos(angle) * 24, -16, Math.sin(angle) * 24, 'large', metalMat);
    }

    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        addCrystal(chandelierGroup, crystals, Math.cos(angle) * 16, -12, Math.sin(angle) * 16, 'medium', metalMat);
    }

    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        addCrystal(chandelierGroup, crystals, Math.cos(angle) * 8, -8, Math.sin(angle) * 8, 'small', metalMat);
    }

    const hallLight = new THREE.PointLight(0xd8ecff, 30, 240, 2);
    hallLight.position.set(0, -10, 0);
    chandelierGroup.add(hallLight);

    const fillLight = new THREE.PointLight(0xfff2d8, 12, 200, 2);
    fillLight.position.set(0, -40, 0);
    chandelierGroup.add(fillLight);

    scene.add(chandelierGroup);

    return crystals;
}
