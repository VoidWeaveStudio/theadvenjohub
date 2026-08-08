// src/features/game/world/locations/tower/floors/mainHallArchitecture.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../CollisionGrid";
import { createPlazaFloorMaterial, createFacadeMaterial, createCityBlockMaterial, createSkyDomeMaterial } from "./mainHallTextures";
import { createNpcSignBoard } from "./mainHallSigns";
import {
    MAIN_HALL_BUILDINGS,
    MainHallBuilding,
    PLAZA_RADIUS,
    BUILDING_WIDTH,
    BUILDING_DEPTH,
    BUILDING_HEIGHT,
    BUILDING_RING_RADIUS,
    FACING_ROTATION,
    buildingPosition,
    buildingFootprint,
} from "./mainHallLayout";

export interface CrystalData {
    mesh: THREE.Mesh;
    light: THREE.PointLight;
    baseIntensity: number;
    offset: number;
    size: 'large' | 'medium' | 'small';
}

export interface BuildingHandles {
    facadeMaterials: THREE.MeshStandardMaterial[];
    signs: THREE.Mesh[];
}

export interface CityHandles {
    materials: (THREE.MeshStandardMaterial | THREE.MeshBasicMaterial)[];
}

const NEON_CYAN = 0x5ce8ff;
const NEON_MAGENTA = 0xff6ec2;
const NEON_AMBER = 0xffc46b;
const NEON_LIME = 0x9dff8a;
const DISTRICT_ACCENTS = ["#5ce8ff", "#ff6ec2", "#ffc46b", "#9dff8a"];

function neonMaterial(color: number, intensity = 3.5): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color: 0x30405a,
        emissive: color,
        emissiveIntensity: intensity,
        roughness: 0.35,
        metalness: 0.3,
    });
}

function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

export function buildPlazaFloor(scene: THREE.Scene, radius: number): THREE.MeshStandardMaterial {
    const group = new THREE.Group();

    const floorMaterial = createPlazaFloorMaterial();
    const floor = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    const daisMaterial = new THREE.MeshStandardMaterial({ color: 0x6d7d99, roughness: 0.4, metalness: 0.5 });
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(PLAZA_RADIUS, PLAZA_RADIUS, 0.16, 48), daisMaterial);
    dais.position.y = 0.08;
    dais.receiveShadow = true;
    group.add(dais);

    for (const [ringRadius, color] of [[PLAZA_RADIUS - 0.6, NEON_CYAN], [PLAZA_RADIUS - 4.5, NEON_MAGENTA]] as const) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.16, 8, 64), neonMaterial(color, 5));
        ring.position.y = 0.2;
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
    }

    for (const building of MAIN_HALL_BUILDINGS) {
        const length = BUILDING_RING_RADIUS - BUILDING_DEPTH / 2 - PLAZA_RADIUS;
        const midDistance = PLAZA_RADIUS + length / 2;

        const avenue = new THREE.Group();
        avenue.rotation.y = FACING_ROTATION[building.facing];

        const road = new THREE.Mesh(
            new THREE.PlaneGeometry(11, length),
            new THREE.MeshStandardMaterial({ color: 0x515f78, roughness: 0.6, metalness: 0.25 })
        );
        road.rotation.x = -Math.PI / 2;
        road.position.set(0, 0.06, -midDistance);
        road.receiveShadow = true;
        avenue.add(road);

        for (const side of [-1, 1]) {
            const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, length), neonMaterial(building.accentHex, 4));
            kerb.position.set(side * 5.4, 0.14, -midDistance);
            avenue.add(kerb);

            for (let i = 0; i < 3; i++) {
                const lampZ = -(PLAZA_RADIUS + 6 + i * (length / 3));
                const post = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.16, 0.2, 6, 6),
                    new THREE.MeshStandardMaterial({ color: 0x3c4a63, roughness: 0.5, metalness: 0.7 })
                );
                post.position.set(side * 6.4, 3, lampZ);
                post.castShadow = true;
                avenue.add(post);

                const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), neonMaterial(0xfff0cc, 6));
                lamp.position.set(side * 6.4, 6.3, lampZ);
                avenue.add(lamp);
            }
        }

        const streetLight = new THREE.PointLight(0xffe9c4, 9, 60, 2);
        streetLight.position.set(0, 8, -midDistance);
        avenue.add(streetLight);

        group.add(avenue);
    }

    scene.add(group);
    return floorMaterial;
}

export function buildPerimeter(
    scene: THREE.Scene,
    collisionGrid: CollisionGrid,
    radius: number,
    hullMat: THREE.Material
) {
    const group = new THREE.Group();
    const wallHeight = 46;

    const hull = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, wallHeight, 48, 1, true), hullMat);
    hull.position.y = wallHeight / 2;
    hull.receiveShadow = true;
    group.add(hull);

    for (const bandHeight of [7, 21, 35]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.4, 0.3, 8, 64), neonMaterial(NEON_CYAN, 4));
        band.position.y = bandHeight;
        band.rotation.x = Math.PI / 2;
        group.add(band);
    }

    const mezzanine = new THREE.Mesh(
        new THREE.RingGeometry(radius - 9, radius - 0.5, 48),
        new THREE.MeshStandardMaterial({ color: 0x4a5871, roughness: 0.55, metalness: 0.5, side: THREE.DoubleSide })
    );
    mezzanine.position.y = 28;
    mezzanine.rotation.x = -Math.PI / 2;
    group.add(mezzanine);

    const railing = new THREE.Mesh(new THREE.TorusGeometry(radius - 9, 0.2, 8, 64), neonMaterial(NEON_MAGENTA, 4.5));
    railing.position.y = 29.2;
    railing.rotation.x = Math.PI / 2;
    group.add(railing);

    const panelCount = 24;
    for (let i = 0; i < panelCount; i++) {
        const angle = (i / panelCount) * Math.PI * 2;
        const x = Math.cos(angle) * (radius - 0.8);
        const z = Math.sin(angle) * (radius - 0.8);

        const screen = new THREE.Mesh(
            new THREE.PlaneGeometry(14, 9),
            new THREE.MeshStandardMaterial({
                color: 0x4c5c7c,
                emissive: i % 2 === 0 ? NEON_CYAN : NEON_MAGENTA,
                emissiveIntensity: 1 + Math.random() * 0.9,
                roughness: 0.3,
                metalness: 0.4,
                transparent: true,
                opacity: 0.6,
            })
        );
        screen.position.set(x, 34, z);
        screen.lookAt(0, 34, 0);
        group.add(screen);
    }

    scene.add(group);

    const wallSegments = 32;
    for (let i = 0; i < wallSegments; i++) {
        const midAngle = ((i + 0.5) / wallSegments) * Math.PI * 2;
        const x = Math.cos(midAngle) * radius;
        const z = Math.sin(midAngle) * radius;

        const segmentSize = 20;
        collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(x - segmentSize / 2, 0, z - segmentSize / 2),
            new THREE.Vector3(x + segmentSize / 2, 80, z + segmentSize / 2)
        ));
    }
}

function footprintAt(x: number, z: number, half: number, margin: number): THREE.Box3 {
    return new THREE.Box3(
        new THREE.Vector3(x - half - margin, 0, z - half - margin),
        new THREE.Vector3(x + half + margin, 1, z + half + margin)
    );
}

function addCityBlock(
    group: THREE.Group,
    collisionGrid: CollisionGrid,
    materials: THREE.MeshStandardMaterial[],
    capMat: THREE.MeshStandardMaterial,
    random: () => number,
    x: number,
    z: number,
    half: number,
    height: number,
    castShadow: boolean
) {
    const size = half * 2;
    const material = materials[Math.floor(random() * materials.length)];

    const body = new THREE.Mesh(new THREE.BoxGeometry(size, height, size), material);
    body.position.set(x, height / 2, z);
    body.castShadow = castShadow;
    body.receiveShadow = true;
    group.add(body);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(size + 1.2, 0.8, size + 1.2), capMat);
    cap.position.set(x, height + 0.4, z);
    group.add(cap);

    const accent = [NEON_CYAN, NEON_MAGENTA, NEON_AMBER, NEON_LIME][Math.floor(random() * 4)];
    const trim = new THREE.Mesh(new THREE.BoxGeometry(size + 1.5, 0.22, size + 1.5), neonMaterial(accent, 5));
    trim.position.set(x, height + 0.95, z);
    group.add(trim);

    if (random() < 0.55) {
        const mastX = x + (random() - 0.5) * size * 0.4;
        const mastZ = z + (random() - 0.5) * size * 0.4;

        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 6, 6), capMat);
        mast.position.set(mastX, height + 3.8, mastZ);
        group.add(mast);

        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), neonMaterial(NEON_MAGENTA, 8));
        beacon.position.set(mastX, height + 7.1, mastZ);
        group.add(beacon);
    }

    if (random() < 0.6) {
        const bannerHeight = 3 + random() * 5;
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.6, bannerHeight), neonMaterial(accent, 6));
        const onX = random() < 0.5;
        const side = random() < 0.5 ? 1 : -1;
        banner.position.set(
            x + (onX ? (half + 0.3) * side : 0),
            height * 0.6,
            z + (onX ? 0 : (half + 0.3) * side)
        );
        banner.rotation.y = onX ? Math.PI / 2 : 0;
        group.add(banner);
    }

    collisionGrid.insert(new THREE.Box3(
        new THREE.Vector3(x - half, 0, z - half),
        new THREE.Vector3(x + half, height + 1, z + half)
    ));
}

function distanceFromCentre(box: THREE.Box3): number {
    const dx = Math.max(box.min.x, 0, -box.max.x);
    const dz = Math.max(box.min.z, 0, -box.max.z);
    return Math.hypot(dx, dz);
}

export function buildCityBlocks(scene: THREE.Scene, collisionGrid: CollisionGrid, radius: number): CityHandles {
    const group = new THREE.Group();
    const random = makeRandom(0x5eed17);

    const materials = DISTRICT_ACCENTS.map(createCityBlockMaterial);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x4a5872, roughness: 0.5, metalness: 0.6 });

    const blockHalf = 7;
    const plazaClearance = PLAZA_RADIUS + 6;
    const blocked: THREE.Box3[] = [];

    for (const building of MAIN_HALL_BUILDINGS) {
        const npcBox = buildingFootprint(building.facing).clone();
        npcBox.min.x -= 2; npcBox.min.z -= 2;
        npcBox.max.x += 2; npcBox.max.z += 2;
        npcBox.min.y = 0; npcBox.max.y = 1;
        blocked.push(npcBox);
    }

    const avenueHalfWidth = 9;
    blocked.push(new THREE.Box3(new THREE.Vector3(-avenueHalfWidth, 0, -radius), new THREE.Vector3(avenueHalfWidth, 1, -plazaClearance)));
    blocked.push(new THREE.Box3(new THREE.Vector3(-avenueHalfWidth, 0, plazaClearance), new THREE.Vector3(avenueHalfWidth, 1, radius)));
    blocked.push(new THREE.Box3(new THREE.Vector3(plazaClearance, 0, -avenueHalfWidth), new THREE.Vector3(radius, 1, avenueHalfWidth)));
    blocked.push(new THREE.Box3(new THREE.Vector3(-radius, 0, -avenueHalfWidth), new THREE.Vector3(-plazaClearance, 1, avenueHalfWidth)));

    const gridCoords = [-82, -60, -38, -16, 16, 38, 60, 82];
    for (const x of gridCoords) {
        for (const z of gridCoords) {
            const footprint = footprintAt(x, z, blockHalf, 0);
            if (Math.hypot(Math.abs(x) + blockHalf, Math.abs(z) + blockHalf) > 90) continue;
            if (distanceFromCentre(footprint) < plazaClearance) continue;
            if (blocked.some((box) => box.intersectsBox(footprint))) continue;

            const distance = Math.hypot(x, z);
            const height = 10 + (distance - 40) * 0.32 + random() * 7;
            addCityBlock(group, collisionGrid, materials, capMat, random, x, z, blockHalf, height, true);
            blocked.push(footprint);
        }
    }

    const skylineHalf = 4;
    const skylineRadius = radius - 7;
    const skylineCount = 38;
    for (let i = 0; i < skylineCount; i++) {
        const angle = (i / skylineCount) * Math.PI * 2 + 0.11;
        const x = Math.cos(angle) * skylineRadius;
        const z = Math.sin(angle) * skylineRadius;

        const footprint = footprintAt(x, z, skylineHalf, 0);
        if (blocked.some((box) => box.intersectsBox(footprint))) continue;

        addCityBlock(group, collisionGrid, materials, capMat, random, x, z, skylineHalf, 26 + random() * 18, false);
    }

    scene.add(group);
    return { materials: [...materials, capMat] };
}

export function buildSkyDome(scene: THREE.Scene, radius: number): THREE.MeshBasicMaterial {
    const group = new THREE.Group();
    const domeHeight = 74;

    const skyMaterial = createSkyDomeMaterial();
    const dome = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2),
        skyMaterial
    );
    dome.scale.y = domeHeight / radius;
    group.add(dome);

    const ribCount = 12;
    for (let i = 0; i < ribCount; i++) {
        const angle = (i / ribCount) * Math.PI * 2;
        const points: THREE.Vector3[] = [];
        for (let j = 0; j <= 12; j++) {
            const t = j / 12;
            const phi = t * Math.PI / 2;
            const r = radius * (1 - t * 0.08);
            points.push(new THREE.Vector3(
                Math.cos(angle) * r * Math.sin(phi),
                r * Math.cos(phi) * (domeHeight / radius),
                Math.sin(angle) * r * Math.sin(phi)
            ));
        }
        const rib = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, 0.3, 6, false),
            neonMaterial(NEON_CYAN, 2.4)
        );
        group.add(rib);
    }

    scene.add(group);
    return skyMaterial;
}

function addShard(group: THREE.Group, crystals: CrystalData[], x: number, y: number, z: number, size: 'large' | 'medium' | 'small', color: number) {
    const sizeMap = {
        large: { radius: 1.6, height: 6 },
        medium: { radius: 1.1, height: 4 },
        small: { radius: 0.7, height: 2.6 },
    };
    const params = sizeMap[size];

    const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(params.radius, 0),
        new THREE.MeshStandardMaterial({
            color: 0xeafaff,
            emissive: color,
            emissiveIntensity: 4,
            metalness: 0.2,
            roughness: 0.1,
            transparent: true,
            opacity: 0.9,
        })
    );
    shard.position.set(x, y, z);
    shard.scale.y = params.height / (params.radius * 2);
    shard.rotation.y = Math.random() * Math.PI;
    group.add(shard);

    crystals.push({ mesh: shard, light: null as any, baseIntensity: 0, offset: crystals.length, size });
}

export function buildHoloCanopy(scene: THREE.Scene): CrystalData[] {
    const crystals: CrystalData[] = [];

    const canopy = new THREE.Group();
    canopy.position.set(0, 52, 0);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x465572, roughness: 0.4, metalness: 0.7 });
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(26, 0.9, 8, 48), frameMat);
    outerRing.rotation.x = Math.PI / 2;
    canopy.add(outerRing);

    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(16, 0.6, 8, 32), frameMat);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = -5;
    canopy.add(innerRing);

    for (const [ringRadius, offsetY, color] of [[26, 0.9, NEON_CYAN], [16, -4.1, NEON_MAGENTA]] as const) {
        const glow = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.22, 8, 48), neonMaterial(color, 6));
        glow.rotation.x = Math.PI / 2;
        glow.position.y = offsetY;
        canopy.add(glow);
    }

    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        addShard(canopy, crystals, Math.cos(angle) * 26, -14, Math.sin(angle) * 26, 'large', NEON_CYAN);
    }
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + 0.3;
        addShard(canopy, crystals, Math.cos(angle) * 16, -10, Math.sin(angle) * 16, 'medium', NEON_MAGENTA);
    }
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        addShard(canopy, crystals, Math.cos(angle) * 8, -7, Math.sin(angle) * 8, 'small', NEON_CYAN);
    }

    const hallLight = new THREE.PointLight(0xdcefff, 60, 300, 2);
    hallLight.position.set(0, -10, 0);
    canopy.add(hallLight);

    const rimLight = new THREE.PointLight(0xffd0ec, 24, 240, 2);
    rimLight.position.set(0, -34, 0);
    canopy.add(rimLight);

    scene.add(canopy);
    return crystals;
}

function buildOneBuilding(scene: THREE.Scene, collisionGrid: CollisionGrid, config: MainHallBuilding, handles: BuildingHandles) {
    const group = new THREE.Group();
    const position = buildingPosition(config.facing);
    group.position.copy(position);
    group.rotation.y = FACING_ROTATION[config.facing];

    const facadeMat = createFacadeMaterial(config.accent);
    handles.facadeMaterials.push(facadeMat);

    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x404e6a, roughness: 0.55, metalness: 0.5 });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(BUILDING_WIDTH, 1, BUILDING_DEPTH), plinthMat);
    plinth.position.y = 0.5;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);

    const body = new THREE.Mesh(new THREE.BoxGeometry(BUILDING_WIDTH, BUILDING_HEIGHT, BUILDING_DEPTH), facadeMat);
    body.position.y = 1 + BUILDING_HEIGHT / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(BUILDING_WIDTH + 2, 1, BUILDING_DEPTH + 2), plinthMat);
    roof.position.y = 1 + BUILDING_HEIGHT + 0.5;
    roof.castShadow = true;
    group.add(roof);

    const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(BUILDING_WIDTH + 2.4, 0.3, BUILDING_DEPTH + 2.4), neonMaterial(config.accentHex, 5));
    roofTrim.position.y = 1 + BUILDING_HEIGHT + 1.15;
    group.add(roofTrim);

    const frontZ = BUILDING_DEPTH / 2 + 0.05;

    const doorway = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 7),
        new THREE.MeshStandardMaterial({
            color: 0x1b2434,
            emissive: config.accentHex,
            emissiveIntensity: 1.6,
            roughness: 0.25,
            metalness: 0.4,
            transparent: true,
            opacity: 0.9,
        })
    );
    doorway.position.set(0, 4.6, frontZ);
    group.add(doorway);

    const doorFrame = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.22, 8, 6, Math.PI), neonMaterial(config.accentHex, 6));
    doorFrame.position.set(0, 8.1, frontZ + 0.05);
    group.add(doorFrame);

    for (const side of [-1, 1]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, BUILDING_HEIGHT - 2, 0.3), neonMaterial(config.accentHex, 4.5));
        strip.position.set(side * (BUILDING_WIDTH / 2 - 1), 1 + BUILDING_HEIGHT / 2, frontZ);
        group.add(strip);
    }

    const sign = createNpcSignBoard(config.npcName, config.role, config.icon, config.accent);
    sign.position.set(0, 1 + BUILDING_HEIGHT - 2.4, frontZ + 0.35);
    group.add(sign);
    handles.signs.push(sign);

    const doorLight = new THREE.PointLight(config.accentHex, 10, 34, 2);
    doorLight.position.set(0, 5, frontZ + 3);
    group.add(doorLight);

    scene.add(group);
    collisionGrid.insert(buildingFootprint(config.facing));
}

export function buildBuildings(scene: THREE.Scene, collisionGrid: CollisionGrid): BuildingHandles {
    const handles: BuildingHandles = { facadeMaterials: [], signs: [] };
    for (const config of MAIN_HALL_BUILDINGS) {
        buildOneBuilding(scene, collisionGrid, config, handles);
    }
    return handles;
}
