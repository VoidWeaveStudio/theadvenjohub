// src/features/game/systems/NetworkSystem.ts
import { System } from "./System";
import { NetworkManager } from "../network/NetworkManager";

export class NetworkSystem extends System {
    private networkManager: NetworkManager;
    private messageQueue: any[] = [];
    private updateInterval: number = 50;
    private lastUpdate: number = 0;

    constructor(networkManager: NetworkManager) {
        super();
        this.networkManager = networkManager;
    }

    init(): void {
    }

    update(delta: number): void {
        const now = performance.now();

        if (now - this.lastUpdate >= this.updateInterval) {
            this.processMessageQueue();
            this.lastUpdate = now;
        }
    }

    queueMessage(message: any): void {
        this.messageQueue.push(message);
    }

    private processMessageQueue(): void {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.networkManager.send(message);
        }
    }

    sendImmediate(message: any): void {
        this.networkManager.send(message);
    }

    dispose(): void {
        this.messageQueue = [];
    }
}