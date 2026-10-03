// src/features/game/world/locations/showcase/scene/SceneVoice.ts
import { SoundManager, type SoundHandle } from "../../../../core/SoundManager";
import type { SceneLineState } from "./SceneTimeline";

interface ManifestEntry {
    speaker: string;
    actor?: string;
    text: string;
    file: string;
} 

// A jump larger than this is a scrub rather than the clock ticking on, so the line is
// restarted at the new point instead of left playing from where it was.
const SEEK_TOLERANCE = 0.3;

export function voiceLineKey(line: { speaker: string; actor?: string; text: string }): string {
    return `${line.actor ?? line.speaker}|${line.text}`;
}

// Voice for an authored scene. The clips are generated offline by
// `scripts/gen-voice-lines.mjs` and shipped as assets, so nothing is synthesised at
// runtime and a looping scene costs nothing to keep talking.
export class SceneVoice {
    private readonly keyByLine = new Map<string, string>();
    private handle: SoundHandle | null = null;
    private currentKey: string | null = null;
    private lastInto = 0;
    private ready = false;
    private disposed = false;

    constructor(private readonly sceneId: string) { }

    public async preload(): Promise<void> {
        const base = `/audio/voice/${this.sceneId}`;

        const manifest = await fetch(`${base}/manifest.json`)
            .then((response) => (response.ok ? response.json() : null))
            .catch(() => null);

        if (!Array.isArray(manifest) || this.disposed) return;

        const sound = SoundManager.getInstance();

        await Promise.all((manifest as ManifestEntry[]).map(async (entry) => {
            if (typeof entry?.file !== "string" || typeof entry?.text !== "string") return;

            const key = `voice:${this.sceneId}:${entry.file}`;
            if (await sound.loadClipInto(key, `${base}/${entry.file}`)) {
                this.keyByLine.set(voiceLineKey(entry), key);
            }
        }));

        if (!this.disposed) this.ready = true;
    }

    public update(line: SceneLineState | null, into: number, paused: boolean): void {
        if (!this.ready) return;

        // A held frame is silent: the scene director pauses to compose a shot, and a
        // voice running on under a frozen picture would be worse than nothing.
        if (line === null || paused) {
            this.stop();
            return;
        }

        const key = this.keyByLine.get(voiceLineKey(line)) ?? null;
        if (key === null) {
            this.stop();
            return;
        }

        const jumped = Math.abs(into - this.lastInto) > SEEK_TOLERANCE;
        this.lastInto = into;

        if (key === this.currentKey && !jumped) return;

        // One voice channel on purpose: starting the next line cuts the previous one, so
        // a clip that outruns its beat can never bleed into the line after it.
        this.stop();
        this.currentKey = key;
        this.handle = SoundManager.getInstance().playClipFrom(key, into, {
            volume: line.chorus === true ? 1 : 0.85,
        });
    }

    public stop(): void {
        this.handle?.stop(0.05);
        this.handle = null;
        this.currentKey = null;
    }

    public dispose(): void {
        this.disposed = true;
        this.ready = false;
        this.stop();
        this.keyByLine.clear();
    }
}
