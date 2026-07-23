// src/features/game/systems/System.ts
export abstract class System {
    abstract init(...args: any[]): void;
    abstract update(delta: number, ...args: any[]): void;
    abstract dispose(): void;
}