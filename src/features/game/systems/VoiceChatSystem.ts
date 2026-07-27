// src/features/game/systems/VoiceChatSystem.ts
// Push-to-talk voice chat. Records in short, independently-decodable segments
// (rather than one continuous stream) so each network message stays well under
// the server's per-message size cap without needing MediaSource/streaming APIs.
interface PlaybackEntry {
    queue: Blob[];
    playing: boolean;
    audio: HTMLAudioElement | null;
}

export class VoiceChatSystem {
    private stream: MediaStream | null = null;
    private recorder: MediaRecorder | null = null;
    private chunks: BlobPart[] = [];
    private capturing = false;
    private segmentTimer: ReturnType<typeof setTimeout> | null = null;
    private mimeType = "";
    private holdStartedAt = 0;
    private startToken = 0;

    private readonly playbackQueues = new Map<string, PlaybackEntry>();

    private readonly SEGMENT_MS = 4000;
    private readonly MAX_HOLD_MS = 60000;
    private readonly MAX_CLIP_BYTES = 12 * 1024;

    private static readonly CANDIDATE_MIME_TYPES = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
    ];

    public onCapturingChange?: (capturing: boolean) => void;
    public onClipReady?: (base64: string, mimeType: string) => void;
    public onError?: (message: string) => void;

    private readonly handleBlur = () => this.stopCapture();
    private readonly handleVisibilityChange = () => {
        if (document.hidden) this.stopCapture();
    };

    constructor() {
        window.addEventListener("blur", this.handleBlur);
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }

    private pickMimeType(): string {
        if (typeof MediaRecorder === "undefined") return "";
        for (const type of VoiceChatSystem.CANDIDATE_MIME_TYPES) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return "";
    }

    async startCapture() {
        if (this.capturing) return;

        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            this.onError?.("Voice chat isn't supported in this browser");
            return;
        }

        const mimeType = this.pickMimeType();
        if (!mimeType) {
            this.onError?.("Voice chat isn't supported in this browser");
            return;
        }

        const token = ++this.startToken;
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            this.onError?.("Microphone access was denied");
            return;
        }

        if (token !== this.startToken) {
            // G was released (or pressed again) before the permission prompt/mic
            // init resolved — don't start transmitting after the fact.
            stream.getTracks().forEach((t) => t.stop());
            return;
        }

        this.stream = stream;
        this.mimeType = mimeType;
        this.capturing = true;
        this.holdStartedAt = Date.now();
        this.onCapturingChange?.(true);
        this.recordSegment();
    }

    stopCapture() {
        this.startToken++;
        if (!this.capturing) return;
        this.capturing = false;

        if (this.segmentTimer) {
            clearTimeout(this.segmentTimer);
            this.segmentTimer = null;
        }

        if (this.recorder && this.recorder.state !== "inactive") {
            this.recorder.stop();
        } else {
            this.releaseStream();
        }
    }

    private recordSegment() {
        if (!this.stream || !this.capturing) return;

        if (Date.now() - this.holdStartedAt > this.MAX_HOLD_MS) {
            this.stopCapture();
            return;
        }

        const recorder = new MediaRecorder(this.stream, {
            mimeType: this.mimeType,
            audioBitsPerSecond: 16000,
        });
        this.chunks = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.chunks.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(this.chunks, { type: this.mimeType });
            this.chunks = [];
            if (blob.size > 0) this.emitClip(blob);

            if (this.capturing) {
                this.recordSegment();
            } else {
                this.releaseStream();
            }
        };

        this.recorder = recorder;
        recorder.start();
        this.segmentTimer = setTimeout(() => {
            if (recorder.state !== "inactive") recorder.stop();
        }, this.SEGMENT_MS);
    }

    private releaseStream() {
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;
        this.recorder = null;
        this.onCapturingChange?.(false);
    }

    private emitClip(blob: Blob) {
        if (blob.size > this.MAX_CLIP_BYTES) {
            console.warn("[VoiceChat] Dropped an oversized voice segment");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.slice(result.indexOf(",") + 1);
            this.onClipReady?.(base64, this.mimeType);
        };
        reader.readAsDataURL(blob);
    }

    playIncoming(senderId: string, base64: string, mimeType: string) {
        let bytes: Uint8Array<ArrayBuffer>;
        try {
            const binary = atob(base64);
            bytes = new Uint8Array(new ArrayBuffer(binary.length));
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        } catch {
            return;
        }
        const blob = new Blob([bytes], { type: mimeType || "audio/webm" });

        let entry = this.playbackQueues.get(senderId);
        if (!entry) {
            entry = { queue: [], playing: false, audio: null };
            this.playbackQueues.set(senderId, entry);
        }
        entry.queue.push(blob);
        if (!entry.playing) this.playNext(senderId);
    }

    private playNext(senderId: string) {
        const entry = this.playbackQueues.get(senderId);
        if (!entry) return;

        const blob = entry.queue.shift();
        if (!blob) {
            entry.playing = false;
            entry.audio = null;
            return;
        }

        entry.playing = true;
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        entry.audio = audio;

        const advance = () => {
            URL.revokeObjectURL(url);
            this.playNext(senderId);
        };
        audio.onended = advance;
        audio.onerror = advance;
        audio.play().catch(advance);
    }

    dispose() {
        this.stopCapture();
        window.removeEventListener("blur", this.handleBlur);
        document.removeEventListener("visibilitychange", this.handleVisibilityChange);
        this.playbackQueues.forEach((entry) => entry.audio?.pause());
        this.playbackQueues.clear();
    }
}
