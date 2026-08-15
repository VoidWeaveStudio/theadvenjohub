// src/features/game/world/locations/main-world/systems/TowerExteriorBuilder.ts
import * as THREE from "three";
import { MainWorld } from "../MainWorld";
import { TOWER_X, TOWER_Z } from "../worldConfig";
import { applyTowerTextures, loadTowerTextures } from "../utils/towerTextures";

export interface TowerExteriorResult {
    towerGroup: THREE.Group;
    leftDoorGroup: THREE.Group;
    rightDoorGroup: THREE.Group;
    towerPortalMesh: THREE.Mesh;
    towerLights: THREE.Light[];
    towerEntrancePos: THREE.Vector3;
    doorZ: number;
}

const PLINTH_RADIUS = 35;
const PLINTH_TOP = 0.55;
const SHAFT_RADIUS = 31;
const SHAFT_TOP = 186;
const GALLERY_RADIUS = 36;
const GALLERY_TOP = 206;
const CROWN_TOP = 232;

const DOOR_WIDTH = 16;
const DOOR_HEIGHT = 27;
const WINDOW_ROWS = [58, 104, 150];
const MERLON_COUNT = 18;
const CORBEL_COUNT = 30;
const BUTTRESS_COUNT = 8;
const TIER_RADII = [33, 30, 27.5];
const TIER_TOPS = [70, 128, 186];
const ENTRANCE_YAW = -Math.PI / 2;
const PLAZA_RADIUS = 74;
const JAMB_DEPTH = 7;
const GATE_GAP_HALF = 0.34;

export function createProceduralTexture(type: 'noise' | 'smoke'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    if (type === 'smoke') {
        const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        grad.addColorStop(0, 'rgba(200, 200, 200, 1)');
        grad.addColorStop(0.4, 'rgba(150, 150, 150, 0.4)');
        grad.addColorStop(1, 'rgba(100, 100, 100, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
    } else {
        for (let i = 0; i < 40000; i++) {
            ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`;
            ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function lancetShape(width: number, height: number): THREE.Shape {
    const shape = new THREE.Shape();
    const half = width / 2;
    const straight = height - half;

    shape.moveTo(-half, 0);
    shape.lineTo(-half, straight);
    shape.quadraticCurveTo(-half, height, 0, height);
    shape.quadraticCurveTo(half, height, half, straight);
    shape.lineTo(half, 0);
    shape.closePath();

    return shape;
}

export function buildTowerExterior(world: MainWorld): TowerExteriorResult {
    const towerX = TOWER_X;
    const towerZ = TOWER_Z;
    const groundY = world.terrain.getHeightAt(towerX, towerZ);

    const towerGroup = new THREE.Group();
    towerGroup.position.set(towerX, groundY, towerZ);
    towerGroup.rotation.y = ENTRANCE_YAW;

    const towerLights: THREE.Light[] = [];
    const wallTex = loadTowerTextures("castle_wall_slates", 6, 9);
    const trimTex = loadTowerTextures("castle_brick_02_white", 3, 3);
    const pavingTex = loadTowerTextures("cobblestone_02", 14, 14);

    const matStone = applyTowerTextures(new THREE.MeshStandardMaterial({
        color: 0xb4ad9d,
        roughness: 1,
        metalness: 0.04,
    }), wallTex);

    const matTrim = applyTowerTextures(new THREE.MeshStandardMaterial({
        color: 0xcfc7b4,
        roughness: 0.95,
        metalness: 0.04,
    }), trimTex);

    const matDark = new THREE.MeshStandardMaterial({
        color: 0x3b3831,
        roughness: 0.9,
        metalness: 0.08,
    });

    const matIron = new THREE.MeshStandardMaterial({
        color: 0x2a2724,
        roughness: 0.62,
        metalness: 0.72,
    });

    const matWood = new THREE.MeshStandardMaterial({
        color: 0x4a2f1c,
        roughness: 0.86,
        metalness: 0.03,
    });

    const matPaving = applyTowerTextures(new THREE.MeshStandardMaterial({
        color: 0x9a9488,
        roughness: 1,
        metalness: 0.03,
    }), pavingTex);

    const matGlass = new THREE.MeshStandardMaterial({
        color: 0x6b3fd4,
        emissive: 0x8a5cff,
        emissiveIntensity: 2.4,
        roughness: 0.35,
        metalness: 0.1,
        toneMapped: false,
    });

    const addMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = y;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        towerGroup.add(mesh);
        return mesh;
    };

    const plaza = new THREE.Mesh(new THREE.BoxGeometry(PLAZA_RADIUS * 1.15, 0.5, PLAZA_RADIUS), matPaving);
    plaza.position.set(0, -0.2, PLINTH_RADIUS + PLAZA_RADIUS * 0.42);
    plaza.receiveShadow = true;
    towerGroup.add(plaza);

    for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 6.5, 8), matTrim);
            post.userData.solid = true;
            post.position.set(side * PLAZA_RADIUS * 0.575, 3.2, PLINTH_RADIUS + 14 + i * 22);
            post.castShadow = true;
            towerGroup.add(post);

            const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), matGlass);
            lamp.position.set(post.position.x, 7.4, post.position.z);
            towerGroup.add(lamp);

            const lampLight = new THREE.PointLight(0x8a5cff, 3.2, 26, 2);
            lampLight.position.copy(lamp.position);
            towerGroup.add(lampLight);
            towerLights.push(lampLight);
        }
    }

    addMesh(new THREE.CylinderGeometry(PLINTH_RADIUS - 1.5, PLINTH_RADIUS, PLINTH_TOP, 56), matStone, PLINTH_TOP / 2);

    let previousTop = PLINTH_TOP;
    for (let tier = 0; tier < TIER_RADII.length; tier++) {
        const radius = TIER_RADII[tier];
        const top = TIER_TOPS[tier];
        const height = top - previousTop;
        const taper = tier === TIER_RADII.length - 1 ? 0.94 : 0.98;

        if (tier === 0) {
            addMesh(
                new THREE.CylinderGeometry(
                    radius * taper, radius, height, 48, 1, true,
                    GATE_GAP_HALF, Math.PI * 2 - GATE_GAP_HALF * 2
                ),
                matStone,
                previousTop + height / 2
            );
        } else {
            addMesh(
                new THREE.CylinderGeometry(radius * taper, radius, height, 56, 1, true),
                matStone,
                previousTop + height / 2
            );
        }

        const cornice = new THREE.Mesh(new THREE.CylinderGeometry(radius + 2.4, radius * taper + 1.2, 3.4, 56), matTrim);
        cornice.position.y = top;
        cornice.castShadow = true;
        cornice.receiveShadow = true;
        towerGroup.add(cornice);

        previousTop = top;
    }

    for (let i = 0; i < BUTTRESS_COUNT; i++) {
        const angle = (i / BUTTRESS_COUNT) * Math.PI * 2 + Math.PI / BUTTRESS_COUNT;
        const height = SHAFT_TOP - PLINTH_TOP * 0.5;
        const buttress = new THREE.Mesh(new THREE.BoxGeometry(3.6, height, 5.2), matStone);

        buttress.position.set(
            Math.sin(angle) * (SHAFT_RADIUS + 0.4),
            PLINTH_TOP * 0.5 + height / 2,
            Math.cos(angle) * (SHAFT_RADIUS + 0.4)
        );
        buttress.rotation.y = angle;
        buttress.castShadow = true;
        buttress.receiveShadow = true;
        towerGroup.add(buttress);

        const cap = new THREE.Mesh(new THREE.ConeGeometry(2.9, 5.5, 4), matTrim);
        cap.position.set(buttress.position.x, PLINTH_TOP * 0.5 + height + 2.4, buttress.position.z);
        cap.rotation.y = angle + Math.PI / 4;
        cap.castShadow = true;
        towerGroup.add(cap);
    }

    const windowGeometry = new THREE.ExtrudeGeometry(lancetShape(3.1, 8.4), {
        depth: 1.4,
        bevelEnabled: true,
        bevelSize: 0.18,
        bevelThickness: 0.18,
        bevelSegments: 1,
        curveSegments: 6,
    });

    WINDOW_ROWS.forEach((rowY, rowIndex) => {
        const tier = TIER_TOPS.findIndex((top) => rowY < top);
        const radius = TIER_RADII[tier < 0 ? TIER_RADII.length - 1 : tier];
        const count = 6;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (rowIndex % 2) * (Math.PI / count);

            const recess = new THREE.Mesh(windowGeometry, matDark);
            recess.position.set(Math.sin(angle) * (radius - 0.4), rowY, Math.cos(angle) * (radius - 0.4));
            recess.rotation.y = angle;
            towerGroup.add(recess);

            const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 6.6), matGlass);
            pane.position.set(Math.sin(angle) * (radius + 0.55), rowY + 0.6, Math.cos(angle) * (radius + 0.55));
            pane.rotation.y = angle;
            towerGroup.add(pane);

            if (i % 2 === 0) {
                const glow = new THREE.PointLight(0x8a5cff, 4.5, 34, 2);
                glow.position.copy(pane.position);
                towerGroup.add(glow);
                towerLights.push(glow);
            }
        }
    });

    for (let i = 0; i < CORBEL_COUNT; i++) {
        const angle = (i / CORBEL_COUNT) * Math.PI * 2;
        const corbel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 4.6), matTrim);
        corbel.position.set(
            Math.sin(angle) * (SHAFT_RADIUS + 1.4),
            SHAFT_TOP + 2.6,
            Math.cos(angle) * (SHAFT_RADIUS + 1.4)
        );
        corbel.rotation.y = angle;
        corbel.castShadow = true;
        towerGroup.add(corbel);
    }

    addMesh(
        new THREE.CylinderGeometry(GALLERY_RADIUS, GALLERY_RADIUS - 1.6, GALLERY_TOP - SHAFT_TOP - 4, 56),
        matStone,
        SHAFT_TOP + 4 + (GALLERY_TOP - SHAFT_TOP - 4) / 2
    );

    const parapet = new THREE.Mesh(new THREE.CylinderGeometry(GALLERY_RADIUS + 0.6, GALLERY_RADIUS + 0.6, 2.6, 56), matTrim);
    parapet.position.y = GALLERY_TOP;
    parapet.castShadow = true;
    towerGroup.add(parapet);

    for (let i = 0; i < MERLON_COUNT; i++) {
        const angle = (i / MERLON_COUNT) * Math.PI * 2;
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(5.2, CROWN_TOP - GALLERY_TOP, 3.4), matStone);
        merlon.position.set(
            Math.sin(angle) * GALLERY_RADIUS,
            GALLERY_TOP + (CROWN_TOP - GALLERY_TOP) / 2,
            Math.cos(angle) * GALLERY_RADIUS
        );
        merlon.rotation.y = angle;
        merlon.castShadow = true;
        merlon.receiveShadow = true;
        towerGroup.add(merlon);
    }

    const spire = new THREE.Mesh(new THREE.ConeGeometry(9, 22, 8), matTrim);
    spire.position.y = CROWN_TOP + 9;
    spire.castShadow = true;
    towerGroup.add(spire);

    const beacon = new THREE.Mesh(
        new THREE.OctahedronGeometry(4.6, 1),
        new THREE.MeshStandardMaterial({
            color: 0xc9a4ff,
            emissive: 0x9a63ff,
            emissiveIntensity: 3.2,
            roughness: 0.2,
            metalness: 0.1,
            toneMapped: false,
        })
    );
    beacon.position.y = CROWN_TOP + 26;
    towerGroup.add(beacon);

    const beaconLight = new THREE.PointLight(0x9a63ff, 14, 90, 2);
    beaconLight.position.y = CROWN_TOP + 26;
    towerGroup.add(beaconLight);
    towerLights.push(beaconLight);

    const doorZ = TIER_RADII[0] - 0.6;
    const doorBase = 0.12;
    const facadeZ = doorZ + 2.4;


    const risalitWidth = DOOR_WIDTH + 15;
    const risalitDepth = 6.5;
    const risalitHeight = DOOR_HEIGHT + 16;

    const pierWidth = (risalitWidth - DOOR_WIDTH - 2) / 2;
    for (const side of [-1, 1]) {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(pierWidth, risalitHeight, risalitDepth), matStone);
        pier.position.set(
            side * (DOOR_WIDTH / 2 + 1 + pierWidth / 2),
            doorBase + risalitHeight / 2,
            doorZ - risalitDepth / 2 + 2.4
        );
        pier.castShadow = true;
        pier.receiveShadow = true;
        towerGroup.add(pier);
    }

    const lintelHeight = risalitHeight - DOOR_HEIGHT - 6;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(risalitWidth, lintelHeight, risalitDepth), matStone);
    lintel.position.set(0, doorBase + DOOR_HEIGHT + 6 + lintelHeight / 2, doorZ - risalitDepth / 2 + 2.4);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    towerGroup.add(lintel);

    const gateFillBase = doorBase + risalitHeight;
    const gateFillHeight = TIER_TOPS[0] - gateFillBase;
    if (gateFillHeight > 0) {
        const spanBottom = (gateFillBase - PLINTH_TOP) / (TIER_TOPS[0] - PLINTH_TOP);
        const spanTop = 1;
        const radiusAt = (t: number) => TIER_RADII[0] * (1 - 0.02 * t);

        const gateFill = new THREE.Mesh(
            new THREE.CylinderGeometry(
                radiusAt(spanTop), radiusAt(spanBottom), gateFillHeight, 20, 1, true,
                -GATE_GAP_HALF, GATE_GAP_HALF * 2
            ),
            matStone
        );
        gateFill.position.y = gateFillBase + gateFillHeight / 2;
        gateFill.castShadow = true;
        gateFill.receiveShadow = true;
        towerGroup.add(gateFill);
    }

    const risalitCap = new THREE.Mesh(new THREE.BoxGeometry(risalitWidth + 3, 2.4, risalitDepth + 3), matTrim);
    risalitCap.position.set(0, doorBase + risalitHeight + 1.2, doorZ - risalitDepth / 2 + 2.4);
    risalitCap.castShadow = true;
    towerGroup.add(risalitCap);

    const gable = new THREE.Mesh(new THREE.ConeGeometry(risalitWidth * 0.62, 9, 4), matTrim);
    gable.position.set(0, doorBase + risalitHeight + 6.4, doorZ - risalitDepth / 2 + 2.4);
    gable.rotation.y = Math.PI / 4;
    gable.castShadow = true;
    towerGroup.add(gable);

    const archOuter = lancetShape(DOOR_WIDTH + 7, DOOR_HEIGHT + 8);
    archOuter.holes.push(lancetShape(DOOR_WIDTH, DOOR_HEIGHT));

    const archFrame = new THREE.Mesh(
        new THREE.ExtrudeGeometry(archOuter, {
            depth: 2.6,
            bevelEnabled: true,
            bevelSize: 0.42,
            bevelThickness: 0.4,
            bevelSegments: 2,
            curveSegments: 12,
        }),
        matTrim
    );
    archFrame.position.set(0, doorBase, facadeZ);
    archFrame.castShadow = true;
    archFrame.receiveShadow = true;
    towerGroup.add(archFrame);

    const jambSide = new THREE.BoxGeometry(1.6, DOOR_HEIGHT + 6, JAMB_DEPTH);
    for (const side of [-1, 1]) {
        const inner = new THREE.Mesh(jambSide, matDark);
        inner.position.set(side * (DOOR_WIDTH / 2 + 0.4), doorBase + (DOOR_HEIGHT + 6) / 2, facadeZ - JAMB_DEPTH / 2);
        towerGroup.add(inner);
    }

    const soffit = new THREE.Mesh(new THREE.BoxGeometry(DOOR_WIDTH + 3, 1.6, JAMB_DEPTH), matDark);
    soffit.position.set(0, doorBase + DOOR_HEIGHT + 6, facadeZ - JAMB_DEPTH / 2);
    towerGroup.add(soffit);

    const keystone = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.6, 3.2), matTrim);
    keystone.position.set(0, doorBase + DOOR_HEIGHT + 2.4, facadeZ + 0.9);
    keystone.castShadow = true;
    towerGroup.add(keystone);

    const makeLeaf = (side: -1 | 1) => {
        const group = new THREE.Group();
        const leafWidth = DOOR_WIDTH / 2 - 0.3;
        const leafHeight = DOOR_HEIGHT - 0.8;
        const centre = (side * leafWidth) / 2;

        for (let p = 0; p < 4; p++) {
            const plankWidth = leafWidth / 4 - 0.12;
            const plank = new THREE.Mesh(new THREE.BoxGeometry(plankWidth, leafHeight, 0.85), matWood);
            plank.position.set(side * (p + 0.5) * (leafWidth / 4), leafHeight / 2, 0);
            plank.castShadow = true;
            plank.receiveShadow = true;
            group.add(plank);
        }

        for (let i = 0; i < 3; i++) {
            const band = new THREE.Mesh(new THREE.BoxGeometry(leafWidth * 0.96, 0.85, 1.15), matIron);
            band.position.set(centre, 3.2 + i * 9.4, 0.16);
            band.castShadow = true;
            group.add(band);
        }

        const brace = new THREE.Mesh(new THREE.BoxGeometry(leafWidth * 1.05, 0.6, 1.05), matIron);
        brace.position.set(centre, leafHeight / 2, 0.16);
        brace.rotation.z = side * 0.5;
        group.add(brace);

        for (let h = 0; h < 3; h++) {
            const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.6, 8), matIron);
            hinge.position.set(0, 3.2 + h * 9.4, 0);
            group.add(hinge);
        }

        const ringPost = new THREE.Mesh(new THREE.SphereGeometry(0.52, 10, 8), matIron);
        ringPost.position.set(side * (leafWidth - 1.6), leafHeight * 0.46, 0.62);
        group.add(ringPost);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.16, 8, 20), matIron);
        ring.position.set(side * (leafWidth - 1.6), leafHeight * 0.46 - 0.9, 0.62);
        ring.castShadow = true;
        group.add(ring);

        return group;
    };

    const leftDoorGroup = makeLeaf(1);
    leftDoorGroup.position.set(-DOOR_WIDTH / 2 + 0.2, doorBase, facadeZ - 1.1);
    towerGroup.add(leftDoorGroup);

    const rightDoorGroup = makeLeaf(-1);
    rightDoorGroup.position.set(DOOR_WIDTH / 2 - 0.2, doorBase, facadeZ - 1.1);
    towerGroup.add(rightDoorGroup);

    const voidBox = new THREE.Mesh(
        new THREE.BoxGeometry(DOOR_WIDTH * 1.9, DOOR_HEIGHT * 1.7, 25),
        new THREE.MeshBasicMaterial({ color: 0x030309, fog: false, side: THREE.BackSide })
    );
    voidBox.position.set(0, doorBase + DOOR_HEIGHT * 0.5, facadeZ - JAMB_DEPTH - 12.5);
    towerGroup.add(voidBox);

    const towerPortalMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(DOOR_WIDTH - 1.5, DOOR_HEIGHT - 2),
        new THREE.MeshBasicMaterial({ color: 0x0a0620, transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: false })
    );
    towerPortalMesh.position.set(0, doorBase + DOOR_HEIGHT / 2 - 1, facadeZ - JAMB_DEPTH + 0.3);
    towerGroup.add(towerPortalMesh);

    world.scene.add(towerGroup);
    towerGroup.updateMatrixWorld(true);

    const towerEntrancePos = new THREE.Vector3(0, 2, doorZ + 10).applyMatrix4(towerGroup.matrixWorld);

    const _worldPoint = new THREE.Vector3();
    towerGroup.traverse((child) => {
        if (!child.userData.solid) return;
        child.getWorldPosition(_worldPoint);
        world.addSolidPillar(_worldPoint.x, _worldPoint.y, _worldPoint.z, 1.5, 7);
    });

    world.addSolidPillar(towerX, groundY + CROWN_TOP / 2, towerZ, PLINTH_RADIUS - 1.5, CROWN_TOP);

    const cameraBox = new THREE.Box3(
        new THREE.Vector3(towerX - PLINTH_RADIUS, groundY, towerZ - PLINTH_RADIUS),
        new THREE.Vector3(towerX + PLINTH_RADIUS, groundY + CROWN_TOP, towerZ + PLINTH_RADIUS)
    );
    world.colliders.push(cameraBox);
    world.terrainCollisionGrid.insert(cameraBox);

    return { towerGroup, leftDoorGroup, rightDoorGroup, towerPortalMesh, towerLights, towerEntrancePos, doorZ };
}
