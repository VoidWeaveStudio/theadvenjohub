// src/features/game/world/locations/showcase/actors/face.ts
import * as THREE from "three";
import type { ActorVariant } from "./variants";
import { HEAD_CENTRE_Y, HEAD_TOP_Y } from "./variants";
import { getMouthTexture, MouthShapeKind } from "./mouthTextures";

const FALLBACK_TOP_Y = HEAD_TOP_Y;
const FALLBACK_HALF_WIDTH = 0.85;
const FALLBACK_FRONT_Z = 0.78;
const FALLBACK_VERTICAL_SPAN = (HEAD_TOP_Y - HEAD_CENTRE_Y) * 2.4;

const BLINK_RATE = 1.7;
const BLINK_THRESHOLD = 0.985;
const BLINK_SQUASH = 0.08;
const BLINK_PHASE_SCALE = 3.1;

// The mouth flaps shut->open->shut on its own clock rather than marching through the
// text once — that keeps it looking natural regardless of hold duration.
const FLAP_CYCLE_MIN = 0.14;
const FLAP_CYCLE_MAX = 0.24;
const RESTING_SHAPE: MouthShapeKind = "bmp";

// A caption bubble's on-screen duration is chosen for scene pacing, not reading/speaking
// time (e.g. a 3-letter "WHY" can be held for a dramatic 3 seconds) — so the mouth can't
// just flap for as long as the bubble is visible, or it "talks" for way longer than the
// line takes to say. Instead estimate how long the LINE ITSELF takes to speak and stop
// there, independent of how long the bubble lingers afterwards. ~150 words/min average
// conversational speech, ~5.7 chars/word (incl. space) -> ~14 letters/sec.
const SPEECH_LETTERS_PER_SECOND = 14;
const MIN_SPEECH_DURATION = 0.35;

function estimateSpeechDuration(letterCount: number): number {
    return Math.max(MIN_SPEECH_DURATION, letterCount / SPEECH_LETTERS_PER_SECOND);
}

type Bin = <T extends THREE.Material>(material: T) => T;

// Rough mouth-shape groups, same idea as the classic 9-pose cartoon lip-sync chart
// (AE / CDGKN-STXYZ / R / BMP / TH / O / QW / L / FV) — not phonetically exact, just
// enough variety that a line's own letters flavor which shapes it flaps through.
const LETTER_MOUTH_SHAPES: Record<string, MouthShapeKind> = {
    a: "ae", e: "ae", i: "ae",
    c: "teeth", d: "teeth", g: "teeth", k: "teeth", n: "teeth",
    s: "teeth", t: "teeth", x: "teeth", y: "teeth", z: "teeth", j: "teeth",
    r: "r",
    b: "bmp", m: "bmp", p: "bmp",
    h: "th",
    o: "o", u: "o",
    q: "qw", w: "qw",
    l: "l",
    f: "fv", v: "fv",
};

// Spaces/punctuation are skipped — they aren't sounds, so they shouldn't get a mouth shape.
function buildShapePool(text: string): MouthShapeKind[] {
    const pool: MouthShapeKind[] = [];
    for (const ch of text) {
        const kind = LETTER_MOUTH_SHAPES[ch.toLowerCase()];
        if (kind) pool.push(kind);
    }
    if (pool.length === 0) pool.push("teeth");
    return pool;
}

function countSpeechLetters(text: string): number {
    let count = 0;
    for (const ch of text) {
        if (LETTER_MOUTH_SHAPES[ch.toLowerCase()]) count++;
    }
    return count;
}

interface FaceMetrics {
    eyeY: number;
    browY: number;
    faceZ: number;
    browZ: number;
    eyeX: number;
    eyeScleraRadius: number;
    eyePupilRadius: number;
    browWidth: number;
    browHeight: number;
    browDepth: number;
    mouthCenterY: number;
    mouthPlaneSize: number;
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
    const mouthTopY = topY - verticalSpan * 0.62;
    const mouthPlaneSize = halfWidth * 0.85;

    return {
        eyeY,
        browY: eyeY + verticalSpan * 0.14,
        faceZ,
        browZ: faceZ - halfWidth * 0.03,
        eyeX: halfWidth * 0.5,
        eyeScleraRadius: halfWidth * 0.22,
        eyePupilRadius: halfWidth * 0.11,
        browWidth: halfWidth * 0.47,
        browHeight: halfWidth * 0.095,
        browDepth: halfWidth * 0.095,
        mouthCenterY: mouthTopY - mouthPlaneSize * 0.25,
        mouthPlaneSize,
    };
}

const hatClearanceCache = new Map<string, number>();
const _hatVertex = new THREE.Vector3();

function measureHatFrontReach(hat: THREE.Object3D, targetY: number, band: number, xLimit: number): number {
    let maxZ = 0;
    hat.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        mesh.updateMatrix();
        const position = mesh.geometry.getAttribute("position");
        if (!position) return;
        for (let i = 0; i < position.count; i++) {
            _hatVertex.fromBufferAttribute(position, i);
            _hatVertex.applyMatrix4(mesh.matrix);
            if (_hatVertex.z <= 0 || Math.abs(_hatVertex.x) > xLimit) continue;
            if (Math.abs(_hatVertex.y - targetY) > band) continue;
            if (_hatVertex.z > maxZ) maxZ = _hatVertex.z;
        }
    });
    return maxZ;
}

function darken(color: number, amount: number): number {
    const r = (color >> 16) & 255;
    const g = (color >> 8) & 255;
    const b = color & 255;
    const scale = 1 - amount;
    return (Math.round(r * scale) << 16) | (Math.round(g * scale) << 8) | Math.round(b * scale);
}

const SCREAM_FLAP_MIN = 0.09;
const SCREAM_FLAP_MAX = 0.16;
const SCREAM_SHAPE: MouthShapeKind = "ae";

export interface FaceRig {
    group: THREE.Object3D;
    update(delta: number): void;
    setTalking(talking: boolean, text?: string): void;
    scream(active: boolean): void;
    close(): void;
    open(): void;
}

export function buildFace(
    variant: ActorVariant,
    bin: Bin,
    phase: number,
    headBounds: THREE.Box3 | null,
    hatObject: THREE.Object3D | null
): FaceRig {
    const group = new THREE.Group();
    const metrics = computeMetrics(headBounds);

    let eyeZ = metrics.faceZ;
    let eyeY = metrics.eyeY;
    let browY = metrics.browY;

    if (hatObject) {
        const drop = metrics.eyeScleraRadius * 0.7;
        eyeY -= drop;
        browY -= drop;

        const band = metrics.eyeScleraRadius * 0.8;
        const xLimit = metrics.eyeX + metrics.eyeScleraRadius;
        let hatFrontZ = hatClearanceCache.get(variant.hat);
        if (hatFrontZ === undefined) {
            hatFrontZ = measureHatFrontReach(hatObject, eyeY, band, xLimit);
            hatClearanceCache.set(variant.hat, hatFrontZ);
        }
        if (hatFrontZ > 0) {
            const maxEyeZ = metrics.faceZ + metrics.eyeScleraRadius * 0.6;
            eyeZ = Math.min(Math.max(eyeZ, hatFrontZ + metrics.eyeScleraRadius * 0.3), maxEyeZ);
        }
    }
    const browZ = eyeZ - (metrics.faceZ - metrics.browZ);

    const scleraMaterial = bin(new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.4, metalness: 0 }));

    const pupilColor = darken(variant.palette.head, 0.9);
    const pupilMaterial = bin(new THREE.MeshStandardMaterial({
        color: pupilColor === 0 ? 0x14100c : pupilColor,
        roughness: 0.25,
        metalness: 0,
    }));

    const browMaterial = bin(new THREE.MeshStandardMaterial({ color: darken(variant.palette.head, 0.55), roughness: 0.85, metalness: 0 }));
    const mouthMaterial = bin(new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide }));

    const scleraGeometry = new THREE.SphereGeometry(metrics.eyeScleraRadius, 10, 8);
    const pupilGeometry = new THREE.SphereGeometry(metrics.eyePupilRadius, 8, 8);
    const browGeometry = new THREE.BoxGeometry(metrics.browWidth, metrics.browHeight, metrics.browDepth);
    const mouthGeometry = new THREE.PlaneGeometry(metrics.mouthPlaneSize, metrics.mouthPlaneSize);

    const eyeGroups: THREE.Group[] = [];
    for (const side of [-1, 1]) {
        const eye = new THREE.Group();
        eye.position.set(side * metrics.eyeX, eyeY, eyeZ);

        const sclera = new THREE.Mesh(scleraGeometry, scleraMaterial);
        sclera.scale.set(1, 1, 0.35);
        eye.add(sclera);

        const pupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        pupil.position.z = metrics.eyeScleraRadius * 0.32;
        eye.add(pupil);

        group.add(eye);
        eyeGroups.push(eye);

        const brow = new THREE.Mesh(browGeometry, browMaterial);
        brow.position.set(side * metrics.eyeX, browY, browZ);
        brow.rotation.z = -side * 0.12;
        group.add(brow);
    }

    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouth.position.set(0, metrics.mouthCenterY, metrics.faceZ);
    group.add(mouth);

    group.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) mesh.castShadow = false;
    });

    let talking = false;
    let speaking = false;
    let speechRemaining = 0;
    let screaming = false;
    let closed = false;
    let flapPhase = 0;
    let flapDuration = FLAP_CYCLE_MIN;
    let openShape: MouthShapeKind = "teeth";
    let shapePool: MouthShapeKind[] = ["teeth"];
    let currentTexture: MouthShapeKind | null = null;
    let lastText = "";
    let blinkClock = phase * BLINK_PHASE_SCALE;

    const applyMouthTexture = (kind: MouthShapeKind) => {
        if (currentTexture === kind) return;
        currentTexture = kind;
        mouthMaterial.map = getMouthTexture(kind);
        mouthMaterial.needsUpdate = true;
    };
    applyMouthTexture(RESTING_SHAPE);

    const updateMouth = (delta: number) => {
        if (talking && speaking) {
            speechRemaining -= delta;
            if (speechRemaining <= 0) speaking = false;
        }

        if (screaming) {
            flapPhase += delta / flapDuration;
            if (flapPhase >= 1) {
                flapPhase -= 1;
                flapDuration = SCREAM_FLAP_MIN + Math.random() * (SCREAM_FLAP_MAX - SCREAM_FLAP_MIN);
            }
            applyMouthTexture(SCREAM_SHAPE);
            const bump = Math.sin(Math.min(flapPhase, 1) * Math.PI);
            mouth.scale.setScalar(1.05 + bump * 0.35);
        } else if (talking && speaking) {
            flapPhase += delta / flapDuration;
            if (flapPhase >= 1) {
                flapPhase -= 1;
                flapDuration = FLAP_CYCLE_MIN + Math.random() * (FLAP_CYCLE_MAX - FLAP_CYCLE_MIN);
                openShape = shapePool[Math.floor(Math.random() * shapePool.length)];
            }
            applyMouthTexture(flapPhase >= 0.5 ? openShape : RESTING_SHAPE);
            const bump = Math.sin(Math.min(flapPhase, 1) * Math.PI);
            mouth.scale.setScalar(0.9 + bump * 0.22);
        } else {
            flapPhase = 0;
            applyMouthTexture(RESTING_SHAPE);
            mouth.scale.setScalar(1);
        }
    };

    return {
        group,
        update(delta: number) {
            if (closed) return;

            updateMouth(delta);

            blinkClock += delta;
            const blink = Math.sin(blinkClock * BLINK_RATE) > BLINK_THRESHOLD ? BLINK_SQUASH : 1;
            for (const eye of eyeGroups) eye.scale.y = blink;
        },
        setTalking(next: boolean, text?: string) {
            const nextText = text ?? "";
            if (talking === next) {
                if (next && nextText !== lastText) {
                    lastText = nextText;
                    shapePool = buildShapePool(nextText);
                    speechRemaining = estimateSpeechDuration(countSpeechLetters(nextText));
                    speaking = true;
                }
                return;
            }
            talking = next;
            if (talking) {
                lastText = nextText;
                shapePool = buildShapePool(nextText);
                speechRemaining = estimateSpeechDuration(countSpeechLetters(nextText));
                speaking = true;
                flapPhase = 0;
                flapDuration = FLAP_CYCLE_MIN + Math.random() * (FLAP_CYCLE_MAX - FLAP_CYCLE_MIN);
            } else {
                speaking = false;
            }
        },
        scream(active: boolean) {
            if (screaming === active) return;
            screaming = active;
            if (active) {
                flapPhase = 0;
                flapDuration = SCREAM_FLAP_MIN + Math.random() * (SCREAM_FLAP_MAX - SCREAM_FLAP_MIN);
            }
        },
        close() {
            closed = true;
            talking = false;
            speaking = false;
            screaming = false;
            flapPhase = 0;
            applyMouthTexture(RESTING_SHAPE);
            mouth.scale.setScalar(1);
            for (const eye of eyeGroups) eye.scale.y = 0.05;
        },
        open() {
            closed = false;
            flapPhase = 0;
            applyMouthTexture(RESTING_SHAPE);
            mouth.scale.setScalar(1);
            for (const eye of eyeGroups) eye.scale.y = 1;
        },
    };
}
