// src/features/game/entities/proceduralDog.ts
import * as THREE from "three";

const FUR = 0x8a6b4f;
const FUR_DARK = 0x5d4632;
const MUZZLE = 0x2f2620;
const EYE = 0x141018;
const SCRAP = 0xb8863b;

export interface DogParts {
    root: THREE.Group;
    body: THREE.Group;
    head: THREE.Group;
    tail: THREE.Object3D;
    legs: THREE.Object3D[];
    ears: THREE.Object3D[];
}

function mat(color: number, rough = 0.85): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });
}

export function createProceduralDog(): DogParts {
    const root = new THREE.Group();
    root.name = "pet-dog";

    const furMat = mat(FUR);
    const furDarkMat = mat(FUR_DARK);
    const muzzleMat = mat(MUZZLE, 0.7);
    const eyeMat = new THREE.MeshStandardMaterial({ color: EYE, roughness: 0.25, metalness: 0.1 });
    const scrapMat = new THREE.MeshStandardMaterial({ color: SCRAP, roughness: 0.4, metalness: 0.6 });

    const body = new THREE.Group();
    body.position.y = 0.42;
    root.add(body);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.66), furMat);
    torso.castShadow = true;
    body.add(torso);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.26), furMat);
    chest.position.set(0, 0.01, 0.24);
    chest.castShadow = true;
    body.add(chest);

    const haunch = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.24), furDarkMat);
    haunch.position.set(0, 0.01, -0.24);
    haunch.castShadow = true;
    body.add(haunch);

    const head = new THREE.Group();
    head.position.set(0, 0.16, 0.42);
    body.add(head);

    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.28), furMat);
    skull.castShadow = true;
    head.add(skull);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.2), furDarkMat);
    snout.position.set(0, -0.05, 0.2);
    snout.castShadow = true;
    head.add(snout);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.05), muzzleMat);
    nose.position.set(0, -0.03, 0.31);
    head.add(nose);

    const ears: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.05), furDarkMat);
        ear.position.set(side * 0.1, 0.19, -0.02);
        ear.castShadow = true;
        head.add(ear);
        ears.push(ear);
    }

    for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.03), eyeMat);
        eye.position.set(side * 0.08, 0.03, 0.15);
        head.add(eye);
    }

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.028, 6, 12), scrapMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, -0.04, 0.34);
    body.add(collar);

    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.02), scrapMat);
    tag.position.set(0, -0.14, 0.36);
    body.add(tag);

    const legs: THREE.Object3D[] = [];
    const legGeo = new THREE.BoxGeometry(0.09, 0.34, 0.09);
    const legOffsets: [number, number][] = [
        [-0.12, 0.22],
        [0.12, 0.22],
        [-0.12, -0.22],
        [0.12, -0.22],
    ];
    for (const [x, z] of legOffsets) {
        const pivot = new THREE.Group();
        pivot.position.set(x, -0.13, z);
        body.add(pivot);

        const leg = new THREE.Mesh(legGeo, furDarkMat);
        leg.position.y = -0.17;
        leg.castShadow = true;
        pivot.add(leg);

        const paw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.12), muzzleMat);
        paw.position.set(0, -0.34, 0.01);
        pivot.add(paw);

        legs.push(pivot);
    }

    const tail = new THREE.Group();
    tail.position.set(0, 0.12, -0.34);
    body.add(tail);

    const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.28), furMat);
    tailMesh.position.z = -0.14;
    tailMesh.castShadow = true;
    tail.add(tailMesh);

    const tailTip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.09), furDarkMat);
    tailTip.position.z = -0.3;
    tail.add(tailTip);

    return { root, body, head, tail, legs, ears };
}

export function animateDog(parts: DogParts, elapsed: number, speed01: number, carrying: boolean): void {
    const gait = elapsed * (6 + speed01 * 10);
    const swing = 0.15 + speed01 * 0.75;

    for (let i = 0; i < parts.legs.length; i++) {
        const phase = i === 0 || i === 3 ? 0 : Math.PI;
        parts.legs[i].rotation.x = Math.sin(gait + phase) * swing;
    }

    const bob = Math.abs(Math.sin(gait)) * (0.012 + speed01 * 0.03);
    parts.body.position.y = 0.42 + bob;
    parts.body.rotation.z = Math.sin(gait * 0.5) * 0.03 * speed01;

    const wag = carrying ? 3.2 : 1.4 + speed01 * 1.6;
    parts.tail.rotation.y = Math.sin(elapsed * (7 + speed01 * 6)) * (0.25 * wag);
    parts.tail.rotation.x = -0.25 - speed01 * 0.3;

    parts.head.rotation.x = carrying ? 0.22 : -0.05 + Math.sin(elapsed * 2.4) * 0.04;
    for (let i = 0; i < parts.ears.length; i++) {
        parts.ears[i].rotation.x = Math.sin(elapsed * 5 + i) * 0.12 * (0.4 + speed01);
    }
}

export function disposeDog(parts: DogParts): void {
    parts.root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
    });
    parts.root.removeFromParent();
}
