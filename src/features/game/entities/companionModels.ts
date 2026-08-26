// src/features/game/entities/companionModels.ts
import * as THREE from "three";
import { CompanionId } from "../data/companions";
import { createProceduralDog, animateDog, disposeDog } from "./proceduralDog";
import { createWardenSlime } from "./wardenSlime";

export interface CompanionMood {
    delta: number;
    combat: boolean;
    resting: boolean;
}

export interface CompanionInstance {
    root: THREE.Group;
    update(elapsed: number, speed01: number, carrying: boolean, mood?: CompanionMood): void;
    dispose(): void;
    attack?(): void;
    getMuzzle?(out: THREE.Vector3): boolean;
}

interface QuadrupedParts {
    root: THREE.Group;
    body: THREE.Group;
    head: THREE.Group;
    tail: THREE.Object3D;
    legs: THREE.Object3D[];
    ears: THREE.Object3D[];
    bodyY: number;
}

interface QuadrupedConfig {
    fur: number;
    furDark: number;
    muzzle: number;
    accent: number;
    ears: "prick" | "flop" | "horn";
    tail: "straight" | "curl" | "tuft";
    rounded: boolean;
    bulk: number;
    emissive?: number;
}

const EYE_COLOR = 0x141018;

function standard(color: number, rough = 0.85, metal = 0.05): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

function glowing(color: number, emissive: number, intensity = 1.4): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: intensity,
        roughness: 0.28,
        metalness: 0.3,
    });
}

function sparkTexture(): THREE.CanvasTexture {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.35, "rgba(255,236,180,0.75)");
    gradient.addColorStop(1, "rgba(255,190,80,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

function disposeTree(root: THREE.Object3D): void {
    root.traverse((obj) => {
        const renderable = obj as THREE.Mesh & THREE.Points;
        if (!renderable.isMesh && !renderable.isPoints) return;
        renderable.geometry?.dispose();
        const material = renderable.material as THREE.Material | THREE.Material[];
        const list = Array.isArray(material) ? material : [material];
        for (const entry of list) {
            (entry as THREE.PointsMaterial)?.map?.dispose();
            entry?.dispose();
        }
    });
    root.removeFromParent();
}

function addEyes(head: THREE.Group, offsetX: number, offsetY: number, offsetZ: number, size: number): void {
    const material = new THREE.MeshStandardMaterial({ color: EYE_COLOR, roughness: 0.2, metalness: 0.1 });
    for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(size, size, size * 0.6), material);
        eye.position.set(side * offsetX, offsetY, offsetZ);
        head.add(eye);
    }
}

function buildQuadruped(config: QuadrupedConfig): QuadrupedParts {
    const root = new THREE.Group();
    const furMat = standard(config.fur);
    const darkMat = standard(config.furDark);
    const muzzleMat = standard(config.muzzle, 0.7);
    const accentMat = config.emissive !== undefined
        ? glowing(config.accent, config.emissive)
        : standard(config.accent, 0.4, 0.6);

    const bulk = config.bulk;
    const bodyY = 0.44 * bulk;

    const body = new THREE.Group();
    body.position.y = bodyY;
    root.add(body);

    const torso = config.rounded
        ? new THREE.Mesh(new THREE.CapsuleGeometry(0.19 * bulk, 0.42 * bulk, 4, 12), furMat)
        : new THREE.Mesh(new THREE.BoxGeometry(0.36 * bulk, 0.32 * bulk, 0.7 * bulk), furMat);
    if (config.rounded) torso.rotation.x = Math.PI / 2;
    torso.castShadow = true;
    body.add(torso);

    const haunch = config.rounded
        ? new THREE.Mesh(new THREE.SphereGeometry(0.21 * bulk, 14, 12), darkMat)
        : new THREE.Mesh(new THREE.BoxGeometry(0.38 * bulk, 0.36 * bulk, 0.26 * bulk), darkMat);
    haunch.position.set(0, 0.01 * bulk, -0.26 * bulk);
    haunch.castShadow = true;
    body.add(haunch);

    const head = new THREE.Group();
    head.position.set(0, 0.18 * bulk, 0.44 * bulk);
    body.add(head);

    const skull = config.rounded
        ? new THREE.Mesh(new THREE.SphereGeometry(0.17 * bulk, 16, 14), furMat)
        : new THREE.Mesh(new THREE.BoxGeometry(0.3 * bulk, 0.28 * bulk, 0.3 * bulk), furMat);
    skull.castShadow = true;
    head.add(skull);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.17 * bulk, 0.14 * bulk, 0.2 * bulk), muzzleMat);
    snout.position.set(0, -0.06 * bulk, 0.2 * bulk);
    snout.castShadow = true;
    head.add(snout);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.09 * bulk, 0.07 * bulk, 0.05 * bulk), standard(0x241d19, 0.6));
    nose.position.set(0, -0.04 * bulk, 0.31 * bulk);
    head.add(nose);

    addEyes(head, 0.09 * bulk, 0.04 * bulk, 0.15 * bulk, 0.055 * bulk);

    const ears: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
        let ear: THREE.Mesh;
        if (config.ears === "horn") {
            ear = new THREE.Mesh(new THREE.ConeGeometry(0.05 * bulk, 0.2 * bulk, 8), accentMat);
            ear.rotation.z = side * -0.7;
        } else if (config.ears === "prick") {
            ear = new THREE.Mesh(new THREE.ConeGeometry(0.06 * bulk, 0.17 * bulk, 4), darkMat);
        } else {
            ear = new THREE.Mesh(new THREE.BoxGeometry(0.07 * bulk, 0.18 * bulk, 0.05 * bulk), darkMat);
            ear.rotation.x = 0.4;
        }
        ear.position.set(side * 0.11 * bulk, 0.18 * bulk, -0.01 * bulk);
        ear.castShadow = true;
        head.add(ear);
        ears.push(ear);
    }

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16 * bulk, 0.03 * bulk, 6, 14), accentMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, -0.04 * bulk, 0.34 * bulk);
    body.add(collar);

    const legs: THREE.Object3D[] = [];
    const legGeo = config.rounded
        ? new THREE.CapsuleGeometry(0.05 * bulk, 0.26 * bulk, 3, 8)
        : new THREE.BoxGeometry(0.1 * bulk, 0.36 * bulk, 0.1 * bulk);
    const pawGeo = new THREE.BoxGeometry(0.11 * bulk, 0.06 * bulk, 0.13 * bulk);
    const offsets: [number, number][] = [
        [-0.13 * bulk, 0.24 * bulk],
        [0.13 * bulk, 0.24 * bulk],
        [-0.13 * bulk, -0.24 * bulk],
        [0.13 * bulk, -0.24 * bulk],
    ];
    for (const [x, z] of offsets) {
        const pivot = new THREE.Group();
        pivot.position.set(x, -0.14 * bulk, z);
        body.add(pivot);

        const leg = new THREE.Mesh(legGeo, darkMat);
        leg.position.y = -0.18 * bulk;
        leg.castShadow = true;
        pivot.add(leg);

        const paw = new THREE.Mesh(pawGeo, muzzleMat);
        paw.position.set(0, -0.34 * bulk, 0.01 * bulk);
        pivot.add(paw);

        legs.push(pivot);
    }

    const tail = new THREE.Group();
    tail.position.set(0, 0.14 * bulk, -0.36 * bulk);
    body.add(tail);

    if (config.tail === "curl") {
        const curl = new THREE.Mesh(new THREE.TorusGeometry(0.11 * bulk, 0.04 * bulk, 8, 16, Math.PI * 1.5), furMat);
        curl.rotation.y = Math.PI / 2;
        curl.position.set(0, 0.1 * bulk, -0.04 * bulk);
        curl.castShadow = true;
        tail.add(curl);
    } else if (config.tail === "tuft") {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * bulk, 0.025 * bulk, 0.3 * bulk, 6), darkMat);
        rope.rotation.x = Math.PI / 2.4;
        rope.position.z = -0.13 * bulk;
        tail.add(rope);
        const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.06 * bulk, 8, 8), furMat);
        tuft.position.set(0, -0.1 * bulk, -0.24 * bulk);
        tail.add(tuft);
    } else {
        const stick = new THREE.Mesh(new THREE.BoxGeometry(0.07 * bulk, 0.07 * bulk, 0.3 * bulk), furMat);
        stick.position.z = -0.15 * bulk;
        stick.castShadow = true;
        tail.add(stick);
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.08 * bulk, 0.08 * bulk, 0.1 * bulk), darkMat);
        tip.position.z = -0.32 * bulk;
        tail.add(tip);
    }

    return { root, body, head, tail, legs, ears, bodyY };
}

function animateQuadruped(parts: QuadrupedParts, elapsed: number, speed01: number, carrying: boolean): void {
    const gait = elapsed * (6 + speed01 * 10);
    const swing = 0.15 + speed01 * 0.75;

    for (let i = 0; i < parts.legs.length; i++) {
        const phase = i === 0 || i === 3 ? 0 : Math.PI;
        parts.legs[i].rotation.x = Math.sin(gait + phase) * swing;
    }

    const bob = Math.abs(Math.sin(gait)) * (0.012 + speed01 * 0.03);
    parts.body.position.y = parts.bodyY + bob;
    parts.body.rotation.z = Math.sin(gait * 0.5) * 0.03 * speed01;

    const wag = carrying ? 3.2 : 1.4 + speed01 * 1.6;
    parts.tail.rotation.y = Math.sin(elapsed * (7 + speed01 * 6)) * (0.25 * wag);
    parts.tail.rotation.x = -0.2 - speed01 * 0.25;

    parts.head.rotation.x = carrying ? 0.22 : -0.05 + Math.sin(elapsed * 2.4) * 0.04;
    for (let i = 0; i < parts.ears.length; i++) {
        parts.ears[i].rotation.x = Math.sin(elapsed * 5 + i) * 0.12 * (0.4 + speed01);
    }
}

function createScrapHound(): CompanionInstance {
    const parts = createProceduralDog();
    return {
        root: parts.root,
        update: (elapsed, speed01, carrying) => animateDog(parts, elapsed, speed01, carrying),
        dispose: () => disposeDog(parts),
    };
}

function createShiba(): CompanionInstance {
    const parts = buildQuadruped({
        fur: 0xe0a458,
        furDark: 0xb87333,
        muzzle: 0xf6e7cd,
        accent: 0xd94f3d,
        ears: "prick",
        tail: "curl",
        rounded: false,
        bulk: 0.95,
    });
    parts.root.name = "pet-shiba";
    return {
        root: parts.root,
        update: (elapsed, speed01, carrying) => animateQuadruped(parts, elapsed, speed01, carrying),
        dispose: () => disposeTree(parts.root),
    };
}

function createBonk(): CompanionInstance {
    const parts = buildQuadruped({
        fur: 0xf5a524,
        furDark: 0xc47c12,
        muzzle: 0xfdf0d5,
        accent: 0x2f2620,
        ears: "flop",
        tail: "straight",
        rounded: false,
        bulk: 1,
    });
    parts.root.name = "pet-bonk";

    const batPivot = new THREE.Group();
    batPivot.position.set(0.2, 0.16, 0.16);
    parts.body.add(batPivot);

    const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.46, 8), standard(0xa9744f, 0.7));
    bat.position.set(0, 0.18, 0);
    bat.castShadow = true;
    batPivot.add(bat);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8), standard(0x2f2620, 0.9));
    grip.position.set(0, -0.02, 0);
    batPivot.add(grip);

    return {
        root: parts.root,
        update: (elapsed, speed01, carrying) => {
            animateQuadruped(parts, elapsed, speed01, carrying);
            const swing = Math.sin(elapsed * (3 + speed01 * 4));
            batPivot.rotation.z = -0.35 + swing * 0.4;
            batPivot.rotation.x = swing * 0.2;
        },
        dispose: () => disposeTree(parts.root),
    };
}

function createChad(): CompanionInstance {
    const parts = buildQuadruped({
        fur: 0xd8dee9,
        furDark: 0x9aa5b1,
        muzzle: 0xf0d0c8,
        accent: 0x7dd3fc,
        ears: "horn",
        tail: "tuft",
        rounded: true,
        bulk: 1.25,
        emissive: 0x1d6fa5,
    });
    parts.root.name = "pet-chad";

    const ringMat = glowing(0xffd166, 0x8a5a12, 1.1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 16), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, -0.13, 0.3);
    parts.head.add(ring);

    const hump = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), standard(0xb8c2cc, 0.6, 0.25));
    hump.scale.set(1.1, 0.7, 1.3);
    hump.position.set(0, 0.19, 0.16);
    hump.castShadow = true;
    parts.body.add(hump);

    return {
        root: parts.root,
        update: (elapsed, speed01, carrying) => {
            animateQuadruped(parts, elapsed, speed01, carrying);
            ringMat.emissiveIntensity = 0.9 + Math.sin(elapsed * 3) * 0.3;
        },
        dispose: () => disposeTree(parts.root),
    };
}

function createPepe(): CompanionInstance {
    const root = new THREE.Group();
    root.name = "pet-pepe";

    const skinMat = standard(0x5ba83a, 0.7);
    const bellyMat = standard(0x8fd45a, 0.75);
    const shirtMat = standard(0x2a3d5c, 0.8);

    const body = new THREE.Group();
    body.position.y = 0.3;
    root.add(body);

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 14), skinMat);
    torso.scale.set(1, 0.85, 0.9);
    torso.castShadow = true;
    body.add(torso);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), bellyMat);
    belly.scale.set(1, 0.8, 0.6);
    belly.position.set(0, -0.05, 0.16);
    body.add(belly);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.12, 14), shirtMat);
    collar.position.set(0, -0.16, 0);
    body.add(collar);

    const head = new THREE.Group();
    head.position.set(0, 0.2, 0.06);
    body.add(head);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), skinMat);
    skull.scale.set(1.05, 0.85, 1);
    skull.castShadow = true;
    head.add(skull);

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.02), standard(0x2c4a1e, 0.9));
    mouth.position.set(0, -0.1, 0.22);
    head.add(mouth);

    const scleraMat = standard(0xf4f4f4, 0.3);
    const pupilMat = standard(0x141018, 0.2);
    const eyes: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
        const eyeGroup = new THREE.Group();
        eyeGroup.position.set(side * 0.13, 0.16, 0.06);
        head.add(eyeGroup);

        const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 12), scleraMat);
        eyeGroup.add(sclera);

        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), pupilMat);
        pupil.position.set(side * 0.02, 0.01, 0.08);
        eyeGroup.add(pupil);

        eyes.push(eyeGroup);
    }

    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.17, -0.16, -0.02);
        body.add(pivot);

        const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.12, 3, 8), skinMat);
        thigh.position.y = -0.08;
        thigh.castShadow = true;
        pivot.add(thigh);

        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.2), skinMat);
        foot.position.set(0, -0.18, 0.05);
        pivot.add(foot);

        legs.push(pivot);
    }

    const arms: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.16, 3, 8), skinMat);
        arm.position.set(side * 0.28, -0.02, 0.02);
        arm.rotation.z = side * 0.35;
        arm.castShadow = true;
        body.add(arm);
        arms.push(arm);
    }

    return {
        root,
        update: (elapsed, speed01) => {
            const hopRate = 5 + speed01 * 5;
            const hop = Math.max(0, Math.sin(elapsed * hopRate));
            body.position.y = 0.3 + hop * (0.05 + speed01 * 0.28);
            body.rotation.x = -hop * 0.18 * (0.3 + speed01);
            for (let i = 0; i < legs.length; i++) {
                legs[i].rotation.x = -hop * (0.4 + speed01 * 0.6);
            }
            for (let i = 0; i < arms.length; i++) {
                arms[i].rotation.x = hop * 0.5 * (0.3 + speed01);
            }
            const blink = Math.sin(elapsed * 1.7) > 0.985 ? 0.15 : 1;
            for (const eye of eyes) eye.scale.y = blink;
        },
        dispose: () => disposeTree(root),
    };
}

function createRocket(): CompanionInstance {
    const root = new THREE.Group();
    root.name = "pet-rocket";

    const hover = new THREE.Group();
    hover.position.y = 1.05;
    root.add(hover);

    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.52, 16), standard(0xf1f3f5, 0.35, 0.55));
    hull.rotation.x = Math.PI / 2;
    hull.castShadow = true;
    hover.add(hull);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 16), standard(0xf87171, 0.4, 0.3));
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 0.4;
    nose.castShadow = true;
    hover.add(nose);

    const porthole = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), glowing(0x9be8ff, 0x2f8fbf, 1.2));
    porthole.position.set(0, 0.05, 0.14);
    hover.add(porthole);

    const finMat = standard(0xd94f3d, 0.45, 0.3);
    for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.22), finMat);
        const angle = (i / 3) * Math.PI * 2;
        fin.position.set(Math.sin(angle) * 0.15, Math.cos(angle) * 0.15, -0.2);
        fin.rotation.z = -angle;
        fin.castShadow = true;
        hover.add(fin);
    }

    const flameMat = new THREE.MeshBasicMaterial({
        color: 0xffb454,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 12, 1, true), flameMat);
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = -0.44;
    hover.add(flame);

    const exhaustCount = 24;
    const exhaustPositions = new Float32Array(exhaustCount * 3);
    const exhaustSeeds = new Float32Array(exhaustCount);
    for (let i = 0; i < exhaustCount; i++) exhaustSeeds[i] = Math.random();

    const exhaustGeo = new THREE.BufferGeometry();
    exhaustGeo.setAttribute("position", new THREE.BufferAttribute(exhaustPositions, 3));
    const exhaustMat = new THREE.PointsMaterial({
        color: 0xffcf7a,
        size: 0.09,
        map: sparkTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
    });
    const exhaust = new THREE.Points(exhaustGeo, exhaustMat);
    exhaust.frustumCulled = false;
    hover.add(exhaust);

    return {
        root,
        update: (elapsed, speed01) => {
            hover.position.y = 1.05 + Math.sin(elapsed * 1.9) * 0.09;
            hover.rotation.z = Math.sin(elapsed * 1.3) * 0.12;
            hover.rotation.x = -0.12 - speed01 * 0.25;

            flame.scale.set(0.8 + speed01 * 0.5, 0.55 + speed01 * 0.75, 0.8 + speed01 * 0.5);
            flameMat.opacity = 0.5 + Math.abs(Math.sin(elapsed * 22)) * 0.35;

            for (let i = 0; i < exhaustCount; i++) {
                const life = (exhaustSeeds[i] + elapsed * (0.9 + speed01 * 1.4)) % 1;
                const spread = life * 0.16;
                exhaustPositions[i * 3] = Math.sin(exhaustSeeds[i] * 40 + elapsed) * spread;
                exhaustPositions[i * 3 + 1] = Math.cos(exhaustSeeds[i] * 33 + elapsed) * spread;
                exhaustPositions[i * 3 + 2] = -0.42 - life * (0.5 + speed01 * 0.6);
            }
            exhaustGeo.attributes.position.needsUpdate = true;
            exhaustMat.opacity = 0.35 + speed01 * 0.5;
        },
        dispose: () => disposeTree(root),
    };
}

function createDiamondHands(): CompanionInstance {
    const root = new THREE.Group();
    root.name = "pet-diamond";

    const hover = new THREE.Group();
    hover.position.y = 0.95;
    root.add(hover);

    const crystalMat = new THREE.MeshStandardMaterial({
        color: 0xd8b4fe,
        emissive: 0x6d28d9,
        emissiveIntensity: 1.1,
        roughness: 0.12,
        metalness: 0.65,
        transparent: true,
        opacity: 0.92,
        flatShading: true,
    });

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), crystalMat);
    core.castShadow = true;
    hover.add(core);

    const band = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.018, 8, 32), glowing(0xc084fc, 0x7c3aed, 1.6));
    band.rotation.x = Math.PI / 2.2;
    hover.add(band);

    const gloveMat = standard(0x2b2f45, 0.6, 0.35);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.22), gloveMat);
    palm.position.y = -0.26;
    palm.castShadow = true;
    hover.add(palm);

    for (let i = 0; i < 4; i++) {
        const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.1, 3, 6), gloveMat);
        finger.position.set(-0.09 + i * 0.06, -0.18, 0.08);
        finger.rotation.x = -0.5;
        hover.add(finger);
    }

    const shardMat = new THREE.MeshStandardMaterial({
        color: 0xe9d5ff,
        emissive: 0x8b5cf6,
        emissiveIntensity: 1.5,
        roughness: 0.1,
        metalness: 0.5,
        flatShading: true,
    });
    const shards: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), shardMat);
        hover.add(shard);
        shards.push(shard);
    }

    const light = new THREE.PointLight(0xa855f7, 1.5, 4.5, 2);
    hover.add(light);

    return {
        root,
        update: (elapsed, speed01) => {
            hover.position.y = 0.95 + Math.sin(elapsed * 1.6) * 0.08;
            core.rotation.y = elapsed * 0.9;
            core.rotation.x = Math.sin(elapsed * 0.7) * 0.35;
            band.rotation.z = elapsed * 0.6;

            for (let i = 0; i < shards.length; i++) {
                const angle = elapsed * (1.1 + i * 0.25) + (i / shards.length) * Math.PI * 2;
                shards[i].position.set(Math.cos(angle) * 0.42, Math.sin(elapsed * 1.4 + i) * 0.14, Math.sin(angle) * 0.42);
                shards[i].rotation.set(elapsed * 1.6, elapsed * 1.2, 0);
            }

            crystalMat.emissiveIntensity = 0.9 + Math.sin(elapsed * 2.6) * 0.35 + speed01 * 0.3;
            light.intensity = 1.2 + Math.sin(elapsed * 2.6) * 0.4;
        },
        dispose: () => disposeTree(root),
    };
}

function createKraken(): CompanionInstance {
    const root = new THREE.Group();
    root.name = "pet-kraken";

    const hover = new THREE.Group();
    hover.position.y = 1.15;
    root.add(hover);

    const hideMat = new THREE.MeshStandardMaterial({
        color: 0x1f2f5c,
        emissive: 0x0d2a5e,
        emissiveIntensity: 0.7,
        roughness: 0.42,
        metalness: 0.32,
    });
    const goldMat = glowing(0xffd166, 0xb47714, 1.8);

    const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 20), hideMat);
    mantle.scale.set(1, 1.22, 1);
    mantle.castShadow = true;
    hover.add(mantle);

    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.026, 10, 24), goldMat);
    crown.rotation.x = Math.PI / 2;
    crown.position.y = 0.3;
    hover.add(crown);

    for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.13, 8), goldMat);
        const angle = (i / 6) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.19, 0.37, Math.sin(angle) * 0.19);
        hover.add(spike);
    }

    const eyeMat = glowing(0xfff3c4, 0xffb703, 2.2);
    const pupilMat = standard(0x120c1c, 0.2);
    const eyes: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), eyeMat);
        eye.position.set(side * 0.16, 0.06, 0.27);
        hover.add(eye);
        eyes.push(eye);

        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), pupilMat);
        pupil.position.set(side * 0.17, 0.05, 0.33);
        hover.add(pupil);
    }

    const tentacleMat = new THREE.MeshStandardMaterial({
        color: 0x2a4272,
        emissive: 0x123a7a,
        emissiveIntensity: 0.55,
        roughness: 0.5,
        metalness: 0.2,
    });
    const tentacles: THREE.Object3D[][] = [];
    const tentacleCount = 6;
    for (let t = 0; t < tentacleCount; t++) {
        const angle = (t / tentacleCount) * Math.PI * 2;
        const base = new THREE.Group();
        base.position.set(Math.cos(angle) * 0.2, -0.28, Math.sin(angle) * 0.2);
        base.rotation.y = -angle;
        hover.add(base);

        const chain: THREE.Object3D[] = [];
        let parent: THREE.Object3D = base;
        for (let s = 0; s < 5; s++) {
            const joint = new THREE.Group();
            joint.position.y = s === 0 ? 0 : -0.14;
            parent.add(joint);

            const radius = 0.06 - s * 0.009;
            const segment = new THREE.Mesh(new THREE.CapsuleGeometry(radius, 0.1, 3, 8), tentacleMat);
            segment.position.y = -0.07;
            segment.castShadow = true;
            joint.add(segment);

            if (s === 4) {
                const tip = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.9, 8, 8), goldMat);
                tip.position.y = -0.14;
                joint.add(tip);
            }

            chain.push(joint);
            parent = joint;
        }
        tentacles.push(chain);
    }

    const auraMat = new THREE.MeshBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const aura = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.72, 40), auraMat);
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = -0.95;
    hover.add(aura);

    const sparkCount = 48;
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkSeeds = new Float32Array(sparkCount);
    const sparkRadii = new Float32Array(sparkCount);
    for (let i = 0; i < sparkCount; i++) {
        sparkSeeds[i] = Math.random();
        sparkRadii[i] = 0.45 + Math.random() * 0.4;
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMat = new THREE.PointsMaterial({
        color: 0xffe08a,
        size: 0.11,
        map: sparkTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
    });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.frustumCulled = false;
    hover.add(sparks);

    const light = new THREE.PointLight(0xffc857, 2.2, 6.5, 2);
    light.position.y = 0.1;
    hover.add(light);

    return {
        root,
        update: (elapsed, speed01, carrying) => {
            hover.position.y = 1.15 + Math.sin(elapsed * 1.35) * 0.12;
            hover.rotation.y = Math.sin(elapsed * 0.5) * 0.12;
            mantle.scale.y = 1.22 + Math.sin(elapsed * 2.1) * 0.05;

            for (let t = 0; t < tentacles.length; t++) {
                const chain = tentacles[t];
                for (let s = 0; s < chain.length; s++) {
                    const wave = Math.sin(elapsed * (2.4 + speed01 * 2.2) - s * 0.7 + t * 1.1);
                    chain[s].rotation.x = wave * (0.18 + s * 0.05) + (carrying ? 0.12 : 0);
                    chain[s].rotation.z = Math.cos(elapsed * 1.7 - s * 0.5 + t) * 0.09;
                }
            }

            for (let i = 0; i < sparkCount; i++) {
                const angle = elapsed * (0.5 + sparkSeeds[i]) + sparkSeeds[i] * Math.PI * 2;
                const radius = sparkRadii[i];
                sparkPositions[i * 3] = Math.cos(angle) * radius;
                sparkPositions[i * 3 + 1] = Math.sin(elapsed * 1.3 + sparkSeeds[i] * 6) * 0.5 - 0.2;
                sparkPositions[i * 3 + 2] = Math.sin(angle) * radius;
            }
            sparkGeo.attributes.position.needsUpdate = true;

            const pulse = 0.6 + Math.abs(Math.sin(elapsed * 1.8)) * 0.5;
            auraMat.opacity = 0.18 + pulse * 0.22;
            aura.scale.setScalar(0.95 + pulse * 0.12);
            light.intensity = 1.6 + pulse * 0.9;
            goldMat.emissiveIntensity = 1.4 + pulse * 0.8;

            const blink = Math.sin(elapsed * 1.1) > 0.97 ? 0.12 : 1;
            for (const eye of eyes) eye.scale.y = blink;
        },
        dispose: () => disposeTree(root),
    };
}

const BUILDERS: Record<CompanionId, () => CompanionInstance> = {
    "pet-dog": createScrapHound,
    "pet-shiba": createShiba,
    "pet-pepe": createPepe,
    "pet-bonk": createBonk,
    "pet-chad": createChad,
    "pet-rocket": createRocket,
    "pet-diamond": createDiamondHands,
    "pet-kraken": createKraken,
    "pet-slime": createWardenSlime,
};

export function createCompanion(id: CompanionId): CompanionInstance {
    return (BUILDERS[id] ?? createScrapHound)();
}
