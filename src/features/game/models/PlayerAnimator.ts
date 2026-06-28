//src\features\game\models\PlayerAnimator.ts
import * as THREE from 'three';
import { PlayerModelLoader } from './PlayerModelLoader';

export class PlayerAnimator {
    private mixer: THREE.AnimationMixer;
    private actions: Map<string, THREE.AnimationAction> = new Map();
    private currentAction: THREE.AnimationAction | null = null;
    private currentAnimName: string = '';
    
    private boneNames: Set<string> = new Set();
    private rootBoneName: string = '';

    constructor(private model: THREE.Group) {
        this.mixer = new THREE.AnimationMixer(model);
        
        this.model.traverse((child) => {
            if (child instanceof THREE.Bone) {
                this.boneNames.add(child.name);
            }
        });
        
        this.model.traverse((child) => {
            if (child instanceof THREE.Bone && !(child.parent instanceof THREE.Bone)) {
                this.rootBoneName = child.name;
            }
        });
        
        console.log(`🎬 Animator: root="${this.rootBoneName}", bones=${this.boneNames.size}`);
        
        if (this.boneNames.size === 0) {
            console.error('❌ Model has NO bones! Animations will not work!');
            return;
        }

        const animations = PlayerModelLoader.getAllAnimations();
        console.log(`🎬 Loading ${Object.keys(animations).length} animations`);
        
        for (const [name, clip] of Object.entries(animations)) {
            if (!clip) {
                console.warn(`⚠️ Clip "${name}" is null, skipping`);
                continue;
            }
            
            try {
                const clonedClip = clip.clone();
                
                if (clonedClip.tracks.length > 0) {
                    console.log(`📋 Clip "${name}": ${clonedClip.tracks.length} tracks, ${clonedClip.duration.toFixed(2)}s`);
                    console.log(`   Before: "${clonedClip.tracks[0].name}"`);
                } else {
                    console.warn(`⚠️ Clip "${name}" has NO tracks!`);
                    continue;
                }
                
                this.remapClipTracks(clonedClip, name);
                
                console.log(`   After:  "${clonedClip.tracks[0].name}"`);
                
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
    
    private remapClipTracks(clip: THREE.AnimationClip, clipName: string) {
        if (clip.tracks.length === 0) return;
        
        let unknownCount = 0;
        for (const track of clip.tracks) {
            const firstName = track.name.split('.')[0];
            if (!this.boneNames.has(firstName)) {
                unknownCount++;
            }
        }
        
        if (unknownCount === 0) {
            console.log(`   ✓ All track names match model bones`);
            return;
        }
        
        console.log(`🔧 Remapping "${clipName}": ${unknownCount}/${clip.tracks.length} unknown`);
        
        const sampleName = clip.tracks[0].name;
        const parts = sampleName.split('.');
        
        if (parts.length >= 3) {
            if (!this.boneNames.has(parts[0])) {
                clip.tracks = clip.tracks.map(track => {
                    const trackParts = track.name.split('.');
                    if (trackParts.length >= 3 && !this.boneNames.has(trackParts[0])) {
                        trackParts.shift();
                    }
                    track.name = trackParts.join('.');
                    return track;
                });
            }
        } else if (parts.length === 2 && !this.boneNames.has(parts[0])) {
            if (this.rootBoneName) {
                clip.tracks = clip.tracks.map(track => {
                    const trackParts = track.name.split('.');
                    if (trackParts.length >= 2 && !this.boneNames.has(trackParts[0])) {
                        trackParts[0] = this.rootBoneName;
                    }
                    track.name = trackParts.join('.');
                    return track;
                });
            }
        }
    }

    play(name: string, fadeDuration: number = 0.2) {
        if (this.currentAnimName === name) return;

        const newAction = this.actions.get(name);
        if (!newAction) {
            console.warn(`⚠️ Action "${name}" not found! Available:`, Array.from(this.actions.keys()));
            if (name !== 'idle') {
                this.play('idle', fadeDuration);
            }
            return;
        }

        console.log(`🎭 Switch: ${this.currentAnimName || 'none'} → ${name}`);
        
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