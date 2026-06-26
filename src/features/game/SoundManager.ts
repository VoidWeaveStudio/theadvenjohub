//src\features\game\SoundManager.ts
export class SoundManager {
    private audioContext: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private enabled: boolean = true;

    constructor() {
        if (typeof window !== 'undefined') {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.3; 
            this.masterGain.connect(this.audioContext.destination);
        }
    }

    private ensureContext() {
        if (this.audioContext?.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    playShoot() {
        if (!this.enabled || !this.audioContext || !this.masterGain) return;
        this.ensureContext();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const bufferSize = ctx.sampleRate * 0.1; 
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1500;
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.1);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
        noise.stop(now + 0.1);
    }

    playHit() {
        if (!this.enabled || !this.audioContext || !this.masterGain) return;
        this.ensureContext();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.05);
    }

    playDeath() {
        if (!this.enabled || !this.audioContext || !this.masterGain) return;
        this.ensureContext();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.4);
    }

    playReload() {
        if (!this.enabled || !this.audioContext || !this.masterGain) return;
        this.ensureContext();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const playClick = (time: number) => {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 600;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.2, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.03);

            osc.connect(gain);
            gain.connect(this.masterGain!);

            osc.start(time);
            osc.stop(time + 0.03);
        };

        playClick(now);
        playClick(now + 0.15);
    }

    playFootstep() {
        if (!this.enabled || !this.audioContext || !this.masterGain) return;
        this.ensureContext();

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const bufferSize = ctx.sampleRate * 0.05;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        const gain = ctx.createGain();
        gain.gain.value = 0.15;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled;
    }

    dispose() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}