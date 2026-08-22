// src/features/game/systems/VoiceChatSystem.ts
const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
];

interface PeerEntry {
    pc: RTCPeerConnection;
    audioEl: HTMLAudioElement;
    polite: boolean;
    makingOffer: boolean;
    ignoreOffer: boolean;
}

export class VoiceChatSystem {
    private peers: Map<string, PeerEntry> = new Map();
    private nearbyIds: Set<string> = new Set();
    private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
    private localStream: MediaStream | null = null;
    private localTrack: MediaStreamTrack | null = null;
    private talking = false;
    private localId = "";

    public onCapturingChange?: (capturing: boolean) => void;
    public onError?: (message: string) => void;

    public sendOffer?: (targetId: string, sdp: string) => void;
    public sendAnswer?: (targetId: string, sdp: string) => void;
    public sendIceCandidate?: (targetId: string, candidate: RTCIceCandidateInit) => void;

    private readonly handleBlur = () => this.stopCapture();
    private readonly handleVisibilityChange = () => {
        if (document.hidden) this.stopCapture();
    };

    constructor() {
        window.addEventListener("blur", this.handleBlur);
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }

    setLocalId(id: string) {
        this.localId = id;
    }

    private async ensureLocalStream(): Promise<MediaStream | null> {
        if (this.localStream) return this.localStream;

        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            this.onError?.("Voice chat isn't supported in this browser");
            return null;
        }
        if (typeof RTCPeerConnection === "undefined") {
            this.onError?.("Voice chat isn't supported in this browser");
            return null;
        }

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            this.onError?.("Microphone access was denied");
            return null;
        }

        const track = stream.getAudioTracks()[0] ?? null;
        if (track) track.enabled = this.talking;
        this.localStream = stream;
        this.localTrack = track;

        for (const entry of this.peers.values()) {
            if (track && !entry.pc.getSenders().some((s) => s.track === track)) {
                entry.pc.addTrack(track, stream);
            }
        }

        return stream;
    }

    async startCapture() {
        if (this.talking) return;
        const stream = await this.ensureLocalStream();
        if (!stream) return;
        this.talking = true;
        if (this.localTrack) this.localTrack.enabled = true;
        this.connectToNearby();
        this.onCapturingChange?.(true);
    }

    private connectToNearby() {
        for (const remoteId of this.nearbyIds) {
            if (remoteId === this.localId || this.peers.has(remoteId)) continue;
            this.createPeerConnection(remoteId);
        }
    }

    stopCapture() {
        if (!this.talking) return;
        this.talking = false;
        if (this.localTrack) this.localTrack.enabled = false;
        this.onCapturingChange?.(false);
    }

    private createPeerConnection(remoteId: string): PeerEntry {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        const audioEl = new Audio();
        audioEl.autoplay = true;

        const entry: PeerEntry = {
            pc,
            audioEl,
            polite: this.localId > remoteId,
            makingOffer: false,
            ignoreOffer: false,
        };
        this.peers.set(remoteId, entry);

        if (this.localTrack && this.localStream) {
            pc.addTrack(this.localTrack, this.localStream);
        } else {
            pc.addTransceiver("audio", { direction: "recvonly" });
        }

        pc.ontrack = (event) => {
            audioEl.srcObject = event.streams[0] ?? null;
            audioEl.play().catch(() => {});
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendIceCandidate?.(remoteId, event.candidate.toJSON());
            }
        };

        pc.onnegotiationneeded = async () => {
            try {
                entry.makingOffer = true;
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                if (pc.localDescription) {
                    this.sendOffer?.(remoteId, pc.localDescription.sdp);
                }
            } catch (err) {
                console.error("[VoiceChat] Negotiation failed:", err);
            } finally {
                entry.makingOffer = false;
            }
        };

        return entry;
    }

    private removePeer(remoteId: string) {
        const entry = this.peers.get(remoteId);
        if (!entry) return;
        entry.pc.close();
        entry.audioEl.pause();
        entry.audioEl.srcObject = null;
        this.peers.delete(remoteId);
        this.pendingCandidates.delete(remoteId);
    }

    syncPeers(activeIds: ReadonlySet<string>) {
        this.nearbyIds = new Set(activeIds);
        if (this.talking) this.connectToNearby();

        for (const remoteId of Array.from(this.peers.keys())) {
            if (!activeIds.has(remoteId)) {
                this.removePeer(remoteId);
            }
        }
    }

    async handleOffer(fromId: string, sdp: string) {
        let entry = this.peers.get(fromId);
        if (!entry) entry = this.createPeerConnection(fromId);

        const offerCollision = entry.makingOffer || entry.pc.signalingState !== "stable";
        entry.ignoreOffer = !entry.polite && offerCollision;
        if (entry.ignoreOffer) return;

        try {
            if (offerCollision) {
                await entry.pc.setLocalDescription({ type: "rollback" });
            }
            await entry.pc.setRemoteDescription({ type: "offer", sdp });
            await this.flushCandidates(fromId);
            const answer = await entry.pc.createAnswer();
            await entry.pc.setLocalDescription(answer);
            if (entry.pc.localDescription) {
                this.sendAnswer?.(fromId, entry.pc.localDescription.sdp);
            }
        } catch (err) {
            console.error("[VoiceChat] Failed to handle offer:", err);
        }
    }

    async handleAnswer(fromId: string, sdp: string) {
        const entry = this.peers.get(fromId);
        if (!entry) return;
        try {
            await entry.pc.setRemoteDescription({ type: "answer", sdp });
            await this.flushCandidates(fromId);
        } catch (err) {
            console.error("[VoiceChat] Failed to handle answer:", err);
        }
    }

    async handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit) {
        const entry = this.peers.get(fromId);
        if (!entry || !entry.pc.remoteDescription) {
            const queued = this.pendingCandidates.get(fromId) ?? [];
            queued.push(candidate);
            this.pendingCandidates.set(fromId, queued);
            return;
        }
        try {
            await entry.pc.addIceCandidate(candidate);
        } catch (err) {
            if (!entry.ignoreOffer) console.error("[VoiceChat] Failed to add ICE candidate:", err);
        }
    }

    private async flushCandidates(remoteId: string) {
        const queued = this.pendingCandidates.get(remoteId);
        if (!queued) return;
        this.pendingCandidates.delete(remoteId);

        const entry = this.peers.get(remoteId);
        if (!entry) return;
        for (const candidate of queued) {
            try {
                await entry.pc.addIceCandidate(candidate);
            } catch (err) {
                if (!entry.ignoreOffer) console.error("[VoiceChat] Failed to add queued ICE candidate:", err);
            }
        }
    }

    dispose() {
        window.removeEventListener("blur", this.handleBlur);
        document.removeEventListener("visibilitychange", this.handleVisibilityChange);
        for (const remoteId of Array.from(this.peers.keys())) {
            this.removePeer(remoteId);
        }
        this.pendingCandidates.clear();
        this.nearbyIds.clear();
        this.localStream?.getTracks().forEach((t) => t.stop());
        this.localStream = null;
        this.localTrack = null;
    }
}
