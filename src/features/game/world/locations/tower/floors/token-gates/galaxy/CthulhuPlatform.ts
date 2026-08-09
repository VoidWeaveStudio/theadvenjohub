// src/features/game/world/locations/tower/floors/token-gates/galaxy/CthulhuPlatform.ts
import * as THREE from "three";
import { GALAXY } from "./GalaxyLayout";

export const PLATFORM_CENTER = new THREE.Vector3(GALAXY.hubPosition.x, GALAXY.hubPosition.y, GALAXY.hubPosition.z);
export const PLATFORM_RADIUS = GALAXY.platformRadius;
export const PLATFORM_SURFACE_Y = PLATFORM_CENTER.y;

const HEAD_RADIUS = 17;
const HEAD_Z = -PLATFORM_RADIUS - 8;
const HEAD_Y = 12;
const ARM_SPREAD = PLATFORM_RADIUS * 0.92;
const FACE_TENTACLES = 11;

interface FaceTentacle {
    segments: THREE.Group[];
    phase: number;
}

export class CthulhuPlatform {
    public group!: THREE.Group;
    public interactionTarget!: THREE.Object3D;

    private faceTentacles: FaceTentacle[] = [];
    private fingers: THREE.Group[] = [];
    private wings: THREE.Mesh[] = [];
    private eyes: THREE.Mesh[] = [];
    private head!: THREE.Group;
    private time = 0;

    private skin!: THREE.MeshStandardMaterial;
    private skinDark!: THREE.MeshStandardMaterial;
    private membrane!: THREE.MeshStandardMaterial;

    constructor(private scene: THREE.Scene) { }

    create() {
        this.group = new THREE.Group();
        this.group.position.copy(PLATFORM_CENTER);

        this.skin = new THREE.MeshStandardMaterial({
            color: 0x3d5a4e,
            roughness: 0.82,
            metalness: 0.08,
            emissive: 0x0a1614,
            emissiveIntensity: 0.4,
        });
        this.skinDark = new THREE.MeshStandardMaterial({
            color: 0x24382f,
            roughness: 0.88,
            metalness: 0.05,
        });
        this.membrane = new THREE.MeshStandardMaterial({
            color: 0x2a3a34,
            roughness: 0.9,
            metalness: 0.02,
            side: THREE.DoubleSide,
        });

        this.buildTorso();
        this.buildHead();
        this.buildWings();
        this.buildArms();
        this.buildDeck();

        this.scene.add(this.group);
    }

    private buildTorso() {
        const torso = new THREE.Mesh(new THREE.CapsuleGeometry(19, 46, 6, 20), this.skin);
        torso.position.set(0, -52, HEAD_Z + 4);
        this.group.add(torso);

        const shoulders = new THREE.Mesh(new THREE.SphereGeometry(23, 24, 18), this.skin);
        shoulders.scale.set(1.5, 0.72, 1);
        shoulders.position.set(0, -22, HEAD_Z + 3);
        this.group.add(shoulders);

        const hips = new THREE.Mesh(new THREE.SphereGeometry(21, 20, 16), this.skinDark);
        hips.scale.set(1.2, 0.9, 1);
        hips.position.set(0, -86, HEAD_Z + 4);
        this.group.add(hips);

        for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CapsuleGeometry(11, 60, 5, 14), this.skinDark);
            leg.position.set(side * 13, -124, HEAD_Z + 4);
            this.group.add(leg);
        }
    }

    private buildHead() {
        this.head = new THREE.Group();
        this.head.position.set(0, HEAD_Y, HEAD_Z);

        const skull = new THREE.Mesh(new THREE.SphereGeometry(HEAD_RADIUS, 32, 24), this.skin);
        skull.scale.set(0.92, 1.18, 1);
        this.head.add(skull);

        const crest = new THREE.Mesh(new THREE.ConeGeometry(HEAD_RADIUS * 0.5, HEAD_RADIUS * 0.85, 8), this.skinDark);
        crest.position.y = HEAD_RADIUS * 1.05;
        this.head.add(crest);

        const brow = new THREE.Mesh(new THREE.TorusGeometry(HEAD_RADIUS * 0.72, 1.5, 8, 24, Math.PI), this.skinDark);
        brow.rotation.z = Math.PI;
        brow.position.set(0, HEAD_RADIUS * 0.15, HEAD_RADIUS * 0.66);
        this.head.add(brow);

        const eyeGeometry = new THREE.SphereGeometry(2.5, 16, 12);
        const eyeMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd98a,
            emissive: 0xffae3a,
            emissiveIntensity: 3.2,
            roughness: 0.25,
        });

        for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
            eye.position.set(side * HEAD_RADIUS * 0.38, HEAD_RADIUS * 0.02, HEAD_RADIUS * 0.82);
            eye.scale.set(1.35, 0.85, 1);
            this.head.add(eye);
            this.eyes.push(eye);
        }

        this.buildFaceTentacles();

        const facePod = new THREE.Group();
        facePod.position.set(0, HEAD_Y - 6, HEAD_Z + HEAD_RADIUS + 6);
        facePod.userData.interactionId = "gate-steward";
        facePod.userData.interactionRadius = 16;
        this.group.add(facePod);
        this.interactionTarget = facePod;

        this.group.add(this.head);
    }

    private buildFaceTentacles() {
        for (let i = 0; i < FACE_TENTACLES; i++) {
            const column = Math.floor(i / 4);
            const inColumn = i % 4;
            const x = ((inColumn - 1.5) / 1.5) * HEAD_RADIUS * 0.46;
            const z = HEAD_RADIUS * (0.72 - column * 0.16);

            const root = new THREE.Group();
            root.position.set(x, -HEAD_RADIUS * 0.55 + column * 1.6, z);
            this.head.add(root);

            const segments: THREE.Group[] = [];
            let parent: THREE.Group = root;
            let thickness = 2.1 - column * 0.25;
            let length = 5.2;

            for (let s = 0; s < 6; s++) {
                const pivot = new THREE.Group();
                pivot.position.y = s === 0 ? 0 : -length;

                const limb = new THREE.Mesh(new THREE.CapsuleGeometry(thickness, length, 4, 8), this.skin);
                limb.position.y = -length * 0.5;
                pivot.add(limb);

                pivot.rotation.x = 0.12;
                parent.add(pivot);
                parent = pivot;
                segments.push(pivot);

                thickness *= 0.87;
                length *= 0.96;
            }

            this.faceTentacles.push({ segments, phase: i * 0.7 });
        }
    }

    private buildWings() {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(26, 22, 62, 30);
        shape.quadraticCurveTo(52, 6, 58, -18);
        shape.quadraticCurveTo(40, -6, 30, -22);
        shape.quadraticCurveTo(24, -8, 14, -20);
        shape.quadraticCurveTo(10, -6, 0, 0);

        const geometry = new THREE.ShapeGeometry(shape, 24);

        for (const side of [-1, 1]) {
            const wing = new THREE.Mesh(geometry, this.membrane);
            wing.position.set(side * 18, HEAD_Y + 6, HEAD_Z - 10);
            wing.rotation.y = side * -0.55;
            wing.rotation.z = side * 0.18;
            wing.scale.x = side;
            this.group.add(wing);
            this.wings.push(wing);

            const spar = new THREE.Mesh(new THREE.CapsuleGeometry(1.6, 56, 4, 8), this.skinDark);
            spar.position.set(side * 44, HEAD_Y + 20, HEAD_Z - 11);
            spar.rotation.z = side * 1.15;
            this.group.add(spar);
        }
    }

    private buildArms() {
        for (const side of [-1, 1]) {
            const upper = new THREE.Mesh(new THREE.CapsuleGeometry(8.5, 40, 5, 14), this.skin);
            upper.position.set(side * 30, -32, HEAD_Z + 12);
            upper.rotation.z = side * -0.32;
            this.group.add(upper);

            const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(7, 38, 5, 14), this.skin);
            forearm.position.set(side * ARM_SPREAD, -8, PLATFORM_RADIUS * 0.1);
            forearm.rotation.z = side * -0.1;
            forearm.rotation.x = -0.45;
            this.group.add(forearm);

            const palm = new THREE.Mesh(new THREE.SphereGeometry(8.5, 20, 14), this.skin);
            palm.scale.set(1, 0.62, 1.25);
            palm.position.set(side * ARM_SPREAD, -3.5, PLATFORM_RADIUS * 0.22);
            this.group.add(palm);

            for (let f = 0; f < 4; f++) {
                const finger = new THREE.Group();
                const spread = (f - 1.5) * 4.6;
                finger.position.set(side * ARM_SPREAD - side * 1.5, -2.2, PLATFORM_RADIUS * 0.22 + spread);

                let parent: THREE.Group = finger;
                let thickness = 2.1;
                let length = 5.4;

                for (let s = 0; s < 3; s++) {
                    const joint = new THREE.Group();
                    joint.position.y = s === 0 ? 0 : length;
                    joint.rotation.x = 0;
                    joint.rotation.z = side * (s === 0 ? -0.15 : -0.55);

                    const bone = new THREE.Mesh(new THREE.CapsuleGeometry(thickness, length, 4, 8), this.skin);
                    bone.position.y = length * 0.5;
                    joint.add(bone);

                    parent.add(joint);
                    parent = joint;
                    thickness *= 0.85;
                    length *= 0.9;
                }

                const nail = new THREE.Mesh(new THREE.ConeGeometry(thickness * 1.1, 3.4, 8), this.skinDark);
                nail.position.y = length;
                parent.add(nail);

                this.group.add(finger);
                this.fingers.push(finger);
            }
        }
    }

    private buildDeck() {
        const deck = new THREE.Mesh(
            new THREE.CylinderGeometry(PLATFORM_RADIUS, PLATFORM_RADIUS - 2, 2.6, 56),
            new THREE.MeshStandardMaterial({
                color: 0x39443f,
                roughness: 0.78,
                metalness: 0.25,
            })
        );
        deck.position.y = -1.3;
        deck.receiveShadow = true;
        this.group.add(deck);

        const rim = new THREE.Mesh(
            new THREE.TorusGeometry(PLATFORM_RADIUS, 0.7, 10, 72),
            new THREE.MeshStandardMaterial({
                color: 0x5d6b62,
                roughness: 0.7,
                metalness: 0.35,
            })
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.1;
        this.group.add(rim);

        const glyphs = new THREE.Mesh(
            new THREE.RingGeometry(PLATFORM_RADIUS * 0.28, PLATFORM_RADIUS * 0.88, 72),
            new THREE.MeshBasicMaterial({
                color: 0x7fe6cf,
                transparent: true,
                opacity: 0.09,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
                fog: false,
            })
        );
        glyphs.rotation.x = -Math.PI / 2;
        glyphs.position.y = 0.16;
        this.group.add(glyphs);

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const pillar = new THREE.Mesh(
                new THREE.BoxGeometry(1.4, 5 + (i % 3) * 2.5, 1.4),
                this.skinDark
            );
            pillar.position.set(
                Math.cos(angle) * (PLATFORM_RADIUS - 3),
                2.5 + (i % 3) * 1.25,
                Math.sin(angle) * (PLATFORM_RADIUS - 3)
            );
            this.group.add(pillar);
        }
    }

    public containsPoint(point: THREE.Vector3): boolean {
        return Math.hypot(point.x - PLATFORM_CENTER.x, point.z - PLATFORM_CENTER.z) <= PLATFORM_RADIUS;
    }

    public getHeightAt(x: number, z: number): number {
        return Math.hypot(x - PLATFORM_CENTER.x, z - PLATFORM_CENTER.z) <= PLATFORM_RADIUS
            ? PLATFORM_SURFACE_Y
            : -100000;
    }

    update(delta: number) {
        this.time += delta;

        for (const tentacle of this.faceTentacles) {
            tentacle.segments.forEach((pivot, i) => {
                const wave = Math.sin(this.time * 0.9 + tentacle.phase + i * 0.6);
                const sway = Math.cos(this.time * 0.6 + tentacle.phase + i * 0.4);
                pivot.rotation.x = 0.12 + wave * 0.07;
                pivot.rotation.z = sway * 0.05;
            });
        }

        const breathe = Math.sin(this.time * 0.4) * 0.6;
        this.head.position.y = HEAD_Y + breathe;

        this.wings.forEach((wing, i) => {
            wing.rotation.z = (i === 0 ? 1 : -1) * (0.18 + Math.sin(this.time * 0.35) * 0.05);
        });

        const blink = 2.6 + Math.sin(this.time * 1.1) * 1.1;
        this.eyes.forEach((eye) => {
            (eye.material as THREE.MeshStandardMaterial).emissiveIntensity = blink;
        });
    }

    dispose() {
        if (!this.group) return;
        this.group.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh) {
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m) => m.dispose());
                } else if (mesh.material) {
                    (mesh.material as THREE.Material).dispose();
                }
            }
        });
        this.scene.remove(this.group);
        this.faceTentacles = [];
        this.fingers = [];
        this.wings = [];
        this.eyes = [];
    }
}
