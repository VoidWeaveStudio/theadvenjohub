// src/features/game/core/proceduralSfx.ts
type Recipe = (context: OfflineAudioContext) => void;

interface SoundSpec {
    duration: number;
    build: Recipe;
}

function noiseBuffer(context: OfflineAudioContext, duration: number, seed: number): AudioBuffer {
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);

    let state = seed || 1;
    for (let i = 0; i < length; i++) {
        state = (state * 1664525 + 1013904223) % 4294967296;
        data[i] = (state / 2147483648) - 1;
    }

    return buffer;
}

function envelope(
    context: OfflineAudioContext,
    peak: number,
    attack: number,
    decay: number,
    start = 0
): GainNode {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
    return gain;
}

function noiseVoice(
    context: OfflineAudioContext,
    options: {
        duration: number;
        seed: number;
        peak: number;
        attack: number;
        decay: number;
        type: BiquadFilterType;
        frequency: number;
        endFrequency?: number;
        q?: number;
        start?: number;
    }
) {
    const start = options.start ?? 0;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(context, options.duration, options.seed);

    const filter = context.createBiquadFilter();
    filter.type = options.type;
    filter.Q.value = options.q ?? 1;
    filter.frequency.setValueAtTime(options.frequency, start);
    if (options.endFrequency !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(
            Math.max(20, options.endFrequency),
            start + options.duration
        );
    }

    const gain = envelope(context, options.peak, options.attack, options.decay, start);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(start);
}

function toneVoice(
    context: OfflineAudioContext,
    options: {
        type: OscillatorType;
        frequency: number;
        endFrequency?: number;
        peak: number;
        attack: number;
        decay: number;
        start?: number;
        detune?: number;
    }
) {
    const start = options.start ?? 0;
    const oscillator = context.createOscillator();
    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.frequency, start);
    if (options.detune) oscillator.detune.value = options.detune;
    if (options.endFrequency !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(20, options.endFrequency),
            start + options.attack + options.decay
        );
    }

    const gain = envelope(context, options.peak, options.attack, options.decay, start);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + options.attack + options.decay + 0.02);
}

function footstep(seed: number): SoundSpec {
    return {
        duration: 0.26,
        build: (context) => {
            noiseVoice(context, {
                duration: 0.2, seed, peak: 0.5, attack: 0.004, decay: 0.1,
                type: "bandpass", frequency: 900 + (seed % 5) * 90, endFrequency: 320, q: 1.1,
            });
            noiseVoice(context, {
                duration: 0.24, seed: seed + 31, peak: 0.22, attack: 0.006, decay: 0.18,
                type: "lowpass", frequency: 260, q: 0.7,
            });
            toneVoice(context, {
                type: "sine", frequency: 108, endFrequency: 62, peak: 0.3, attack: 0.005, decay: 0.09,
            });
        },
    };
}

const SPECS: Record<string, SoundSpec> = {
    "footstep-1": footstep(101),
    "footstep-2": footstep(211),
    "footstep-3": footstep(337),
    "footstep-4": footstep(449),

    "footstep-stone-1": {
        duration: 0.3,
        build: (context) => {
            noiseVoice(context, { duration: 0.26, seed: 77, peak: 0.46, attack: 0.003, decay: 0.11, type: "bandpass", frequency: 1900, endFrequency: 640, q: 2.2 });
            noiseVoice(context, { duration: 0.3, seed: 91, peak: 0.16, attack: 0.02, decay: 0.26, type: "lowpass", frequency: 520, q: 0.6 });
        },
    },
    "footstep-stone-2": {
        duration: 0.3,
        build: (context) => {
            noiseVoice(context, { duration: 0.26, seed: 143, peak: 0.44, attack: 0.003, decay: 0.13, type: "bandpass", frequency: 1500, endFrequency: 520, q: 2 });
            noiseVoice(context, { duration: 0.3, seed: 167, peak: 0.15, attack: 0.025, decay: 0.24, type: "lowpass", frequency: 460, q: 0.6 });
        },
    },

    shoot: {
        duration: 0.34,
        build: (context) => {
            noiseVoice(context, { duration: 0.16, seed: 523, peak: 0.85, attack: 0.001, decay: 0.09, type: "highpass", frequency: 1400, q: 0.8 });
            noiseVoice(context, { duration: 0.3, seed: 601, peak: 0.4, attack: 0.002, decay: 0.24, type: "lowpass", frequency: 900, endFrequency: 180, q: 1.4 });
            toneVoice(context, { type: "sawtooth", frequency: 220, endFrequency: 48, peak: 0.5, attack: 0.002, decay: 0.14 });
        },
    },

    hitmarker: {
        duration: 0.14,
        build: (context) => {
            toneVoice(context, { type: "square", frequency: 1750, peak: 0.24, attack: 0.001, decay: 0.05 });
            toneVoice(context, { type: "square", frequency: 2450, peak: 0.18, attack: 0.001, decay: 0.06, start: 0.035 });
        },
    },

    "damage-taken": {
        duration: 0.5,
        build: (context) => {
            toneVoice(context, { type: "sine", frequency: 165, endFrequency: 52, peak: 0.7, attack: 0.004, decay: 0.3 });
            noiseVoice(context, { duration: 0.4, seed: 733, peak: 0.34, attack: 0.002, decay: 0.3, type: "lowpass", frequency: 780, endFrequency: 160, q: 1 });
        },
    },

    "enemy-hit": {
        duration: 0.26,
        build: (context) => {
            noiseVoice(context, { duration: 0.22, seed: 811, peak: 0.5, attack: 0.002, decay: 0.16, type: "bandpass", frequency: 720, endFrequency: 240, q: 1.6 });
            toneVoice(context, { type: "triangle", frequency: 300, endFrequency: 120, peak: 0.3, attack: 0.002, decay: 0.12 });
        },
    },

    "enemy-death": {
        duration: 0.8,
        build: (context) => {
            noiseVoice(context, { duration: 0.7, seed: 907, peak: 0.55, attack: 0.006, decay: 0.6, type: "lowpass", frequency: 1400, endFrequency: 130, q: 1.2 });
            toneVoice(context, { type: "sine", frequency: 260, endFrequency: 46, peak: 0.45, attack: 0.01, decay: 0.5 });
            toneVoice(context, { type: "triangle", frequency: 520, endFrequency: 90, peak: 0.2, attack: 0.02, decay: 0.42, start: 0.05 });
        },
    },

    "slime-hop": {
        duration: 0.3,
        build: (context) => {
            toneVoice(context, { type: "sine", frequency: 420, endFrequency: 140, peak: 0.3, attack: 0.006, decay: 0.16 });
            noiseVoice(context, { duration: 0.24, seed: 1013, peak: 0.22, attack: 0.004, decay: 0.18, type: "lowpass", frequency: 620, endFrequency: 200, q: 0.9 });
        },
    },

    "slime-attack": {
        duration: 0.42,
        build: (context) => {
            noiseVoice(context, { duration: 0.34, seed: 1117, peak: 0.6, attack: 0.004, decay: 0.24, type: "bandpass", frequency: 380, endFrequency: 1500, q: 1.1 });
            toneVoice(context, { type: "sawtooth", frequency: 140, endFrequency: 380, peak: 0.32, attack: 0.03, decay: 0.2 });
        },
    },

    "boss-cast": {
        duration: 1.3,
        build: (context) => {
            toneVoice(context, { type: "sawtooth", frequency: 70, endFrequency: 330, peak: 0.42, attack: 0.5, decay: 0.7 });
            toneVoice(context, { type: "sine", frequency: 105, endFrequency: 495, peak: 0.26, attack: 0.55, decay: 0.65, detune: 8 });
            noiseVoice(context, { duration: 1.2, seed: 1223, peak: 0.24, attack: 0.6, decay: 0.6, type: "bandpass", frequency: 300, endFrequency: 2600, q: 3.2 });
        },
    },

    "boss-launch": {
        duration: 0.44,
        build: (context) => {
            noiseVoice(context, { duration: 0.36, seed: 1301, peak: 0.7, attack: 0.003, decay: 0.26, type: "bandpass", frequency: 1600, endFrequency: 340, q: 1.4 });
            toneVoice(context, { type: "sawtooth", frequency: 300, endFrequency: 70, peak: 0.4, attack: 0.004, decay: 0.2 });
        },
    },

    "boss-impact": {
        duration: 0.7,
        build: (context) => {
            noiseVoice(context, { duration: 0.6, seed: 1409, peak: 0.75, attack: 0.002, decay: 0.44, type: "lowpass", frequency: 1800, endFrequency: 150, q: 1.1 });
            toneVoice(context, { type: "sine", frequency: 120, endFrequency: 38, peak: 0.6, attack: 0.004, decay: 0.4 });
            noiseVoice(context, { duration: 0.5, seed: 1489, peak: 0.28, attack: 0.05, decay: 0.4, type: "highpass", frequency: 2400, q: 0.7 });
        },
    },

    "acid-pool": {
        duration: 1.6,
        build: (context) => {
            noiseVoice(context, { duration: 1.5, seed: 1543, peak: 0.3, attack: 0.2, decay: 1.2, type: "bandpass", frequency: 3200, q: 0.9 });
            noiseVoice(context, { duration: 1.5, seed: 1601, peak: 0.16, attack: 0.3, decay: 1.1, type: "highpass", frequency: 5200, q: 0.6 });
        },
    },

    "chest-open": {
        duration: 1.5,
        build: (context) => {
            noiseVoice(context, { duration: 0.5, seed: 1709, peak: 0.4, attack: 0.02, decay: 0.42, type: "bandpass", frequency: 420, endFrequency: 1100, q: 4.5 });
            toneVoice(context, { type: "triangle", frequency: 180, endFrequency: 96, peak: 0.34, attack: 0.01, decay: 0.3, start: 0.02 });
            toneVoice(context, { type: "sine", frequency: 880, peak: 0.2, attack: 0.02, decay: 0.5, start: 0.5 });
            toneVoice(context, { type: "sine", frequency: 1320, peak: 0.18, attack: 0.02, decay: 0.55, start: 0.62 });
            toneVoice(context, { type: "sine", frequency: 1760, peak: 0.15, attack: 0.03, decay: 0.6, start: 0.74 });
        },
    },

    "secret-door": {
        duration: 2.2,
        build: (context) => {
            noiseVoice(context, { duration: 2, seed: 1811, peak: 0.6, attack: 0.15, decay: 1.7, type: "lowpass", frequency: 420, endFrequency: 120, q: 1.3 });
            noiseVoice(context, { duration: 1.8, seed: 1877, peak: 0.3, attack: 0.2, decay: 1.5, type: "bandpass", frequency: 900, endFrequency: 260, q: 2.6 });
            toneVoice(context, { type: "sine", frequency: 58, endFrequency: 32, peak: 0.5, attack: 0.25, decay: 1.6 });
        },
    },

    "loot-pickup": {
        duration: 0.45,
        build: (context) => {
            toneVoice(context, { type: "sine", frequency: 1100, peak: 0.24, attack: 0.004, decay: 0.16 });
            toneVoice(context, { type: "sine", frequency: 1650, peak: 0.2, attack: 0.004, decay: 0.22, start: 0.07 });
        },
    },

    "portal-enter": {
        duration: 1.4,
        build: (context) => {
            noiseVoice(context, { duration: 1.3, seed: 1973, peak: 0.42, attack: 0.35, decay: 0.9, type: "bandpass", frequency: 400, endFrequency: 4200, q: 1.8 });
            toneVoice(context, { type: "sine", frequency: 220, endFrequency: 1320, peak: 0.3, attack: 0.4, decay: 0.8 });
            toneVoice(context, { type: "triangle", frequency: 330, endFrequency: 1980, peak: 0.18, attack: 0.45, decay: 0.75, detune: -6 });
        },
    },

    jump: {
        duration: 0.3,
        build: (context) => {
            toneVoice(context, { type: "sine", frequency: 260, endFrequency: 520, peak: 0.32, attack: 0.008, decay: 0.16 });
            noiseVoice(context, { duration: 0.22, seed: 2027, peak: 0.22, attack: 0.004, decay: 0.16, type: "bandpass", frequency: 800, q: 1 });
        },
    },

    land: {
        duration: 0.36,
        build: (context) => {
            toneVoice(context, { type: "sine", frequency: 150, endFrequency: 54, peak: 0.5, attack: 0.004, decay: 0.2 });
            noiseVoice(context, { duration: 0.3, seed: 2111, peak: 0.4, attack: 0.002, decay: 0.2, type: "lowpass", frequency: 700, endFrequency: 180, q: 1 });
        },
    },

    splash: {
        duration: 0.7,
        build: (context) => {
            noiseVoice(context, { duration: 0.6, seed: 2213, peak: 0.62, attack: 0.004, decay: 0.4, type: "highpass", frequency: 900, q: 0.7 });
            noiseVoice(context, { duration: 0.5, seed: 2287, peak: 0.34, attack: 0.01, decay: 0.42, type: "bandpass", frequency: 1800, endFrequency: 520, q: 1.2 });
            toneVoice(context, { type: "sine", frequency: 320, endFrequency: 120, peak: 0.2, attack: 0.01, decay: 0.24 });
        },
    },

    swim: {
        duration: 0.6,
        build: (context) => {
            noiseVoice(context, { duration: 0.55, seed: 2341, peak: 0.34, attack: 0.06, decay: 0.44, type: "bandpass", frequency: 700, endFrequency: 1600, q: 1 });
        },
    },

    "cave-drip": {
        duration: 0.55,
        build: (context) => {
            toneVoice(context, { type: "sine", frequency: 1500, endFrequency: 620, peak: 0.3, attack: 0.002, decay: 0.1 });
            toneVoice(context, { type: "sine", frequency: 760, endFrequency: 340, peak: 0.16, attack: 0.004, decay: 0.3, start: 0.03 });
        },
    },

    "modal-open": {
        duration: 0.32,
        build: (context) => {
            toneVoice(context, { type: "triangle", frequency: 520, endFrequency: 780, peak: 0.2, attack: 0.008, decay: 0.16 });
            toneVoice(context, { type: "sine", frequency: 1040, peak: 0.12, attack: 0.01, decay: 0.18, start: 0.05 });
        },
    },

    "ui-click": {
        duration: 0.12,
        build: (context) => {
            toneVoice(context, { type: "square", frequency: 900, peak: 0.14, attack: 0.001, decay: 0.05 });
        },
    },

    "ward-groan": {
        duration: 1.5,
        build: (context) => {
            toneVoice(context, { type: "sawtooth", frequency: 84, endFrequency: 58, peak: 0.3, attack: 0.22, decay: 1.1 });
            toneVoice(context, { type: "sine", frequency: 126, endFrequency: 74, peak: 0.16, attack: 0.3, decay: 1, detune: 14 });
            noiseVoice(context, { duration: 1.4, seed: 3121, peak: 0.14, attack: 0.25, decay: 1.05, type: "bandpass", frequency: 420, endFrequency: 180, q: 2.4 });
        },
    },

    "ward-shriek": {
        duration: 0.9,
        build: (context) => {
            toneVoice(context, { type: "sawtooth", frequency: 340, endFrequency: 1240, peak: 0.5, attack: 0.02, decay: 0.5 });
            toneVoice(context, { type: "square", frequency: 510, endFrequency: 1860, peak: 0.2, attack: 0.03, decay: 0.42, detune: 22 });
            noiseVoice(context, { duration: 0.8, seed: 3229, peak: 0.34, attack: 0.01, decay: 0.6, type: "bandpass", frequency: 900, endFrequency: 3200, q: 1.8 });
        },
    },

    "ward-slam": {
        duration: 1.1,
        build: (context) => {
            toneVoice(context, { type: "sine", frequency: 92, endFrequency: 30, peak: 0.8, attack: 0.004, decay: 0.6 });
            noiseVoice(context, { duration: 0.9, seed: 3331, peak: 0.6, attack: 0.002, decay: 0.55, type: "lowpass", frequency: 1400, endFrequency: 110, q: 1 });
            noiseVoice(context, { duration: 0.7, seed: 3413, peak: 0.24, attack: 0.03, decay: 0.6, type: "highpass", frequency: 2200, q: 0.7 });
        },
    },

    "ward-bell": {
        duration: 2.6,
        build: (context) => {
            toneVoice(context, { type: "sine", frequency: 196, peak: 0.5, attack: 0.006, decay: 2.3 });
            toneVoice(context, { type: "sine", frequency: 293, peak: 0.28, attack: 0.008, decay: 1.9, detune: 6 });
            toneVoice(context, { type: "sine", frequency: 522, peak: 0.16, attack: 0.006, decay: 1.2, detune: -8 });
            toneVoice(context, { type: "triangle", frequency: 98, peak: 0.3, attack: 0.02, decay: 2.4 });
            noiseVoice(context, { duration: 0.5, seed: 3517, peak: 0.2, attack: 0.002, decay: 0.35, type: "bandpass", frequency: 2600, q: 2.6 });
        },
    },

    "breach-tear": {
        duration: 2.2,
        build: (context) => {
            noiseVoice(context, { duration: 2.1, seed: 3607, peak: 0.3, attack: 0.5, decay: 1.5, type: "bandpass", frequency: 220, endFrequency: 1500, q: 1.4 });
            toneVoice(context, { type: "sawtooth", frequency: 44, endFrequency: 132, peak: 0.34, attack: 0.7, decay: 1.4 });
            toneVoice(context, { type: "sine", frequency: 660, endFrequency: 180, peak: 0.14, attack: 0.4, decay: 1.6, detune: 18 });
        },
    },

    "ui-error": {
        duration: 0.4,
        build: (context) => {
            toneVoice(context, { type: "square", frequency: 300, peak: 0.18, attack: 0.004, decay: 0.12 });
            toneVoice(context, { type: "square", frequency: 200, peak: 0.18, attack: 0.004, decay: 0.2, start: 0.13 });
        },
    },
};

export const PROCEDURAL_SFX_NAMES = Object.keys(SPECS);

export async function renderProceduralSfx(sampleRate: number): Promise<Map<string, AudioBuffer>> {
    const rendered = new Map<string, AudioBuffer>();

    const OfflineCtor =
        typeof window !== "undefined"
            ? window.OfflineAudioContext ||
            (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext
            : undefined;

    if (!OfflineCtor) return rendered;

    for (const [name, spec] of Object.entries(SPECS)) {
        try {
            const length = Math.max(1, Math.ceil(sampleRate * spec.duration));
            const context = new OfflineCtor(1, length, sampleRate);
            spec.build(context);
            rendered.set(name, await context.startRendering());
        } catch (error) {
            console.warn(`[sfx] failed to render "${name}"`, error);
        }
    }

    return rendered;
}
