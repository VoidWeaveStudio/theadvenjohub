// src/features/game/entities/viewModelPoses.ts
import * as THREE from "three";

export interface PoseTransform {
    position: [number, number, number];
    euler: [number, number, number];
    scale: number;
}

export interface ViewModelPose {
    weapon: PoseTransform;
    hands: PoseTransform;
    left: PoseTransform;
    right: PoseTransform;
}

const t = (
    position: [number, number, number],
    euler: [number, number, number] = [0, 0, 0],
    scale = 1
): PoseTransform => ({ position, euler, scale });

// Dialled in game with the tuner. "left" and "right" are named for the hand the
// player actually sees on screen: left sits on the pistol grip and trigger,
// right runs out along the handguard. The anchors they hang off are the rig's
// rear and front grips respectively — do not rename them back to match the
// anchors, the labels exist so the editor matches the view.
const BASE: ViewModelPose = {
    weapon: t([0, 0.058, 0.031]),
    hands: t([0.024, -0.091, -0.894], [1.47, 0.715, -0.425]),
    left: t([-0.74, -0.193, -0.312], [1.88, -0.425, -0.04]),
    right: t([0.887, -0.46, -0.357], [-1.61, 2.25, 2.43]),
};

// A pistol is gripped much higher and closer in than a rifle, so both sidearms
// share their own stance instead of the rifle fallback.
const PISTOL_LEFT = t([-0.882, -0.296, -0.32], [0.57, -1.61, -0.04]);

// Each weapon is held differently, so a pose is per item with the rifle stance
// as the fallback.
const OVERRIDES: Record<string, Partial<ViewModelPose>> = {
    "moon-ladder": {
        left: t([-0.769, -0.242, -0.312], [1.88, -0.425, -0.04]),
    },
    "whale-cannon": { left: PISTOL_LEFT },
    "dust-nine": { left: PISTOL_LEFT },
};

export function poseFor(itemId: string | null): ViewModelPose {
    const override = itemId ? OVERRIDES[itemId] : undefined;
    return {
        weapon: override?.weapon ?? BASE.weapon,
        hands: override?.hands ?? BASE.hands,
        left: override?.left ?? BASE.left,
        right: override?.right ?? BASE.right,
    };
}

export function applyPose(target: { position: THREE.Vector3; euler: THREE.Euler; scale: number }, pose: PoseTransform) {
    target.position.set(pose.position[0], pose.position[1], pose.position[2]);
    target.euler.set(pose.euler[0], pose.euler[1], pose.euler[2]);
    target.scale = pose.scale;
}
