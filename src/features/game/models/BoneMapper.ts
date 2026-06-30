// src/features/game/models/BoneMapper.ts
import * as THREE from 'three';

export type LogicalBone =
    | 'hips' | 'spine' | 'spine1' | 'spine2' | 'chest'
    | 'neck' | 'head'
    | 'leftShoulder' | 'leftArm' | 'leftForeArm' | 'leftHand'
    | 'rightShoulder' | 'rightArm' | 'rightForeArm' | 'rightHand'
    | 'leftUpLeg' | 'leftLeg' | 'leftFoot' | 'leftToe'
    | 'rightUpLeg' | 'rightLeg' | 'rightFoot' | 'rightToe';


const CRITICAL_BONES: LogicalBone[] = [
    'hips', 'spine', 'head',
    'leftUpLeg', 'rightUpLeg',
    'leftArm', 'rightArm',
];


const BONE_ALIASES: Record<LogicalBone, string[]> = {
    hips: ['mixamorighips', 'hips', 'pelvis', 'root', 'bip01pelvis', 'hip'],
    spine: ['mixamorigspine', 'spine', 'spine1', 'spine_01', 'bip01spine'],
    spine1: ['mixamorigspine1', 'spine1', 'spine_02', 'bip01spine1'],
    spine2: ['mixamorigspine2', 'spine2', 'spine_03', 'chest', 'bip01spine2'],
    chest: ['chest', 'bip01chest'],
    neck: ['mixamorigneck', 'neck', 'bip01neck'],
    head: ['mixamorighead', 'head', 'bip01head'],
    leftShoulder: ['mixamorigleftshoulder', 'leftshoulder', 'shoulder_l', 'l_shoulder', 'clavicle_l'],
    leftArm: ['mixamorigleftarm', 'leftarm', 'upperarm_l', 'l_upperarm', 'arm_l'],
    leftForeArm: ['mixamorigleftforearm', 'leftforearm', 'forearm_l', 'l_forearm', 'lowerarm_l'],
    leftHand: ['mixamoriglefthand', 'lefthand', 'hand_l', 'l_hand', 'wrist_l'],
    rightShoulder: ['mixamorigrightshoulder', 'rightshoulder', 'shoulder_r', 'r_shoulder', 'clavicle_r'],
    rightArm: ['mixamorigrightarm', 'rightarm', 'upperarm_r', 'r_upperarm', 'arm_r'],
    rightForeArm: ['mixamorigrightforearm', 'rightforearm', 'forearm_r', 'r_forearm', 'lowerarm_r'],
    rightHand: ['mixamorigrighthand', 'righthand', 'hand_r', 'r_hand', 'wrist_r'],
    leftUpLeg: ['mixamorigleftupleg', 'leftupleg', 'thigh_l', 'l_thigh', 'upperleg_l'],
    leftLeg: ['mixamorigleftleg', 'leftleg', 'calf_l', 'l_calf', 'lowerleg_l', 'shin_l'],
    leftFoot: ['mixamorigleftfoot', 'leftfoot', 'foot_l', 'l_foot', 'ankle_l'],
    leftToe: ['mixamoriglefttoebase', 'lefttoebase', 'toe_l', 'l_toe', 'ball_l'],
    rightUpLeg: ['mixamorigrightupleg', 'rightupleg', 'thigh_r', 'r_thigh', 'upperleg_r'],
    rightLeg: ['mixamorigrightleg', 'rightleg', 'calf_r', 'r_calf', 'lowerleg_r', 'shin_r'],
    rightFoot: ['mixamorigrightfoot', 'rightfoot', 'foot_r', 'r_foot', 'ankle_r'],
    rightToe: ['mixamorigrighttoebase', 'righttoebase', 'toe_r', 'r_toe', 'ball_r'],
};

export class BoneMapper {
    private logicalToReal = new Map<LogicalBone, THREE.Bone>();
    private realToLogical = new Map<string, LogicalBone>();

    constructor(root: THREE.Object3D) {
        this.buildMapping(root);
    }

    private buildMapping(root: THREE.Object3D): void {
        const boneCandidates: Array<{ bone: THREE.Bone; lowerName: string }> = [];
        root.traverse((child) => {
            if (child instanceof THREE.Bone) {
                boneCandidates.push({
                    bone: child,
                    lowerName: child.name.toLowerCase().replace(/[\s._-]/g, ''),
                });
            }
        });

        if (boneCandidates.length === 0) {
            console.warn('⚠️ BoneMapper: model has no bones');
            return;
        }

        for (const [logical, aliases] of Object.entries(BONE_ALIASES) as Array<[LogicalBone, string[]]>) {
            for (const alias of aliases) {
                const normalizedAlias = alias.toLowerCase().replace(/[\s._-]/g, '');

                const exact = boneCandidates.find(c => c.lowerName === normalizedAlias);
                if (exact) {
                    this.logicalToReal.set(logical, exact.bone);
                    this.realToLogical.set(exact.bone.name, logical);
                    break;
                }

                const contains = boneCandidates.find(c =>
                    c.lowerName.includes(normalizedAlias) &&
                    c.lowerName.length < normalizedAlias.length + 5
                );
                if (contains && !this.logicalToReal.has(logical)) {
                    this.logicalToReal.set(logical, contains.bone);
                    this.realToLogical.set(contains.bone.name, logical);
                    break;
                }
            }
        }

        const missing = CRITICAL_BONES.filter(b => !this.logicalToReal.has(b));
        if (missing.length > 0) {
            console.warn(`⚠️ BoneMapper: missing critical bones: ${missing.join(', ')}. Animation may be broken.`);
        }

        console.log(`🦴 BoneMapper: mapped ${this.logicalToReal.size}/${Object.keys(BONE_ALIASES).length} bones`);
    }

    get(logical: LogicalBone): THREE.Bone | undefined {
        return this.logicalToReal.get(logical);
    }

    has(logical: LogicalBone): boolean {
        return this.logicalToReal.has(logical);
    }

    isReady(): boolean {
        return CRITICAL_BONES.every(b => this.logicalToReal.has(b));
    }

    getMapping(): Map<LogicalBone, THREE.Bone> {
        return this.logicalToReal;
    }
}