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

export type CenterBoneKey = "pelvis" | "spineLower" | "spineMid" | "spineUpper" | "neck" | "head";

export const CENTER_BONES: Record<CenterBoneKey, string> = {
    pelvis: "spine",
    spineLower: "spine003",
    spineMid: "spine002",
    spineUpper: "spine001",
    neck: "neck",
    head: "head",
};

export type SideBoneKey = "shoulder" | "upperArm" | "lowerArm" | "hand" | "upperLeg" | "lowerLeg" | "foot";

export const SIDE_BONES: Record<SideBoneKey, [string, string]> = {
    shoulder: ["shoulderl", "shoulderr"],
    upperArm: ["upperarml", "upperarmr"],
    lowerArm: ["lowerarml", "lowerarmr"],
    hand: ["handl", "handr"],
    upperLeg: ["upperlegl", "upperlegr"],
    lowerLeg: ["lowerlegl", "lowerlegr"],
    foot: ["footl", "footr"],
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
    | "gawk"
    | "sitGround"
    | "kneel"
    | "bless"
    | "comfort"
    | "grieve"
    | "phone"
    | "shout"
    | "cradle"
    | "fallen"
    | "hail"
    | "point";

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
        { bone: "upperArmL", axis: "right", angle: -0.5 },
        { bone: "upperArmL", axis: "forward", angle: -0.16 },
        { bone: "lowerArmL", axis: "right", angle: -0.3 },
        { bone: "spineUpper", axis: "up", angle: 0.12, sway: 0.08, rate: 0.5 },
    ],
    lounge: [
        { bone: "upperLegL", axis: "right", angle: -1.34 },
        { bone: "upperLegR", axis: "right", angle: -1.28 },
        { bone: "lowerLegL", axis: "right", angle: 0.5 },
        { bone: "lowerLegR", axis: "right", angle: 0.44 },
        { bone: "footL", axis: "right", angle: 0.3 },
        { bone: "footR", axis: "right", angle: 0.3 },
        { bone: "upperLegL", axis: "up", angle: 0.14 },
        { bone: "upperLegR", axis: "up", angle: -0.14 },
        { bone: "spineLower", axis: "right", angle: -0.52 },
        { bone: "spineUpper", axis: "right", angle: -0.3 },
        { bone: "neck", axis: "right", angle: 0.42 },
        { bone: "upperArmL", axis: "right", angle: -0.2 },
        { bone: "upperArmL", axis: "forward", angle: -0.34 },
        { bone: "upperArmR", axis: "right", angle: -0.66 },
        { bone: "lowerArmR", axis: "right", angle: -1.3 },
        { bone: "lowerArmL", axis: "right", angle: -0.28 },
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
        { bone: "upperArmL", axis: "right", angle: -0.5 },
        { bone: "spineUpper", axis: "right", angle: -0.06 },
    ],
    gawk: [
        { bone: "neck", axis: "right", angle: -0.45 },
        { bone: "spineUpper", axis: "right", angle: -0.14 },
        { bone: "upperArmR", axis: "right", angle: -0.5 },
        { bone: "upperArmL", axis: "right", angle: -0.5 },
        { bone: "upperArmR", axis: "forward", angle: 0.3 },
        { bone: "upperArmL", axis: "forward", angle: -0.3 },
        { bone: "head", axis: "up", angle: 0, sway: 0.18, rate: 0.6 },
    ],
    sitGround: [
        { bone: "upperLegL", axis: "right", angle: -1.5 },
        { bone: "upperLegR", axis: "right", angle: -1.5 },
        { bone: "upperLegL", axis: "up", angle: 0.85 },
        { bone: "upperLegR", axis: "up", angle: -0.85 },
        { bone: "lowerLegL", axis: "right", angle: 1.95 },
        { bone: "lowerLegR", axis: "right", angle: 1.95 },
        { bone: "footL", axis: "right", angle: 0.35 },
        { bone: "footR", axis: "right", angle: 0.35 },
        { bone: "spineLower", axis: "right", angle: 0.14 },
        { bone: "upperArmL", axis: "right", angle: -0.35 },
        { bone: "upperArmR", axis: "right", angle: -0.35 },
        { bone: "upperArmL", axis: "forward", angle: -0.42 },
        { bone: "upperArmR", axis: "forward", angle: 0.42 },
        { bone: "lowerArmL", axis: "right", angle: -0.7 },
        { bone: "lowerArmR", axis: "right", angle: -0.7 },
    ],
    kneel: [
        { bone: "upperLegL", axis: "right", angle: -1.5 },
        { bone: "lowerLegL", axis: "right", angle: 1.85 },
        { bone: "footL", axis: "right", angle: 0.4 },
        { bone: "upperLegR", axis: "right", angle: -1.15 },
        { bone: "lowerLegR", axis: "right", angle: 1.2 },
        { bone: "spineLower", axis: "right", angle: 0.16 },
        { bone: "spineUpper", axis: "right", angle: 0.2 },
        { bone: "neck", axis: "right", angle: 0.34 },
        { bone: "upperArmL", axis: "right", angle: -0.95 },
        { bone: "upperArmR", axis: "right", angle: -0.95 },
        { bone: "lowerArmL", axis: "right", angle: -1.35 },
        { bone: "lowerArmR", axis: "right", angle: -1.35 },
        { bone: "lowerArmL", axis: "up", angle: -0.3 },
        { bone: "lowerArmR", axis: "up", angle: 0.3 },
    ],
    bless: [
        { bone: "upperArmR", axis: "right", angle: -1.1 },
        { bone: "upperArmR", axis: "forward", angle: 1.35 },
        { bone: "lowerArmR", axis: "right", angle: -0.55 },
        { bone: "upperArmL", axis: "right", angle: -0.7 },
        { bone: "lowerArmL", axis: "right", angle: -1.15 },
        { bone: "spineUpper", axis: "right", angle: -0.08 },
        { bone: "neck", axis: "right", angle: 0.18 },
        { bone: "head", axis: "up", angle: 0, sway: 0.12, rate: 0.8 },
    ],
    comfort: [
        { bone: "upperArmR", axis: "right", angle: -1.05 },
        { bone: "upperArmR", axis: "up", angle: -0.75 },
        { bone: "lowerArmR", axis: "right", angle: -0.5 },
        { bone: "upperArmL", axis: "right", angle: -0.3 },
        { bone: "lowerArmL", axis: "right", angle: -0.5 },
        { bone: "spineUpper", axis: "up", angle: -0.22 },
        { bone: "neck", axis: "right", angle: 0.24 },
        { bone: "neck", axis: "up", angle: -0.3 },
    ],
    grieve: [
        { bone: "spineLower", axis: "right", angle: 0.42 },
        { bone: "spineUpper", axis: "right", angle: 0.34 },
        { bone: "neck", axis: "right", angle: 0.5 },
        { bone: "upperArmL", axis: "right", angle: -1.5 },
        { bone: "upperArmR", axis: "right", angle: -1.5 },
        { bone: "lowerArmL", axis: "right", angle: -1.75 },
        { bone: "lowerArmR", axis: "right", angle: -1.75 },
        { bone: "lowerArmL", axis: "up", angle: -0.45 },
        { bone: "lowerArmR", axis: "up", angle: 0.45 },
        { bone: "spineUpper", axis: "forward", angle: 0, sway: 0.06, rate: 2.6 },
    ],
    phone: [
        { bone: "upperArmR", axis: "right", angle: -1.15 },
        { bone: "lowerArmR", axis: "right", angle: -1.5 },
        { bone: "lowerArmR", axis: "up", angle: 0.42 },
        { bone: "upperArmL", axis: "right", angle: -0.95 },
        { bone: "lowerArmL", axis: "right", angle: -1.4 },
        { bone: "lowerArmL", axis: "up", angle: -0.42 },
        { bone: "spineUpper", axis: "right", angle: 0.2 },
        { bone: "neck", axis: "right", angle: 0.46 },
    ],
    shout: [
        { bone: "spineUpper", axis: "right", angle: -0.3 },
        { bone: "neck", axis: "right", angle: -0.55 },
        { bone: "upperArmL", axis: "forward", angle: -2.2, sway: 0.18, rate: 3.2 },
        { bone: "lowerArmL", axis: "forward", angle: -0.5 },
        { bone: "upperArmR", axis: "right", angle: -1.05 },
        { bone: "lowerArmR", axis: "right", angle: -0.9 },
        { bone: "head", axis: "up", angle: 0, sway: 0.16, rate: 4.2 },
    ],
    cradle: [
        { bone: "upperLegL", axis: "right", angle: -1.5 },
        { bone: "lowerLegL", axis: "right", angle: 1.85 },
        { bone: "footL", axis: "right", angle: 0.4 },
        { bone: "upperLegR", axis: "right", angle: -1.2 },
        { bone: "lowerLegR", axis: "right", angle: 1.3 },
        { bone: "spineLower", axis: "right", angle: 0.22 },
        { bone: "spineUpper", axis: "right", angle: 0.26 },
        { bone: "neck", axis: "right", angle: 0.42 },
        { bone: "upperArmL", axis: "right", angle: -1.3 },
        { bone: "upperArmR", axis: "right", angle: -1.3 },
        { bone: "upperArmL", axis: "up", angle: 0.4 },
        { bone: "upperArmR", axis: "up", angle: -0.4 },
        { bone: "lowerArmL", axis: "right", angle: -0.55 },
        { bone: "lowerArmR", axis: "right", angle: -0.55 },
    ],
    fallen: [
        { bone: "upperLegL", axis: "right", angle: -0.3 },
        { bone: "upperLegR", axis: "right", angle: -0.18 },
        { bone: "lowerLegL", axis: "right", angle: 0.42 },
        { bone: "lowerLegR", axis: "right", angle: 0.26 },
        { bone: "spineLower", axis: "right", angle: -0.2 },
        { bone: "spineUpper", axis: "right", angle: -0.12 },
        { bone: "neck", axis: "right", angle: -0.3 },
        { bone: "upperArmL", axis: "right", angle: -0.4 },
        { bone: "upperArmL", axis: "up", angle: 0.6 },
        { bone: "upperArmR", axis: "right", angle: -0.2 },
        { bone: "upperArmR", axis: "up", angle: -0.7 },
        { bone: "lowerArmR", axis: "right", angle: -0.35 },
    ],
    hail: [
        { bone: "upperArmR", axis: "forward", angle: 2.3, sway: 0.42, rate: 2.8 },
        { bone: "lowerArmR", axis: "forward", angle: 0.4 },
        { bone: "upperArmL", axis: "right", angle: -0.85 },
        { bone: "lowerArmL", axis: "right", angle: -1.2 },
        { bone: "spineUpper", axis: "right", angle: -0.12 },
        { bone: "head", axis: "up", angle: 0, sway: 0.34, rate: 1.6 },
    ],
    point: [
        { bone: "upperArmR", axis: "right", angle: -1.5 },
        { bone: "upperArmR", axis: "forward", angle: 0.5 },
        { bone: "lowerArmR", axis: "right", angle: -0.15 },
        { bone: "upperArmL", axis: "right", angle: -0.35 },
        { bone: "lowerArmL", axis: "right", angle: -0.6 },
        { bone: "spineUpper", axis: "up", angle: 0.16 },
        { bone: "neck", axis: "up", angle: 0.12 },
    ],
};

export const SEATED_POSES: PoseId[] = ["sit", "sitSlouch", "sitGround", "kneel", "cradle", "fallen", "lounge"];

export const SEAT_PELVIS_HEIGHT = 0.458;
export const SEAT_SOLE_HEIGHT = 0.22;
export const LOUNGE_SOLE_HEIGHT = 0.26;
export const GROUND_SEAT_Y = 0.26;
export const KNEEL_DROP = 0.3;

export function seatedActorY(seatTopY: number): number {
    return seatTopY - SEAT_PELVIS_HEIGHT;
}

export function footRestY(seatTopY: number): number {
    return seatTopY - SEAT_PELVIS_HEIGHT + SEAT_SOLE_HEIGHT;
}
