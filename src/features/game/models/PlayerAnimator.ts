//src\features\game\models\PlayerAnimator.ts
import * as THREE from 'three';
import { PlayerModelLoader } from './PlayerModelLoader';

export class PlayerAnimator {
    private mixer: THREE.AnimationMixer;
    private actions: Map<string, THREE.AnimationAction> = new Map();
    private currentAction: THREE.AnimationAction | null = null;
    private currentAnimName: string = '';

    constructor(private model: THREE.Group) {
        this.mixer = new THREE.AnimationMixer(model);
        console.log(`🎬 Mixer created for model`);

        const animations = PlayerModelLoader.getAllAnimations();
        console.log(`🎬 Creating animator with ${Object.keys(animations).length} animations`);
        
        for (const [name, clip] of Object.entries(animations)) {
            if (!clip) {
                console.warn(`⚠️ Clip "${name}" is null, skipping`);
                continue;
            }
            
            try {
                const action = this.mixer.clipAction(clip);
                
                if (name === 'death') {
                    action.loop = THREE.LoopOnce;
                    action.clampWhenFinished = true;
                } else {
                    action.loop = THREE.LoopRepeat;
                }
                
                action.setEffectiveWeight(1);
                action.setEffectiveTimeScale(1);
                
                this.actions.set(name, action);
                console.log(`✅ Action "${name}" created, loop: ${name === 'death' ? 'once' : 'repeat'}`);
            } catch (err) {
                console.warn(`⚠️ Failed to create action for "${name}":`, err);
            }
        }
        
        console.log('🎬 Starting idle animation...');
        this.play('idle', 0);
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

        console.log(`🎭 Switching animation: ${this.currentAnimName || 'none'} → ${name}`);
        
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