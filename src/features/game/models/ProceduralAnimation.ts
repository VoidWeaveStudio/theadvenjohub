// src/features/game/models/ProceduralAnimation.ts
import * as THREE from 'three';
import { BoneMapper, LogicalBone } from './BoneMapper';

export interface WalkConfig {
    frequency: number;          
    bodyBobAmplitude: number;   
    bodySwayAmplitude: number;   
    legSwingAmplitude: number; 
    kneeBendAmplitude: number;  
    armSwingAmplitude: number;   
    hipTiltAmplitude: number;   
}

const DEFAULT_WALK_CONFIG: WalkConfig = {
    frequency: 8,
    bodyBobAmplitude: 0.03,
    bodySwayAmplitude: 0.05,
    legSwingAmplitude: 0.5,
    kneeBendAmplitude: 0.8,
    armSwingAmplitude: 0.3,
    hipTiltAmplitude: 0.1,
};

export interface IdleConfig {
    breathFrequency: number;   
    breathAmplitude: number;   
    swayFrequency: number;    
    swayAmplitude: number;     
}

const DEFAULT_IDLE_CONFIG: IdleConfig = {
    breathFrequency: 2,
    breathAmplitude: 0.01,
    swayFrequency: 0.5,
    swayAmplitude: 0.02,
};

export type AnimState = 'idle' | 'walk' | 'run' | 'shoot' | 'reload' | 'death';


export class ProceduralAnimation {
    private mapper: BoneMapper;

    private readonly scratchEuler = new THREE.Euler();
    private readonly scratchQuat = new THREE.Quaternion();
    private readonly scratchQuat2 = new THREE.Quaternion();
    private readonly scratchVec = new THREE.Vector3();

    private restPositions = new Map<THREE.Bone, THREE.Vector3>();
    private restQuaternions = new Map<THREE.Bone, THREE.Quaternion>();

    private time = 0;
    private walkBlend = 0;       
    private currentState: AnimState = 'idle';

    private walkConfig: WalkConfig;
    private idleConfig: IdleConfig;

    constructor(root: THREE.Object3D, walkConfig?: Partial<WalkConfig>, idleConfig?: Partial<IdleConfig>) {
        this.mapper = new BoneMapper(root);
        this.walkConfig = { ...DEFAULT_WALK_CONFIG, ...walkConfig };
        this.idleConfig = { ...DEFAULT_IDLE_CONFIG, ...idleConfig };
        this.saveRestPose(root);
    }

    private saveRestPose(root: THREE.Object3D): void {
        root.traverse((child) => {
            if (child instanceof THREE.Bone) {
                this.restPositions.set(child, child.position.clone());
                this.restQuaternions.set(child, child.quaternion.clone());
            }
        });
    }

    isReady(): boolean {
        return this.mapper.isReady();
    }

    /**
     * 
     * @param deltaTime 
     * @param state 
     * @param speed 
     * @param strafe 
     * @param aimDirection 
     */
    update(
        deltaTime: number,
        state: AnimState,
        speed: number = 0,
        strafe: number = 0,
        aimDirection?: THREE.Vector3,
    ): void {
        if (!this.mapper.isReady()) return;

        this.time += deltaTime;
        this.currentState = state;

        const targetWalkBlend = (state === 'walk' || state === 'run') ? 1 : 0;
        const blendSpeed = 5; 
        this.walkBlend += (targetWalkBlend - this.walkBlend) * Math.min(1, deltaTime * blendSpeed);

        this.applyIdle(1 - this.walkBlend);

        if (this.walkBlend > 0.01) {
            this.applyWalk(speed, this.walkBlend);
        }

        if (Math.abs(strafe) > 0.05) {
            this.applyLean(strafe);
        }

        if (aimDirection) {
            this.applyAim(aimDirection);
            this.applyHeadLook(aimDirection);
        }

        if (state === 'death') {
            this.applyDeath(deltaTime);
        }
    }

    private applyIdle(weight: number): void {
        if (weight < 0.01) return;

        const { breathFrequency, breathAmplitude, swayFrequency, swayAmplitude } = this.idleConfig;
        const t = this.time;

        const breath = Math.sin(t * breathFrequency) * breathAmplitude * weight;
        this.applyPositionOffset('spine2', this.scratchVec.set(0, breath, 0), weight);

        const sway = Math.sin(t * swayFrequency) * swayAmplitude * weight;
        this.applyRotationOffset('spine', this.scratchEuler.set(0, 0, sway), weight);
    }

    private applyWalk(speed: number, weight: number): void {
        const { frequency, bodyBobAmplitude, bodySwayAmplitude, legSwingAmplitude, kneeBendAmplitude, armSwingAmplitude, hipTiltAmplitude } = this.walkConfig;
        const phase = this.time * frequency * Math.max(0.3, speed);

        const bodyBob = Math.abs(Math.sin(phase * 2)) * bodyBobAmplitude * weight;
        this.applyPositionOffset('hips', this.scratchVec.set(0, bodyBob, 0), weight);

        const bodySway = Math.sin(phase) * bodySwayAmplitude * weight;
        this.applyRotationOffset('hips', this.scratchEuler.set(0, 0, bodySway), weight);

        const hipTilt = Math.sin(phase * 2) * hipTiltAmplitude * weight;
        this.applyRotationOffset('hips', this.scratchEuler.set(hipTilt, 0, 0), weight * 0.5);

        const leftLegSwing = Math.sin(phase) * legSwingAmplitude * weight;
        const rightLegSwing = Math.sin(phase + Math.PI) * legSwingAmplitude * weight;

        const leftKneeBend = Math.max(0, Math.sin(phase)) * kneeBendAmplitude * weight;
        const rightKneeBend = Math.max(0, Math.sin(phase + Math.PI)) * kneeBendAmplitude * weight;

        this.applyRotationOffset('leftUpLeg', this.scratchEuler.set(leftLegSwing, 0, 0), weight);
        this.applyRotationOffset('leftLeg', this.scratchEuler.set(-leftKneeBend, 0, 0), weight);
        this.applyRotationOffset('rightUpLeg', this.scratchEuler.set(rightLegSwing, 0, 0), weight);
        this.applyRotationOffset('rightLeg', this.scratchEuler.set(-rightKneeBend, 0, 0), weight);

        const leftFootComp = Math.max(0, -Math.sin(phase)) * 0.3 * weight;
        const rightFootComp = Math.max(0, -Math.sin(phase + Math.PI)) * 0.3 * weight;
        this.applyRotationOffset('leftFoot', this.scratchEuler.set(leftFootComp, 0, 0), weight * 0.5);
        this.applyRotationOffset('rightFoot', this.scratchEuler.set(rightFootComp, 0, 0), weight * 0.5);

        const leftArmSwing = Math.sin(phase + Math.PI) * armSwingAmplitude * weight;
        const rightArmSwing = Math.sin(phase) * armSwingAmplitude * weight;

        this.applyRotationOffset('leftArm', this.scratchEuler.set(leftArmSwing, 0, 0), weight);
        this.applyRotationOffset('rightArm', this.scratchEuler.set(rightArmSwing, 0, 0), weight);

        const leftElbowBend = Math.max(0, Math.sin(phase + Math.PI)) * 0.4 * weight;
        const rightElbowBend = Math.max(0, Math.sin(phase)) * 0.4 * weight;
        this.applyRotationOffset('leftForeArm', this.scratchEuler.set(-leftElbowBend, 0, 0), weight * 0.5);
        this.applyRotationOffset('rightForeArm', this.scratchEuler.set(-rightElbowBend, 0, 0), weight * 0.5);
    }

    private applyLean(strafe: number): void {
        const leanAngle = THREE.MathUtils.clamp(strafe, -1, 1) * 0.25;
        this.applyRotationOffset('spine', this.scratchEuler.set(0, 0, -leanAngle), 0.6);
    }

    private applyAim(aimDirection: THREE.Vector3): void {
        const yaw = Math.atan2(aimDirection.x, aimDirection.z);
        const spineYaw = THREE.MathUtils.clamp(yaw, -0.5, 0.5);
        this.applyRotationOffset('spine1', this.scratchEuler.set(0, spineYaw, 0), 0.4);
        this.applyRotationOffset('spine2', this.scratchEuler.set(0, spineYaw * 0.5, 0), 0.3);

        const verticalAngle = Math.asin(THREE.MathUtils.clamp(aimDirection.y, -1, 1));
        const leanForward = Math.abs(verticalAngle) * 0.1;
        this.applyRotationOffset('spine', this.scratchEuler.set(leanForward, 0, 0), 0.3);
    }

    private applyHeadLook(aimDirection: THREE.Vector3): void {
        const yaw = Math.atan2(aimDirection.x, aimDirection.z);
        const pitch = Math.asin(THREE.MathUtils.clamp(aimDirection.y, -1, 1));

        const clampedYaw = THREE.MathUtils.clamp(yaw, -0.8, 0.8);
        const clampedPitch = THREE.MathUtils.clamp(pitch, -0.5, 0.5);

        this.applyRotationOffset('head', this.scratchEuler.set(clampedPitch, clampedYaw, 0), 0.7);
    }

    private applyDeath(deltaTime: number): void {
        const fallProgress = Math.min(1, this.time * 0.8);
        const fallAngle = fallProgress * Math.PI / 2;

        this.applyRotationOffset('hips', this.scratchEuler.set(-fallAngle, 0, 0), fallProgress);
        this.applyRotationOffset('spine', this.scratchEuler.set(-fallAngle * 0.3, 0, 0), fallProgress);
    }


    private applyRotationOffset(logical: LogicalBone, euler: THREE.Euler, weight: number): void {
        const bone = this.mapper.get(logical);
        if (!bone) return;

        const rest = this.restQuaternions.get(bone);
        if (!rest) return;

        this.scratchQuat.setFromEuler(euler);
        this.scratchQuat2.copy(rest).multiply(this.scratchQuat);
        bone.quaternion.slerp(this.scratchQuat2, weight);
    }

  
    private applyPositionOffset(logical: LogicalBone, offset: THREE.Vector3, weight: number): void {
        const bone = this.mapper.get(logical);
        if (!bone) return;

        const rest = this.restPositions.get(bone);
        if (!rest) return;

        this.scratchVec.copy(rest).add(offset);
        bone.position.lerp(this.scratchVec, weight);
    }

    reset(): void {
        this.restQuaternions.forEach((quat, bone) => {
            bone.quaternion.copy(quat);
        });
        this.restPositions.forEach((pos, bone) => {
            bone.position.copy(pos);
        });
        this.time = 0;
        this.walkBlend = 0;
    }

    getMapper(): BoneMapper {
        return this.mapper;
    }
}