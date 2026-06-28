// src/features/game/models/ProceduralAnimation.ts
import * as THREE from 'three';

export class ProceduralAnimation {
    private bones: Map<string, THREE.Bone> = new Map();
    private restPose: Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion }> = new Map();
    private time: number = 0;

    private boneMapping: Map<string, string> = new Map();

    constructor(private model: THREE.Group) {
        this.collectBones();
        this.buildBoneMapping();
        this.saveRestPose();
    }

    private collectBones() {
        this.model.traverse((child) => {
            if (child instanceof THREE.Bone) {
                this.bones.set(child.name, child);
            }
        });
        console.log(`🦴 ProceduralAnimation: found ${this.bones.size} bones`);
    }

    private buildBoneMapping() {
        const logicalToPossibleNames: Record<string, string[]> = {
            'hips': ['mixamorigHips', 'Hips', 'hip', 'Pelvis'],
            'spine': ['mixamorigSpine', 'Spine', 'spine_01'],
            'spine1': ['mixamorigSpine1', 'Spine1', 'spine_02'],
            'spine2': ['mixamorigSpine2', 'Spine2', 'Chest', 'spine_03'],
            'neck': ['mixamorigNeck', 'Neck'],
            'head': ['mixamorigHead', 'Head'],
            'leftShoulder': ['mixamorigLeftShoulder', 'LeftShoulder'],
            'leftArm': ['mixamorigLeftArm', 'LeftArm'],
            'leftForeArm': ['mixamorigLeftForeArm', 'LeftForeArm'],
            'leftHand': ['mixamorigLeftHand', 'LeftHand'],
            'rightShoulder': ['mixamorigRightShoulder', 'RightShoulder'],
            'rightArm': ['mixamorigRightArm', 'RightArm'],
            'rightForeArm': ['mixamorigRightForeArm', 'RightForeArm'],
            'rightHand': ['mixamorigRightHand', 'RightHand'],
            'leftUpLeg': ['mixamorigLeftUpLeg', 'LeftUpLeg', 'LeftThigh'],
            'leftLeg': ['mixamorigLeftLeg', 'LeftLeg', 'LeftCalf'],
            'leftFoot': ['mixamorigLeftFoot', 'LeftFoot'],
            'rightUpLeg': ['mixamorigRightUpLeg', 'RightUpLeg', 'RightThigh'],
            'rightLeg': ['mixamorigRightLeg', 'RightLeg', 'RightCalf'],
            'rightFoot': ['mixamorigRightFoot', 'RightFoot'],
        };

        const boneNames = Array.from(this.bones.keys());

        for (const [logical, possibleNames] of Object.entries(logicalToPossibleNames)) {
            for (const possibleName of possibleNames) {
                const found = boneNames.find(name => 
                    name.toLowerCase() === possibleName.toLowerCase() ||
                    name.toLowerCase().includes(possibleName.toLowerCase())
                );
                if (found) {
                    this.boneMapping.set(logical, found);
                    break;
                }
            }
        }

        console.log(`🔧 ProceduralAnimation: mapped ${this.boneMapping.size} logical bones`);
    }

    private saveRestPose() {
        this.bones.forEach((bone, name) => {
            this.restPose.set(name, {
                position: bone.position.clone(),
                quaternion: bone.quaternion.clone()
            });
        });
    }

    private getBone(logicalName: string): THREE.Bone | undefined {
        const realName = this.boneMapping.get(logicalName);
        if (!realName) return undefined;
        return this.bones.get(realName);
    }

    private applyBoneRotation(logicalName: string, euler: THREE.Euler, weight: number = 1) {
        const bone = this.getBone(logicalName);
        const realName = this.boneMapping.get(logicalName);
        if (!bone || !realName) return;

        const rest = this.restPose.get(realName);
        if (!rest) return;

        const delta = new THREE.Quaternion().setFromEuler(euler);
        const target = rest.quaternion.clone().multiply(delta);
        bone.quaternion.slerp(target, weight);
    }

    private applyBonePosition(logicalName: string, offset: THREE.Vector3, weight: number = 1) {
        const bone = this.getBone(logicalName);
        const realName = this.boneMapping.get(logicalName);
        if (!bone || !realName) return;

        const rest = this.restPose.get(realName);
        if (!rest) return;

        const target = rest.position.clone().add(offset);
        bone.position.lerp(target, weight);
    }

    animateWalk(speed: number, deltaTime: number) {
        this.time += deltaTime;
        const frequency = 8;
        const phase = this.time * frequency * speed;

        const bodyBob = Math.abs(Math.sin(phase * 2)) * 0.03;
        const bodySway = Math.sin(phase) * 0.05;

        this.applyBonePosition('hips', new THREE.Vector3(0, bodyBob, 0), 0.5);
        this.applyBoneRotation('hips', new THREE.Euler(0, 0, bodySway), 0.3);

        const leftLegSwing = Math.sin(phase) * 0.5;
        const rightLegSwing = Math.sin(phase + Math.PI) * 0.5;

        const leftKneeBend = Math.max(0, Math.sin(phase)) * 0.8;
        const rightKneeBend = Math.max(0, Math.sin(phase + Math.PI)) * 0.8;

        this.applyBoneRotation('leftUpLeg', new THREE.Euler(leftLegSwing, 0, 0), 0.4);
        this.applyBoneRotation('leftLeg', new THREE.Euler(-leftKneeBend, 0, 0), 0.4);

        this.applyBoneRotation('rightUpLeg', new THREE.Euler(rightLegSwing, 0, 0), 0.4);
        this.applyBoneRotation('rightLeg', new THREE.Euler(-rightKneeBend, 0, 0), 0.4);

        const leftArmSwing = Math.sin(phase + Math.PI) * 0.3;
        const rightArmSwing = Math.sin(phase) * 0.3;

        this.applyBoneRotation('leftArm', new THREE.Euler(leftArmSwing, 0, 0), 0.3);
        this.applyBoneRotation('rightArm', new THREE.Euler(rightArmSwing, 0, 0), 0.3);
    }

    animateIdle(deltaTime: number) {
        this.time += deltaTime;

        const breath = Math.sin(this.time * 2) * 0.01;
        const sway = Math.sin(this.time * 0.5) * 0.02;

        this.applyBoneRotation('spine', new THREE.Euler(0, 0, sway), 0.2);
        this.applyBonePosition('spine2', new THREE.Vector3(0, breath, 0), 0.3);
    }

    animateAim(aimDirection: THREE.Vector3) {
        const spineYaw = THREE.MathUtils.clamp(
            Math.atan2(aimDirection.x, aimDirection.z),
            -0.5,
            0.5
        );

        this.applyBoneRotation('spine1', new THREE.Euler(0, spineYaw, 0), 0.3);
        this.applyBoneRotation('spine2', new THREE.Euler(0, spineYaw * 0.5, 0), 0.3);

        const verticalAngle = Math.asin(THREE.MathUtils.clamp(aimDirection.y, -1, 1));
        const leanForward = Math.abs(verticalAngle) * 0.1;
        this.applyBoneRotation('spine', new THREE.Euler(leanForward, 0, 0), 0.2);
    }

    animateLean(strafeInput: number) {
        const leanAngle = strafeInput * 0.3;
        this.applyBoneRotation('spine', new THREE.Euler(0, 0, -leanAngle), 0.4);
    }

    animateHeadLook(aimDirection: THREE.Vector3) {
        const yaw = Math.atan2(aimDirection.x, aimDirection.z);
        const pitch = Math.asin(THREE.MathUtils.clamp(aimDirection.y, -1, 1));

        const clampedYaw = THREE.MathUtils.clamp(yaw, -0.8, 0.8);
        const clampedPitch = THREE.MathUtils.clamp(pitch, -0.5, 0.5);

        this.applyBoneRotation('head', new THREE.Euler(clampedPitch, clampedYaw, 0), 0.5);
    }

    reset() {
        this.bones.forEach((bone, name) => {
            const rest = this.restPose.get(name);
            if (rest) {
                bone.position.copy(rest.position);
                bone.quaternion.copy(rest.quaternion);
            }
        });
    }

    updateSkeleton() {
        this.model.traverse((child) => {
            if ((child as any).isSkinnedMesh) {
                const skinnedMesh = child as THREE.SkinnedMesh;
                if (skinnedMesh.skeleton) {
                    skinnedMesh.skeleton.update();
                }
            }
        });
    }
}