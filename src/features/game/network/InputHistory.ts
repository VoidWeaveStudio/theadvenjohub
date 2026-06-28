//src\features\game\network\InputHistory.ts
import * as THREE from 'three';

export interface PlayerInput {
    sequenceNumber: number;
    time: number;
    moveDirection: THREE.Vector3;  
    jump: boolean;
}

export class InputHistory {
    private history: PlayerInput[] = [];
    private sequenceCounter: number = 0;
    private readonly MAX_HISTORY = 100;

    addInput(moveDirection: THREE.Vector3, jump: boolean): number {
        const seq = ++this.sequenceCounter;
        this.history.push({
            sequenceNumber: seq,
            time: Date.now(),
            moveDirection: moveDirection.clone(),
            jump
        });

        while (this.history.length > this.MAX_HISTORY) {
            this.history.shift();
        }

        return seq;
    }

    getInputsAfter(serverTime: number): PlayerInput[] {
        return this.history.filter(input => input.time > serverTime);
    }

    removeBefore(serverTime: number) {
        this.history = this.history.filter(input => input.time > serverTime);
    }

    getLastSequence(): number {
        return this.sequenceCounter;
    }

    clear() {
        this.history = [];
        this.sequenceCounter = 0;
    }
}