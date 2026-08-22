// src/features/game/entities/viewHands.ts
import * as THREE from "three";

// Built to real hand measurements rather than eyeballed blocks, because at
// forty centimetres from the camera wrong proportions read as a lump rather
// than a hand: palm 85 mm across the knuckles and 28 mm thick, fingers in three
// tapering segments, thumb set low on the side and crossing under.
//
// Two independent axes: the grip rod runs along local X and the fingers close
// around it, while the wrist and forearm leave the back of the palm along -Z.
// Seating a hand on a weapon is then one rotation per axis.

const PALM_WIDTH = 0.085;
const PALM_THICK = 0.028;
const PALM_DEPTH = 0.052;

const FINGER_SEGMENTS = [
    { length: 0.032, radius: 0.0092, bend: 1.0 },
    { length: 0.024, radius: 0.0082, bend: 1.05 },
    { length: 0.018, radius: 0.0072, bend: 0.85 },
];

const FINGER_SPREAD = [-0.031, -0.0105, 0.0105, 0.029];
const FINGER_LIFT = [0.002, 0.004, 0.002, -0.003];

function buildFinger(material: THREE.Material, offsetX: number, lift: number, scale: number): THREE.Group {
    const root = new THREE.Group();
    root.position.set(offsetX, lift, -PALM_DEPTH / 2);

    let parent: THREE.Object3D = root;
    for (const segment of FINGER_SEGMENTS) {
        const joint = new THREE.Group();
        joint.rotation.x = -segment.bend;
        parent.add(joint);

        const length = segment.length * scale;
        const bone = new THREE.Mesh(
            new THREE.CapsuleGeometry(segment.radius * scale, length * 0.72, 4, 8),
            material
        );
        bone.position.z = -length / 2;
        bone.rotation.x = Math.PI / 2;
        joint.add(bone);

        const next = new THREE.Group();
        next.position.z = -length;
        joint.add(next);
        parent = next;
    }

    return root;
}

export function buildViewHand(glove: THREE.Material, skin: THREE.Material, mirror: number): THREE.Group {
    const hand = new THREE.Group();

    const palm = new THREE.Mesh(new THREE.BoxGeometry(PALM_WIDTH, PALM_THICK, PALM_DEPTH), glove);
    hand.add(palm);

    const heel = new THREE.Mesh(new THREE.SphereGeometry(PALM_THICK * 0.9, 12, 8), glove);
    heel.scale.set(1.55, 1, 0.95);
    heel.position.z = PALM_DEPTH * 0.42;
    hand.add(heel);

    const knuckleRow = new THREE.Mesh(new THREE.CylinderGeometry(PALM_THICK * 0.52, PALM_THICK * 0.52, PALM_WIDTH * 0.94, 10), glove);
    knuckleRow.rotation.z = Math.PI / 2;
    knuckleRow.position.set(0, -0.002, -PALM_DEPTH / 2);
    hand.add(knuckleRow);

    for (let i = 0; i < 4; i++) {
        const index = mirror > 0 ? i : 3 - i;
        hand.add(buildFinger(glove, FINGER_SPREAD[index] * mirror, FINGER_LIFT[i], 1 - i * 0.06));
    }

    const thumbRoot = new THREE.Group();
    thumbRoot.position.set(mirror * (PALM_WIDTH / 2 - 0.006), 0.004, PALM_DEPTH * 0.12);
    thumbRoot.rotation.set(-0.55, mirror * -0.6, mirror * -0.5);
    hand.add(thumbRoot);

    const thumbBase = new THREE.Mesh(new THREE.CapsuleGeometry(0.0115, 0.026, 4, 8), glove);
    thumbBase.position.z = -0.02;
    thumbBase.rotation.x = Math.PI / 2;
    thumbRoot.add(thumbBase);

    const thumbTip = new THREE.Group();
    thumbTip.position.z = -0.04;
    thumbTip.rotation.x = -0.75;
    thumbRoot.add(thumbTip);

    const thumbEnd = new THREE.Mesh(new THREE.CapsuleGeometry(0.0102, 0.02, 4, 8), glove);
    thumbEnd.position.z = -0.016;
    thumbEnd.rotation.x = Math.PI / 2;
    thumbTip.add(thumbEnd);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.032, 0.042, 12), glove);
    cuff.position.set(0, 0.004, PALM_DEPTH / 2 + 0.022);
    cuff.rotation.x = Math.PI / 2;
    hand.add(cuff);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.05, 0.21, 12), skin);
    forearm.position.set(0, 0.006, PALM_DEPTH / 2 + 0.15);
    forearm.rotation.x = Math.PI / 2;
    hand.add(forearm);

    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), skin);
    elbow.position.set(0, 0.008, PALM_DEPTH / 2 + 0.255);
    hand.add(elbow);

    return hand;
}
