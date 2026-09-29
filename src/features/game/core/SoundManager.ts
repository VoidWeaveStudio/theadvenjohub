// src/features/game/core/SoundManager.ts
import { renderProceduralSfx } from "./proceduralSfx";

const OCEAN_WAVE_NAMES = ["ambient-ocean-1", "ambient-ocean-2", "ambient-ocean-3", "ambient-ocean-4"];
const FOOTSTEP_NAMES = ["footstep-1", "footstep-2", "footstep-3"];
const STONE_FOOTSTEP_NAMES = ["footstep-stone-1", "footstep-stone-2"];
const WOOD_FOOTSTEP_NAMES = ["footstep-wood-1", "footstep-wood-2", "footstep-wood-3"];
const SAND_FOOTSTEP_NAMES = ["footstep-sand-1", "footstep-sand-2"];
const HEARING_RANGE = 46;

const MUTED_SOUNDS = new Set([
    "jump",
    "land",
    "land-heavy",
    "splash",
    "portal-enter",
    "modal-open",
    "ui-close",
    "ui-tab",
]);

export type FootstepSurface = "soft" | "stone" | "wood" | "sand";

export interface PlayOptions {
    volume?: number;
    rate?: number;
    delay?: number;
    offset?: number;
}

export interface SpatialOptions extends PlayOptions {
    x: number;
    z: number;
    maxDistance?: number;
}

export interface SoundHandle {
    stop: (fadeSeconds?: number) => void;
    setVolume?: (volume: number, fadeSeconds?: number) => void;
}

export class SoundManager {
  private static instance: SoundManager | null = null;

  private audioContext: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private masterVolume = 0.6;

  private listenerX = 0;
  private listenerZ = 0;
  private listenerForwardX = 0;
  private listenerForwardZ = -1;

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

  private async loadSound(name: string, extension: string): Promise<boolean> {
    const ctx = this.ensureContext();
    if (!ctx) return false;

    try {
      const response = await fetch(`/sounds/sfx/${name}.${extension}`);
      if (!response.ok) return false;
      const arrayBuffer = await response.arrayBuffer();
      this.buffers.set(name, await ctx.decodeAudioData(arrayBuffer));
      return true;
    } catch {
      return false;
    }
  }

  async loadCritical(): Promise<{ success: boolean; failed: string[] }> {
    const generated = await this.initProcedural();
    return { success: generated > 0, failed: [] };
  }

  async loadLazy(): Promise<string[]> {
    const manifest = await this.loadManifest();
    if (!manifest) return [];

    const results = await Promise.all(
      Object.entries(manifest).map(async ([name, extension]) => ({
        name,
        loaded: await this.loadSound(name, extension),
      }))
    );

    return results.filter((entry) => entry.loaded).map((entry) => entry.name);
  }

  private async loadManifest(): Promise<Record<string, string> | null> {
    try {
      const response = await fetch("/sounds/sfx/manifest.json");
      if (!response.ok) return null;
      const parsed = await response.json();
      return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : null;
    } catch {
      return null;
    }
  }

  async initProcedural(): Promise<number> {
    const ctx = this.ensureContext();
    if (!ctx) return 0;

    const rendered = await renderProceduralSfx(ctx.sampleRate);

    for (const [name, buffer] of rendered) {
      if (this.buffers.has(name)) continue;
      this.buffers.set(name, buffer);
    }

    return rendered.size;
  }

  setListener(x: number, z: number, forwardX: number, forwardZ: number) {
    this.listenerX = x;
    this.listenerZ = z;
    this.listenerForwardX = forwardX;
    this.listenerForwardZ = forwardZ;
  }

  private start(name: string, opts: PlayOptions, gainValue: number, pan: number, loop: boolean): SoundHandle | null {
    if (MUTED_SOUNDS.has(name)) return null;

    const buffer = this.buffers.get(name);
    if (!buffer) return null;

    return this.startBuffer(buffer, opts, gainValue, pan, loop);
  }

  private startBuffer(buffer: AudioBuffer, opts: PlayOptions, gainValue: number, pan: number, loop: boolean): SoundHandle | null {
    const ctx = this.audioContext;
    if (!ctx || gainValue <= 0.0005) return null;
    if (ctx.state !== "running") return null;

    const offset = Math.max(0, opts.offset ?? 0);
    if (!loop && offset >= buffer.duration - 0.02) return null;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;
      if (opts.rate) source.playbackRate.value = opts.rate;

      const gain = ctx.createGain();
      gain.gain.value = gainValue;

      let tail: AudioNode = gain;
      source.connect(gain);

      if (pan !== 0 && typeof ctx.createStereoPanner === "function") {
        const panner = ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        gain.connect(panner);
        tail = panner;
      }

      tail.connect(ctx.destination);
      source.start(ctx.currentTime + (opts.delay ?? 0), offset);

      return {
        setVolume: (volume: number, fadeSeconds = 0.4) => {
          try {
            const now = ctx.currentTime;
            const target = Math.max(0.0001, this.masterVolume * volume);
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
            gain.gain.linearRampToValueAtTime(target, now + Math.max(0.01, fadeSeconds));
          } catch {
            /* node already released */
          }
        },
        stop: (fadeSeconds = 0.08) => {
          try {
            const now = ctx.currentTime;
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.01, fadeSeconds));
            source.stop(now + Math.max(0.02, fadeSeconds) + 0.02);
          } catch {
            /* already stopped */
          }
        },
      };
    } catch (error) {
      console.warn("[SoundManager] Failed to play clip", error);
      return null;
    }
  }

  hasClip(key: string): boolean {
    return this.buffers.has(key);
  }

  // Voice lines are generated ahead of time and live outside the sfx bank's own
  // folder, so they are fetched by url and parked in the same bank under their own key.
  async loadClipInto(key: string, url: string): Promise<boolean> {
    if (this.buffers.has(key)) return true;

    const ctx = this.ensureContext();
    if (!ctx) return false;

    try {
      const response = await fetch(url);
      if (!response.ok) return false;
      this.buffers.set(key, await ctx.decodeAudioData(await response.arrayBuffer()));
      return true;
    } catch {
      return false;
    }
  }

  // Starts a loaded clip part-way in, which is what a scene being scrubbed needs: the
  // line has to come in at the same point the timeline is sitting at.
  playClipFrom(key: string, offset: number, opts?: PlayOptions): SoundHandle | null {
    return this.start(key, { ...opts, offset }, this.masterVolume * (opts?.volume ?? 1), 0, false);
  }

  // The news anchor's voice is synthesised per bulletin instead of living in the
  // preloaded bank, so it is decoded on arrival. The clip's real length goes back to
  // the caller, which is what keeps the caption and the mouth in step with it.
  async playClip(bytes: ArrayBuffer, opts?: PlayOptions): Promise<number> {
    const ctx = this.ensureContext();
    if (!ctx) return 0;
    this.resume();

    try {
      const buffer = await ctx.decodeAudioData(bytes);
      this.startBuffer(buffer, opts ?? {}, this.masterVolume * (opts?.volume ?? 1), 0, false);
      return buffer.duration;
    } catch (error) {
      console.warn("[SoundManager] Failed to decode clip", error);
      return 0;
    }
  }

  play(name: string, opts?: PlayOptions) {
    this.start(name, opts ?? {}, this.masterVolume * (opts?.volume ?? 1), 0, false);
  }

  playAt(name: string, opts: SpatialOptions) {
    const dx = opts.x - this.listenerX;
    const dz = opts.z - this.listenerZ;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const maxDistance = opts.maxDistance ?? HEARING_RANGE;

    if (distance >= maxDistance) return;

    const falloff = Math.pow(1 - distance / maxDistance, 1.8);
    const rightX = -this.listenerForwardZ;
    const rightZ = this.listenerForwardX;
    const pan = distance > 0.5 ? ((dx * rightX + dz * rightZ) / distance) * 0.85 : 0;

    this.start(name, opts, this.masterVolume * (opts.volume ?? 1) * falloff, pan, false);
  }

  playLoop(name: string, opts?: PlayOptions): SoundHandle | null {
    return this.start(name, opts ?? {}, this.masterVolume * (opts?.volume ?? 1), 0, true);
  }

  playOceanWave(volume: number) {
    const name = OCEAN_WAVE_NAMES[Math.floor(Math.random() * OCEAN_WAVE_NAMES.length)];
    if (!this.buffers.has(name)) return;
    this.start(name, { rate: 0.88 + Math.random() * 0.24 }, this.masterVolume * volume, (Math.random() - 0.5) * 0.7, false);
  }

  playFootstep(surface: FootstepSurface = "soft") {
    const pool = surface === "stone"
      ? STONE_FOOTSTEP_NAMES
      : surface === "wood"
        ? WOOD_FOOTSTEP_NAMES
        : surface === "sand"
          ? SAND_FOOTSTEP_NAMES
          : FOOTSTEP_NAMES;
    const name = pool[Math.floor(Math.random() * pool.length)];
    this.play(name, { volume: 0.5, rate: 0.92 + Math.random() * 0.16 });
  }
}
