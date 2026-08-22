// src/features/game/entities/CharacterAnimator.ts
import * as THREE from "three";

export class CharacterAnimator {
    private mixer: THREE.AnimationMixer | null = null;
    private animations: Map<string, THREE.AnimationAction> = new Map();
    private currentKey: string = '';

    setup(root: THREE.Object3D, clips: THREE.AnimationClip[] | undefined) {
        this.mixer = new THREE.AnimationMixer(root);

        for (const clip of clips ?? []) {
            const action = this.mixer.clipAction(clip);
            action.setEffectiveTimeScale(1);
            action.setEffectiveWeight(1);

            const key = clip.name.toLowerCase();
            if (key === 'jump' || key === 'rifle-jump' || key === 'death' || key === 'rifle-death') {
                action.setLoop(THREE.LoopOnce, 1);
                action.clampWhenFinished = true;
            }

            this.animations.set(key, action);
        }
    }

    play(name: string, armed: boolean = false) {
        const armedKey = `rifle-${name}`;
        let key = armed && this.animations.has(armedKey) ? armedKey : name;

        // A name the model does not carry would otherwise freeze the character
        // on whatever was playing before.
        if (!this.animations.has(key)) {
            const base = name.replace(/-firing$/, "");
            const armedBase = `rifle-${base}`;
            key = armed && this.animations.has(armedBase) ? armedBase
                : this.animations.has(base) ? base
                : key;
        }

        if (this.currentKey === key) return;

        const nextAction = this.animations.get(key);
        const currentAction = this.animations.get(this.currentKey);

        if (nextAction) {
            if (currentAction) {
                currentAction.fadeOut(0.2);
            }
            nextAction.reset().fadeIn(0.2).play();
            this.currentKey = key;
        }
    }

    getCurrentKey(): string {
        return this.currentKey;
    }

    listKeys(): string[] {
        const keys: string[] = [];
        this.animations.forEach((_action, key) => keys.push(key));
        return keys;
    }

    getPhase(): number {
        const action = this.animations.get(this.currentKey);
        if (!action) return -1;

        const duration = action.getClip().duration;
        if (duration <= 0) return -1;

        return (action.time % duration) / duration;
    }

    update(delta: number) {
        this.mixer?.update(delta);
    }
}
