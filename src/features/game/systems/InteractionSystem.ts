// src/features/game/systems/InteractionSystem.ts
import * as THREE from "three";
import { System } from "./System";
import { Player } from "../entities/Player";
import { InputManager } from "../core/InputManager";
import { SafeZone } from "../world/SafeZone";

export class InteractionSystem extends System {
    private scene!: THREE.Scene;
    private player!: Player;
    private inputManager!: InputManager;
    private safeZone!: SafeZone;
    private interactableObjects: THREE.Object3D[] = [];

    private interactionRadius: number = 5;

    public onNotification?: (msg: string, duration?: number) => void;
    public onPrompt?: (text: string | null) => void;
    public onCrystalInteract?: () => void;

    public setScene(scene: THREE.Scene) {
        this.scene = scene;
    }

    public clearInteractables() {
        this.interactableObjects = [];
    }

    init(scene: THREE.Scene, player: Player, inputManager: InputManager, safeZone: SafeZone) {
        this.scene = scene;
        this.player = player;
        this.inputManager = inputManager;
        this.safeZone = safeZone;
    }

    registerInteractable(obj: THREE.Object3D) {
        this.interactableObjects.push(obj);
    }

    update(_delta: number, isEJustPressed?: boolean) {
        const playerPos = this.player.mesh.position;
        let nearest: { obj: THREE.Object3D; dist: number } | null = null;

        for (const obj of this.interactableObjects) {
            const d = playerPos.distanceTo(obj.position);
            if (d < this.interactionRadius && (!nearest || d < nearest.dist)) {
                nearest = { obj, dist: d };
            }
        }

        if (nearest) {
            const id = nearest.obj.userData.interactionId;
            
            if (id === "tower-crystal") {
                this.onPrompt?.("[E] Use the elevator");
                if (isEJustPressed === true) {
                    if (this.onCrystalInteract) {
                        this.onCrystalInteract();
                    } else {
                        console.error("❌ [InteractionSystem] onCrystalInteract is UNDEFINED in Game.ts!");
                    }
                }
            } else if (id === "crystal") {
                this.onPrompt?.("[E] Interact with Crystal");
                if (isEJustPressed === true) {
                    this.onNotification?.("⚡ Events coming soon!", 3000);
                }
            }
        } else {
            this.onPrompt?.(null);
        }
    }

    dispose() { }
}