//src\features\game\models\PlayerAnimator.ts
import * as THREE from 'three';
import { PlayerModelLoader } from './PlayerModelLoader';

export class PlayerAnimator {
    private mixer: THREE.AnimationMixer;
    private actions: Map<string, THREE.AnimationAction> = new Map();
    private currentAction: THREE.AnimationAction | null = null;
    private currentAnimName: string = '';
    
    private boneNames: Set<string> = new Set();
    private boneNameToMixamo: Map<string, string> = new Map();

    constructor(private model: THREE.Group) {
        this.mixer = new THREE.AnimationMixer(model);
        
        this.model.traverse((child) => {
            if (child instanceof THREE.Bone) {
                this.boneNames.add(child.name);
            }
        });
        
        console.log(`🎬 Animator: bones=${this.boneNames.size}`);
        console.log(`🦴 Bone names:`, Array.from(this.boneNames).slice(0, 10).join(', '), '...');
        
        this.buildMixamoMapping();
        
        if (this.boneNames.size === 0) {
            console.error('❌ Model has NO bones!');
            return;
        }

        const animations = PlayerModelLoader.getAllAnimations();
        console.log(`🎬 Loading ${Object.keys(animations).length} animations`);
        
        for (const [name, clip] of Object.entries(animations)) {
            if (!clip) continue;
            
            try {
                const clonedClip = clip.clone();
                
                if (clonedClip.tracks.length > 0) {
                    console.log(`📋 Clip "${name}": ${clonedClip.tracks.length} tracks`);
                } else {
                    console.warn(`⚠️ Clip "${name}" has NO tracks!`);
                    continue;
                }
                
                this.remapClipTracks(clonedClip, name);
                
                const action = this.mixer.clipAction(clonedClip);
                
                if (name === 'death') {
                    action.loop = THREE.LoopOnce;
                    action.clampWhenFinished = true;
                } else {
                    action.loop = THREE.LoopRepeat;
                }
                
                action.setEffectiveWeight(1);
                action.setEffectiveTimeScale(1);
                
                this.actions.set(name, action);
                console.log(`✅ Action "${name}" created`);
            } catch (err) {
                console.warn(`⚠️ Failed to create action for "${name}":`, err);
            }
        }
        
        console.log('🎬 Starting idle...');
        this.play('idle', 0);
    }
    
    private buildMixamoMapping() {
        const mixamoNames = [
            'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
            'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
            'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
            'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
            'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'
        ];
        
        for (const boneName of this.boneNames) {
            const lowerBone = boneName.toLowerCase();
            
            for (const mixamo of mixamoNames) {
                const lowerMixamo = mixamo.toLowerCase();
                if (lowerBone.includes(lowerMixamo) || lowerMixamo.includes(lowerBone)) {
                    this.boneNameToMixamo.set(`mixamorig${mixamo}`, boneName);
                    break;
                }
            }
        }
        
        console.log(`🔧 Built mapping for ${this.boneNameToMixamo.size} bones`);
        
        if (this.boneNameToMixamo.size === 0) {
            console.log('⚠️ No mapping found, using fallback strategy');
            this.buildFallbackMapping();
        }
    }
    
    private buildFallbackMapping() {
        const mixamoOrder = [
            'mixamorigHips', 'mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2',
            'mixamorigNeck', 'mixamorigHead',
            'mixamorigLeftShoulder', 'mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigLeftHand',
            'mixamorigRightShoulder', 'mixamorigRightArm', 'mixamorigRightForeArm', 'mixamorigRightHand',
            'mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'mixamorigLeftFoot',
            'mixamorigRightUpLeg', 'mixamorigRightLeg', 'mixamorigRightFoot'
        ];
        
        const boneArray = Array.from(this.boneNames);
        
        for (let i = 0; i < Math.min(mixamoOrder.length, boneArray.length); i++) {
            this.boneNameToMixamo.set(mixamoOrder[i], boneArray[i]);
        }
        
        console.log(`🔧 Fallback mapping: ${this.boneNameToMixamo.size} bones`);
    }
    
    private remapClipTracks(clip: THREE.AnimationClip, clipName: string) {
        if (clip.tracks.length === 0) return;
        
        let remapped = 0;
        let unknown = 0;
        
        clip.tracks = clip.tracks.map(track => {
            const parts = track.name.split('.');
            const mixamoBoneName = parts[0];
            
            const realBoneName = this.boneNameToMixamo.get(mixamoBoneName);
            
            if (realBoneName) {
                parts[0] = realBoneName;
                remapped++;
            } else if (!this.boneNames.has(mixamoBoneName)) {
                unknown++;
            }
            
            track.name = parts.join('.');
            return track;
        });
        
        console.log(`   🔧 Remapped: ${remapped}, Unknown: ${unknown}`);
    }

    play(name: string, fadeDuration: number = 0.2) {
        if (this.currentAnimName === name) return;

        const newAction = this.actions.get(name);
        if (!newAction) {
            console.warn(`⚠️ Action "${name}" not found!`);
            if (name !== 'idle') this.play('idle', fadeDuration);
            return;
        }

        const oldAction = this.currentAction;
        
        newAction.reset();
        newAction.setEffectiveTimeScale(1);
        newAction.setEffectiveWeight(1);
        
        if (oldAction) {
            oldAction.crossFadeTo(newAction, fadeDuration, false);
        }
        
        newAction.play();
        this.currentAction = newAction;
        this.currentAnimName = name;
    }

    update(deltaTime: number) {
        this.mixer.update(deltaTime);
    }

    getCurrentAnimation(): string {
        return this.currentAnimName;
    }

    getMixer(): THREE.AnimationMixer {
        return this.mixer;
    }
}