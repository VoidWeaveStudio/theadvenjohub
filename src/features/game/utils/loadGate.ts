// src/features/game/utils/loadGate.ts

export class LoadGate {
    private resolver: (() => void) | null = null;
    private opened = false;

    public readonly promise: Promise<void>;

    constructor() {
        this.promise = new Promise<void>((resolve) => {
            this.resolver = resolve;
        });
    }

    get settled(): boolean {
        return this.opened;
    }

    open() {
        if (this.opened) return;
        this.opened = true;
        this.resolver?.();
        this.resolver = null;
    }
}

export function withTimeout(promise: Promise<unknown>, timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            resolve();
        };

        const timer = setTimeout(finish, timeoutMs);
        promise
            .catch(() => undefined)
            .finally(() => {
                clearTimeout(timer);
                finish();
            });
    });
}

export function waitForFrames(count: number): Promise<void> {
    return new Promise<void>((resolve) => {
        let left = Math.max(1, count);
        const step = () => {
            left--;
            if (left <= 0) {
                resolve();
                return;
            }
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    });
}
