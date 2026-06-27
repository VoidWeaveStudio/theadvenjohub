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
                
                this.actions.set(name, action);
                console.log(`✅ Action "${name}" created, tracks: ${clip.tracks.length}`);
            } catch (err) {
                console.warn(`⚠️ Failed to create action for "${name}":`, err);
            }
        }
    }

    play(name: string, fadeDuration: number = 0.2) {
        if (this.currentAnimName === name) return;

        const newAction = this.actions.get(name);
        if (!newAction) {
            if (name !== 'idle') {
                this.play('idle', fadeDuration);
            }
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

    setSpeed(speed: number) {
        if (this.currentAction) {
            this.currentAction.setEffectiveTimeScale(speed);
        }
    }

    stopAll() {
        this.actions.forEach(action => action.stop());
        this.currentAction = null;
        this.currentAnimName = '';
    }

    getCurrentAnimation(): string {
        return this.currentAnimName;
    }
}