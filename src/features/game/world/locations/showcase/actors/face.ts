// src/features/game/world/locations/showcase/actors/face.ts
import * as THREE from "three";
import type { ActorVariant } from "./variants";
import { HEAD_CENTRE_Y, HEAD_TOP_Y } from "./variants";

const FALLBACK_TOP_Y = HEAD_TOP_Y;
const FALLBACK_HALF_WIDTH = 0.85;
const FALLBACK_FRONT_Z = 0.78;
const FALLBACK_VERTICAL_SPAN = (HEAD_TOP_Y - HEAD_CENTRE_Y) * 2.4;

const BLINK_RATE = 1.7;
const BLINK_THRESHOLD = 0.985;
const BLINK_SQUASH = 0.08;
const BLINK_PHASE_SCALE = 3.1;

const TALK_HOLD_MIN = 0.05;
const TALK_HOLD_MAX = 0.16;
const TALK_EASE_RATE = 16;
const CLOSE_EASE_RATE = 10;

type Bin = <T extends THREE.Material>(material: T) => T;

// [scaleX, heightFactor] — scaleX is the mouth's width fraction, heightFactor is
// its opening fraction (multiplied by the actor's own open-mouth height at runtime).
// Not phonetically exact — grouped by rough mouth shape (closed lips, round/pursed,
// wide spread, jaw-drop open, teeth-together) so every letter reads as visibly distinct.
type VisemeShape = readonly [number, number];

const DEFAULT_VISEME_SHAPE: VisemeShape = [0.8, 0.45];

const LETTER_VISEME_SHAPES: Record<string, VisemeShape> = {
    a: [0.72, 0.95],
    b: [1.0, 0.06],
    c: [0.88, 0.2],
    d: [0.68, 0.42],
    e: [0.92, 0.34],
    f: [0.85, 0.15],
    g: [0.62, 0.55],
    h: [0.65, 0.5],
    i: [0.95, 0.28],
    j: [0.58, 0.5],
    k: [0.62, 0.55],
    l: [0.7, 0.4],
    m: [1.0, 0.06],
    n: [0.72, 0.38],
    o: [0.55, 0.75],
    p: [1.0, 0.06],
    q: [0.5, 0.6],
    r: [0.6, 0.5],
    s: [0.88, 0.16],
    t: [0.7, 0.35],
    u: [0.48, 0.7],
    v: [0.85, 0.18],
    w: [0.55, 0.55],
    x: [0.65, 0.45],
    y: [0.9, 0.3],
    z: [0.85, 0.18],
};

function shapeForChar(ch: string): VisemeShape {
    return LETTER_VISEME_SHAPES[ch.toLowerCase()] ?? DEFAULT_VISEME_SHAPE;
}

function buildVisemeSequence(text: string): VisemeShape[] {
    const sequence: VisemeShape[] = [];
    for (const ch of text) sequence.push(shapeForChar(ch));
    if (sequence.length === 0) sequence.push(DEFAULT_VISEME_SHAPE);
    return sequence;
}

interface FaceMetrics {
    eyeY: number;
    browY: number;
    mouthTopY: number;
    faceZ: number;
    browZ: number;
    eyeX: number;
    eyeScleraRadius: number;
    eyePupilRadius: number;
    browWidth: number;
    browHeight: number;
    browDepth: number;
    mouthRadius: number;
    mouthClosedScaleY: number;
    mouthOpenScaleY: number;
    mouthDepth: number;
}

function computeMetrics(headBounds: THREE.Box3 | null): FaceMetrics {
    let topY = FALLBACK_TOP_Y;
    let halfWidth = FALLBACK_HALF_WIDTH;
    let frontZ = FALLBACK_FRONT_Z;
    let verticalSpan = FALLBACK_VERTICAL_SPAN;

    if (headBounds && !headBounds.isEmpty()) {
        const size = new THREE.Vector3();
        headBounds.getSize(size);
        if (size.x > 0.01 && size.y > 0.01) {
            topY = headBounds.max.y;
            halfWidth = size.x / 2;
            frontZ = headBounds.max.z;
            verticalSpan = size.y;
        }
    }

    const eyeY = topY - verticalSpan * 0.3;
    const faceZ = frontZ + halfWidth * 0.05;
    const mouthWidth = halfWidth * 0.59;
    const mouthRadius = mouthWidth / 2;
    const mouthOpenHeight = halfWidth * 0.47;
    const mouthClosedHeight = halfWidth * 0.082;

    return {
        eyeY,
        browY: eyeY + verticalSpan * 0.14,
        mouthTopY: topY - verticalSpan * 0.62,
        faceZ,
        browZ: faceZ - halfWidth * 0.03,
        eyeX: halfWidth * 0.5,
        eyeScleraRadius: halfWidth * 0.22,
        eyePupilRadius: halfWidth * 0.11,
        browWidth: halfWidth * 0.47,
        browHeight: halfWidth * 0.095,
        browDepth: halfWidth * 0.095,
        mouthRadius,
        mouthClosedScaleY: mouthClosedHeight / (mouthRadius * 2),
        mouthOpenScaleY: mouthOpenHeight / (mouthRadius * 2),
        mouthDepth: halfWidth * 0.095,
    };
}

function darken(color: number, amount: number): number {
    const r = (color >> 16) & 255;
    const g = (color >> 8) & 255;
    const b = color & 255;
    const scale = 1 - amount;
    return (Math.round(r * scale) << 16) | (Math.round(g * scale) << 8) | Math.round(b * scale);
}

export interface FaceRig {
    group: THREE.Object3D;
    update(delta: number): void;
    setTalking(talking: boolean, text?: string): void;
    close(): void;
    open(): void;
}

export function buildFace(variant: ActorVariant, bin: Bin, phase: number, headBounds: THREE.Box3 | null): FaceRig {
    const group = new THREE.Group();
    const metrics = computeMetrics(headBounds);
    const closedScaleX = 1;
    const closedScaleY = metrics.mouthClosedScaleY;
    const mouthTopY = metrics.mouthTopY + metrics.mouthClosedScaleY * metrics.mouthRadius;

    const scleraMaterial = bin(new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.4, metalness: 0 }));

    const pupilColor = darken(variant.palette.head, 0.9);
    const pupilMaterial = bin(new THREE.MeshStandardMaterial({
        color: pupilColor === 0 ? 0x14100c : pupilColor,
        roughness: 0.25,
        metalness: 0,
    }));

    const browMaterial = bin(new THREE.MeshStandardMaterial({ color: darken(variant.palette.head, 0.55), roughness: 0.85, metalness: 0 }));
    const mouthMaterial = bin(new THREE.MeshStandardMaterial({ color: darken(variant.palette.head, 0.65), roughness: 0.75, metalness: 0 }));

    const scleraGeometry = new THREE.SphereGeometry(metrics.eyeScleraRadius, 10, 8);
    const pupilGeometry = new THREE.SphereGeometry(metrics.eyePupilRadius, 8, 8);
    const browGeometry = new THREE.BoxGeometry(metrics.browWidth, metrics.browHeight, metrics.browDepth);
    const mouthGeometry = new THREE.CylinderGeometry(metrics.mouthRadius, metrics.mouthRadius, metrics.mouthDepth, 14);

    const eyeGroups: THREE.Group[] = [];
    for (const side of [-1, 1]) {
        const eye = new THREE.Group();
        eye.position.set(side * metrics.eyeX, metrics.eyeY, metrics.faceZ);

        const sclera = new THREE.Mesh(scleraGeometry, scleraMaterial);
        sclera.scale.set(1, 1, 0.35);
        eye.add(sclera);

        const pupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        pupil.position.z = metrics.eyeScleraRadius * 0.32;
        eye.add(pupil);

        group.add(eye);
        eyeGroups.push(eye);

        const brow = new THREE.Mesh(browGeometry, browMaterial);
        brow.position.set(side * metrics.eyeX, metrics.browY, metrics.browZ);
        brow.rotation.z = -side * 0.12;
        group.add(brow);
    }

    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouth.rotation.x = Math.PI / 2;
    mouth.position.set(0, metrics.mouthTopY, metrics.faceZ);
    group.add(mouth);

    group.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) mesh.castShadow = false;
    });

    let talking = false;
    let closed = false;
    let currentScaleX = closedScaleX;
    let currentScaleY = closedScaleY;
    let targetScaleX = closedScaleX;
    let targetScaleY = closedScaleY;
    let talkClock = phase;
    let holdUntil = 0;
    let visemeSequence: VisemeShape[] = [DEFAULT_VISEME_SHAPE];
    let visemeIndex = 0;
    let lastText = "";
    let blinkClock = phase * BLINK_PHASE_SCALE;

    const applyMouthScale = () => {
        mouth.scale.x = currentScaleX;
        mouth.scale.z = currentScaleY;
        mouth.position.y = mouthTopY - currentScaleY * metrics.mouthRadius;
    };

    const settleMouth = (delta: number) => {
        if (talking) {
            talkClock += delta;
            if (talkClock >= holdUntil) {
                const [scaleX, heightFactor] = visemeSequence[visemeIndex % visemeSequence.length];
                visemeIndex++;
                targetScaleX = scaleX;
                targetScaleY = heightFactor * metrics.mouthOpenScaleY;
                holdUntil = talkClock + TALK_HOLD_MIN + Math.random() * (TALK_HOLD_MAX - TALK_HOLD_MIN);
            }
            const ease = Math.min(1, TALK_EASE_RATE * delta);
            currentScaleX += (targetScaleX - currentScaleX) * ease;
            currentScaleY += (targetScaleY - currentScaleY) * ease;
        } else {
            targetScaleX = closedScaleX;
            targetScaleY = closedScaleY;
            const ease = Math.min(1, CLOSE_EASE_RATE * delta);
            currentScaleX += (targetScaleX - currentScaleX) * ease;
            currentScaleY += (targetScaleY - currentScaleY) * ease;
        }

        applyMouthScale();
    };

    return {
        group,
        update(delta: number) {
            if (closed) return;

            settleMouth(delta);

            blinkClock += delta;
            const blink = Math.sin(blinkClock * BLINK_RATE) > BLINK_THRESHOLD ? BLINK_SQUASH : 1;
            for (const eye of eyeGroups) eye.scale.y = blink;
        },
        setTalking(next: boolean, text?: string) {
            const nextText = text ?? "";
            if (talking === next) {
                if (next && nextText !== lastText) {
                    lastText = nextText;
                    visemeSequence = buildVisemeSequence(nextText);
                    visemeIndex = 0;
                }
                return;
            }
            talking = next;
            if (talking) {
                lastText = nextText;
                visemeSequence = buildVisemeSequence(nextText);
                visemeIndex = 0;
                holdUntil = talkClock;
            } else {
                holdUntil = 0;
            }
        },
        close() {
            closed = true;
            talking = false;
            currentScaleX = closedScaleX;
            currentScaleY = closedScaleY;
            applyMouthScale();
            for (const eye of eyeGroups) eye.scale.y = 0.05;
        },
        open() {
            closed = false;
            currentScaleX = closedScaleX;
            currentScaleY = closedScaleY;
            applyMouthScale();
            for (const eye of eyeGroups) eye.scale.y = 1;
        },
    };
}
