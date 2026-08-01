// src/features/game/core/SoundManager.ts
const FOOTSTEP_NAMES = ["footstep-1", "footstep-2", "footstep-3", "footstep-4"];

export class SoundManager {
  private static instance: SoundManager | null = null;

  private audioContext: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private masterVolume = 0.6;

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private ensureContext(): AudioContext | null {
    if (this.audioContext) return this.audioContext;
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.audioContext = new Ctor();
    return this.audioContext;
  }

  resume() {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => { });
    }
  }

  setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  private async loadSound(name: string, url: string, retries = 2): Promise<boolean> {
    const ctx = this.ensureContext();
    if (!ctx) return false;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(name, audioBuffer);
        return true;
      } catch (error) {
        if (attempt === retries) {
          console.warn(`[SoundManager] Sound "${name}" failed to load`, error);
          return false;
        }
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    return false;
  }

  async loadCritical(): Promise<{ success: boolean; failed: string[] }> {
    const tasks: [string, string][] = [
      ["footstep-1", "/sounds/sfx/footstep-1.ogg"],
      ["footstep-2", "/sounds/sfx/footstep-2.ogg"],
      ["footstep-3", "/sounds/sfx/footstep-3.ogg"],
      ["footstep-4", "/sounds/sfx/footstep-4.ogg"],
      ["shoot", "/sounds/sfx/shoot.ogg"],
      ["hitmarker", "/sounds/sfx/hitmarker.ogg"],
      ["damage-taken", "/sounds/sfx/damage-taken.ogg"],
    ];

    const results = await Promise.all(tasks.map(([name, url]) => this.loadSound(name, url)));
    const failed = tasks.filter((_, i) => !results[i]).map(([name]) => name);
    return { success: true, failed };
  }

  loadLazy() {
    this.loadSound("modal-open", "/sounds/sfx/modal-open.ogg");
  }

  play(name: string, opts?: { volume?: number }) {
    const ctx = this.audioContext;
    const buffer = this.buffers.get(name);
    if (!ctx || !buffer) return;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = this.masterVolume * (opts?.volume ?? 1);
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
    } catch (error) {
      console.warn(`[SoundManager] Failed to play "${name}"`, error);
    }
  }

  playFootstep() {
    const name = FOOTSTEP_NAMES[Math.floor(Math.random() * FOOTSTEP_NAMES.length)];
    this.play(name, { volume: 0.5 });
  }
}
