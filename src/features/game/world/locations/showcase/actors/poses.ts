// src/features/game/world/locations/showcase/actors/poses.ts
export type BoneKey =
    | "pelvis"
    | "spineLower"
    | "spineMid"
    | "spineUpper"
    | "neck"
    | "head"
    | "shoulderL"
    | "shoulderR"
    | "upperArmL"
    | "upperArmR"
    | "lowerArmL"
    | "lowerArmR"
    | "handL"
    | "handR"
    | "upperLegL"
    | "upperLegR"
    | "lowerLegL"
    | "lowerLegR"
    | "footL"
    | "footR";

export const BONE_NAMES: Record<BoneKey, string> = {
    pelvis: "Spine",
    spineLower: "Spine003",
    spineMid: "Spine002",
    spineUpper: "Spine001",
    neck: "Neck",
    head: "Head",
    shoulderL: "ShoulderL",
    shoulderR: "ShoulderR",
    upperArmL: "UpperarmL",
    upperArmR: "UpperarmR",
    lowerArmL: "LowerarmL",
    lowerArmR: "LowerarmR",
    handL: "HandL",
    handR: "HandR",
    upperLegL: "UpperlegL",
    upperLegR: "UpperlegR",
    lowerLegL: "LowerlegL",
    lowerLegR: "LowerlegR",
    footL: "FootL",
    footR: "FootR",
};

export type BodyAxis = "right" | "up" | "forward";

export interface PoseBend {
    bone: BoneKey;
    axis: BodyAxis;
    angle: number;
    sway?: number;
    rate?: number;
    phase?: number;
}

export type PoseId =
    | "sit"
    | "sitSlouch"
    | "pray"
    | "preach"
    | "cheer"
    | "toast"
    | "lounge"
    | "aim"
    | "crouchAim"
    | "mourn"
    | "haggle"
    | "carry"
    | "dance"
    | "work"
    | "salute"
    | "gawk";

const SIT_THIGH = -1.42;
const SIT_SHIN = 1.4;

export const POSES: Record<PoseId, PoseBend[]> = {
    sit: [
        { bone: "upperLegL", axis: "right", angle: SIT_THIGH },
        { bone: "upperLegR", axis: "right", angle: SIT_THIGH },
        { bone: "lowerLegL", axis: "right", angle: SIT_SHIN },
        { bone: "lowerLegR", axis: "right", angle: SIT_SHIN },
        { bone: "footL", axis: "right", angle: 0.22 },
        { bone: "footR", axis: "right", angle: 0.22 },
        { bone: "upperLegL", axis: "up", angle: 0.1 },
        { bone: "upperLegR", axis: "up", angle: -0.1 },
        { bone: "spineLower", axis: "right", angle: 0.1 },
        { bone: "upperArmL", axis: "right", angle: -0.5 },
        { bone: "upperArmR", axis: "right", angle: -0.5 },
        { bone: "lowerArmL", axis: "right", angle: -0.85 },
        { bone: "lowerArmR", axis: "right", angle: -0.85 },
    ],
    sitSlouch: [
        { bone: "upperLegL", axis: "right", angle: SIT_THIGH + 0.12 },
        { bone: "upperLegR", axis: "right", angle: SIT_THIGH - 0.1 },
        { bone: "lowerLegL", axis: "right", angle: SIT_SHIN - 0.35 },
        { bone: "lowerLegR", axis: "right", angle: SIT_SHIN },
        { bone: "upperLegL", axis: "up", angle: 0.22 },
        { bone: "upperLegR", axis: "up", angle: -0.16 },
        { bone: "spineLower", axis: "right", angle: -0.18 },
        { bone: "spineUpper", axis: "right", angle: 0.14 },
        { bone: "neck", axis: "right", angle: 0.12 },
        { bone: "upperArmL", axis: "forward", angle: -0.5 },
        { bone: "upperArmR", axis: "forward", angle: 0.5 },
        { bone: "lowerArmL", axis: "right", angle: -0.4 },
        { bone: "lowerArmR", axis: "right", angle: -0.4 },
    ],
    pray: [
        { bone: "neck", axis: "right", angle: 0.34 },
        { bone: "spineUpper", axis: "right", angle: 0.12 },
        { bone: "upperArmL", axis: "right", angle: -1.05 },
        { bone: "upperArmR", axis: "right", angle: -1.05 },
        { bone: "upperArmL", axis: "forward", angle: -0.3 },
        { bone: "upperArmR", axis: "forward", angle: 0.3 },
        { bone: "lowerArmL", axis: "right", angle: -1.45 },
        { bone: "lowerArmR", axis: "right", angle: -1.45 },
        { bone: "lowerArmL", axis: "up", angle: -0.35 },
        { bone: "lowerArmR", axis: "up", angle: 0.35 },
    ],
    preach: [
        { bone: "upperArmR", axis: "forward", angle: 2.15, sway: 0.16, rate: 1.1 },
        { bone: "lowerArmR", axis: "forward", angle: 0.35 },
        { bone: "upperArmL", axis: "right", angle: -0.95 },
        { bone: "lowerArmL", axis: "right", angle: -0.8 },
        { bone: "upperArmL", axis: "forward", angle: -0.25 },
        { bone: "spineUpper", axis: "right", angle: 0.14, sway: 0.06, rate: 0.9 },
        { bone: "neck", axis: "right", angle: -0.2 },
        { bone: "head", axis: "up", angle: 0, sway: 0.26, rate: 0.7 },
    ],
    cheer: [
        { bone: "upperArmR", axis: "forward", angle: 2.45, sway: 0.22, rate: 2.4 },
        { bone: "upperArmL", axis: "forward", angle: -2.45, sway: 0.22, rate: 2.4, phase: Math.PI },
        { bone: "lowerArmR", axis: "forward", angle: 0.3 },
        { bone: "lowerArmL", axis: "forward", angle: -0.3 },
        { bone: "spineUpper", axis: "right", angle: -0.1 },
        { bone: "neck", axis: "right", angle: -0.25 },
    ],
    toast: [
        { bone: "upperArmR", axis: "right", angle: -0.72 },
        { bone: "lowerArmR", axis: "right", angle: -1.55 },
        { bone: "upperArmR", axis: "forward", angle: 0.22 },
        { bone: "upperArmL", axis: "forward", angle: -0.16 },
        { bone: "lowerArmL", axis: "right", angle: -0.3 },
        { bone: "spineUpper", axis: "up", angle: 0.12, sway: 0.08, rate: 0.5 },
    ],
    lounge: [
        { bone: "upperLegL", axis: "right", angle: 0.85 },
        { bone: "upperLegR", axis: "right", angle: 0.8 },
        { bone: "lowerLegL", axis: "right", angle: 0.2 },
        { bone: "lowerLegR", axis: "right", angle: 0.26 },
        { bone: "upperLegL", axis: "up", angle: 0.12 },
        { bone: "upperLegR", axis: "up", angle: -0.12 },
        { bone: "upperArmL", axis: "forward", angle: -0.55 },
        { bone: "upperArmR", axis: "right", angle: -0.7 },
        { bone: "lowerArmR", axis: "right", angle: -1.45 },
        { bone: "neck", axis: "right", angle: 0.1 },
    ],
    aim: [
        { bone: "upperArmR", axis: "right", angle: -1.3 },
        { bone: "lowerArmR", axis: "right", angle: -0.95 },
        { bone: "upperArmR", axis: "forward", angle: 0.35 },
        { bone: "upperArmL", axis: "right", angle: -1.45 },
        { bone: "lowerArmL", axis: "right", angle: -0.55 },
        { bone: "upperArmL", axis: "forward", angle: -0.2 },
        { bone: "spineUpper", axis: "up", angle: -0.22 },
        { bone: "neck", axis: "right", angle: 0.12 },
    ],
    crouchAim: [
        { bone: "upperLegL", axis: "right", angle: -1.05 },
        { bone: "upperLegR", axis: "right", angle: -0.7 },
        { bone: "lowerLegL", axis: "right", angle: 1.5 },
        { bone: "lowerLegR", axis: "right", angle: 1.15 },
        { bone: "upperLegL", axis: "up", angle: 0.2 },
        { bone: "spineLower", axis: "right", angle: 0.3 },
        { bone: "upperArmR", axis: "right", angle: -1.25 },
        { bone: "lowerArmR", axis: "right", angle: -1.0 },
        { bone: "upperArmL", axis: "right", angle: -1.4 },
        { bone: "lowerArmL", axis: "right", angle: -0.6 },
        { bone: "neck", axis: "right", angle: -0.2 },
    ],
    mourn: [
        { bone: "neck", axis: "right", angle: 0.4 },
        { bone: "spineUpper", axis: "right", angle: 0.16 },
        { bone: "spineLower", axis: "right", angle: 0.1 },
        { bone: "upperArmL", axis: "right", angle: -0.55 },
        { bone: "upperArmR", axis: "right", angle: -0.55 },
        { bone: "lowerArmL", axis: "right", angle: -1.35 },
        { bone: "lowerArmR", axis: "right", angle: -1.35 },
        { bone: "lowerArmL", axis: "up", angle: -0.7 },
        { bone: "lowerArmR", axis: "up", angle: 0.7 },
    ],
    haggle: [
        { bone: "upperArmR", axis: "right", angle: -1.25, sway: 0.2, rate: 2.1 },
        { bone: "lowerArmR", axis: "right", angle: -0.35 },
        { bone: "upperArmL", axis: "right", angle: -0.4 },
        { bone: "lowerArmL", axis: "right", angle: -1.1 },
        { bone: "spineUpper", axis: "right", angle: 0.12 },
        { bone: "head", axis: "up", angle: 0, sway: 0.2, rate: 1.3 },
    ],
    carry: [
        { bone: "upperArmL", axis: "right", angle: -0.45 },
        { bone: "upperArmR", axis: "right", angle: -0.45 },
        { bone: "lowerArmL", axis: "right", angle: -1.25 },
        { bone: "lowerArmR", axis: "right", angle: -1.25 },
        { bone: "upperArmL", axis: "forward", angle: -0.2 },
        { bone: "upperArmR", axis: "forward", angle: 0.2 },
    ],
    dance: [
        { bone: "upperArmR", axis: "forward", angle: 2.1, sway: 0.55, rate: 3.4 },
        { bone: "upperArmL", axis: "forward", angle: -2.1, sway: 0.55, rate: 3.4, phase: Math.PI },
        { bone: "lowerArmR", axis: "forward", angle: 0.45 },
        { bone: "lowerArmL", axis: "forward", angle: -0.45 },
        { bone: "pelvis", axis: "up", angle: 0, sway: 0.3, rate: 3.4 },
        { bone: "spineUpper", axis: "right", angle: 0, sway: 0.18, rate: 3.4, phase: Math.PI / 2 },
    ],
    work: [
        { bone: "upperArmL", axis: "right", angle: -1.15 },
        { bone: "upperArmR", axis: "right", angle: -1.15 },
        { bone: "lowerArmL", axis: "right", angle: -0.85, sway: 0.3, rate: 5.5 },
        { bone: "lowerArmR", axis: "right", angle: -0.85, sway: 0.3, rate: 5.5, phase: Math.PI },
        { bone: "spineUpper", axis: "right", angle: 0.18 },
        { bone: "neck", axis: "right", angle: 0.24 },
    ],
    salute: [
        { bone: "upperArmR", axis: "right", angle: -0.55 },
        { bone: "upperArmR", axis: "forward", angle: 1.15 },
        { bone: "lowerArmR", axis: "right", angle: -1.85 },
        { bone: "spineUpper", axis: "right", angle: -0.06 },
    ],
    gawk: [
        { bone: "neck", axis: "right", angle: -0.45 },
        { bone: "spineUpper", axis: "right", angle: -0.14 },
        { bone: "upperArmR", axis: "forward", angle: 0.3 },
        { bone: "upperArmL", axis: "forward", angle: -0.3 },
        { bone: "head", axis: "up", angle: 0, sway: 0.18, rate: 0.6 },
    ],
};

export const SEATED_POSES: PoseId[] = ["sit", "sitSlouch"];

export const SEAT_PELVIS_HEIGHT = 0.458;
export const SEAT_SOLE_HEIGHT = 0.22;
export const LOUNGE_SOLE_HEIGHT = 0.26;

export function seatedActorY(seatTopY: number): number {
    return seatTopY - SEAT_PELVIS_HEIGHT;
}

export function footRestY(seatTopY: number): number {
    return seatTopY - SEAT_PELVIS_HEIGHT + SEAT_SOLE_HEIGHT;
}
