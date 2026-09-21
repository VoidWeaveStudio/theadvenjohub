// src/features/game/systems/SceneDirector.ts
import * as THREE from "three";
import { InputManager } from "../core/InputManager";
import type { BodyAxis, BoneKey, PoseBend } from "../world/locations/showcase/actors/poses";
import type { ShowcaseActor } from "../world/locations/showcase/actors/ShowcaseActor";
import type { DirectedActor, DirectedScene } from "../world/locations/showcase/scene/directedScene";

const FRAME = 1 / 30;
const JOG_FRAMES = 10;

const ANGLE_STEP = 0.03;
const ANGLE_FINE = 0.008;
const ANGLE_LIMIT = Math.PI;

const AXES: BodyAxis[] = ["right", "up", "forward"];

const MARKER_COLOUR = 0xffd489;

export interface ClipKey {
    time: number;
    bends: PoseBend[];
}

export interface SceneDirectorState {
    paused: boolean;
    time: number;
    duration: number;
    frame: number;
    frames: number;
    cue: string | null;
    boneMode: boolean;
    actor: string;
    actorIndex: number;
    actorCount: number;
    bone: string;
    axis: BodyAxis;
    angle: number;
    keys: number;
    clipPlaying: boolean;
}

function lerpBends(from: PoseBend[], to: PoseBend[], t: number): PoseBend[] {
    const out: PoseBend[] = [];
    const seen = new Set<string>();

    for (const bend of from) {
        const key = `${bend.bone}|${bend.axis}`;
        seen.add(key);
        const other = to.find((candidate) => candidate.bone === bend.bone && candidate.axis === bend.axis);
        out.push({ bone: bend.bone, axis: bend.axis, angle: THREE.MathUtils.lerp(bend.angle, other ? other.angle : 0, t) });
    }

    for (const bend of to) {
        const key = `${bend.bone}|${bend.axis}`;
        if (seen.has(key)) continue;
        out.push({ bone: bend.bone, axis: bend.axis, angle: THREE.MathUtils.lerp(0, bend.angle, t) });
    }

    return out;
}

// Frame-accurate control over a room's scripted scene, layered on top of the cinema
// camera: scrub the timeline, pose bones by hand, and record those poses as keys on the
// scene clock so an edited move plays back with the scene.
export class SceneDirector {
    public onState?: (state: SceneDirectorState | null) => void;
    public onNotification?: (text: string, duration: number) => void;

    private input: InputManager | null = null;
    private scene: DirectedScene | null = null;
    private cast: DirectedActor[] = [];

    private boneMode = false;
    private actorIndex = 0;
    private boneIndex = 0;
    private axisIndex = 0;

    private readonly clips = new Map<string, ClipKey[]>();
    private clipPlaying = false;
    private lastPaused = false;

    private marker: THREE.Mesh | null = null;
    private markedId: string | null = null;

    public init(input: InputManager) {
        this.input = input;
    }

    public setScene(scene: DirectedScene | null) {
        this.marker?.removeFromParent();
        this.markedId = null;
        this.scene = scene;
        this.cast = scene ? scene.actors() : [];
        this.actorIndex = 0;
        this.boneIndex = 0;
        this.boneMode = false;
        this.clipPlaying = false;
        this.clips.clear();
        this.emit(false);
    }

    public hasScene(): boolean {
        return this.scene !== null;
    }

    private selected(): DirectedActor | null {
        if (this.cast.length === 0) return null;
        this.actorIndex = ((this.actorIndex % this.cast.length) + this.cast.length) % this.cast.length;
        return this.cast[this.actorIndex];
    }

    private showMarker(entry: DirectedActor | null) {
        if (!entry || !this.boneMode) {
            this.marker?.removeFromParent();
            this.markedId = null;
            return;
        }

        if (!this.marker) {
            const geometry = new THREE.ConeGeometry(0.16, 0.42, 10);
            geometry.rotateX(Math.PI);
            this.marker = new THREE.Mesh(
                geometry,
                new THREE.MeshBasicMaterial({ color: MARKER_COLOUR, transparent: true, opacity: 0.8, depthTest: false, toneMapped: false })
            );
            this.marker.position.y = 2.35;
            this.marker.renderOrder = 999;
        }

        if (this.markedId === entry.id && this.marker.parent === entry.actor.group) return;

        this.markedId = entry.id;
        entry.actor.group.add(this.marker);
    }

    private bones(actor: ShowcaseActor): BoneKey[] {
        return actor.boneKeys();
    }

    private selectedBone(): BoneKey | null {
        const entry = this.selected();
        if (!entry) return null;

        const bones = this.bones(entry.actor);
        if (bones.length === 0) return null;

        this.boneIndex = ((this.boneIndex % bones.length) + bones.length) % bones.length;
        return bones[this.boneIndex];
    }

    public update(delta: number, active: boolean) {
        const scene = this.scene;
        if (!scene) return;

        if (!active) {
            if (scene.timeline.isPaused()) scene.timeline.setPaused(false);
            // Leaving the cinema camera with the scene paused would otherwise strand the
            // crowd frozen mid-frame.
            if (this.lastPaused) {
                this.cast = scene.actors();
                this.freezeExtras(false);
            }
            this.lastPaused = false;
            this.emit(false);
            return;
        }

        this.cast = scene.actors();
        this.readKeys(scene);

        if (this.clipPlaying) this.applyClips(scene);

        this.showMarker(this.selected());

        const paused = scene.timeline.isPaused();
        if (paused !== this.lastPaused) {
            this.lastPaused = paused;
            this.freezeExtras(paused);
        }

        this.emit(true);
    }

    // Timeline actors freeze themselves through the timeline; the filler crowd has to be
    // told, otherwise a paused frame still has people breathing and blinking in it.
    private freezeExtras(frozen: boolean) {
        for (const entry of this.cast) entry.actor.setFrozen(frozen);
    }

    private readKeys(scene: DirectedScene) {
        const input = this.input;
        if (!input) return;

        const timeline = scene.timeline;
        const shift = input.isKeyPressed("ShiftLeft") || input.isKeyPressed("ShiftRight");
        const fine = input.isKeyPressed("AltLeft") || input.isKeyPressed("AltRight");

        if (input.isKeyJustPressed("KeyF")) {
            timeline.setPaused(!timeline.isPaused());
            this.say(timeline.isPaused() ? "⏸ scene paused" : "▶ scene running");
        }

        const jog = shift ? FRAME * JOG_FRAMES : FRAME;

        if (input.isKeyJustPressed("ArrowRight")) {
            timeline.setPaused(true);
            timeline.step(jog);
        }
        if (input.isKeyJustPressed("ArrowLeft")) {
            timeline.setPaused(true);
            timeline.step(-jog);
        }

        if (input.isKeyJustPressed("ArrowDown")) this.jumpCue(scene, 1);
        if (input.isKeyJustPressed("ArrowUp")) this.jumpCue(scene, -1);

        if (input.isKeyJustPressed("Home")) {
            timeline.setPaused(true);
            timeline.seek(0);
        }

        if (input.isKeyJustPressed("KeyB")) {
            this.boneMode = !this.boneMode;
            this.say(this.boneMode ? "🦴 bone editor on" : "🦴 bone editor off");
        }

        if (!this.boneMode) return;

        if (input.isKeyJustPressed("Digit1")) this.actorIndex--;
        if (input.isKeyJustPressed("Digit2")) this.actorIndex++;
        if (input.isKeyJustPressed("Digit3")) this.boneIndex--;
        if (input.isKeyJustPressed("Digit4")) this.boneIndex++;
        if (input.isKeyJustPressed("Digit5")) this.axisIndex = (this.axisIndex + 1) % AXES.length;

        const step = fine ? ANGLE_FINE : ANGLE_STEP;
        if (input.isKeyPressed("Numpad4") || input.isKeyPressed("Digit6")) this.nudge(-step);
        if (input.isKeyPressed("Numpad6") || input.isKeyPressed("Digit7")) this.nudge(step);

        if (input.isKeyJustPressed("Numpad5")) this.resetBone();
        if (input.isKeyJustPressed("Numpad0")) this.resetActor();
        if (input.isKeyJustPressed("KeyX")) this.logPose();

        if (input.isKeyJustPressed("KeyI")) this.recordKey(scene);
        if (input.isKeyJustPressed("Delete")) this.dropKey(scene);
        if (input.isKeyJustPressed("KeyY")) {
            this.clipPlaying = !this.clipPlaying;
            if (!this.clipPlaying) this.say("⏹ clip playback off");
            else this.say("⏵ clip playback on");
        }
        if (input.isKeyJustPressed("KeyT")) this.exportClips();
        if (input.isKeyJustPressed("Backslash")) this.clearClip();
    }

    private jumpCue(scene: DirectedScene, direction: number) {
        const timeline = scene.timeline;
        const lines = timeline.lines();
        if (lines.length === 0) return;

        timeline.setPaused(true);
        const now = timeline.position;

        if (direction > 0) {
            const next = lines.find((line) => line.at > now + 0.01);
            timeline.seek(next ? next.at : 0);
        } else {
            const previous = [...lines].reverse().find((line) => line.at < now - 0.01);
            timeline.seek(previous ? previous.at : lines[lines.length - 1].at);
        }
    }

    private nudge(amount: number) {
        const entry = this.selected();
        const bone = this.selectedBone();
        if (!entry || !bone) return;

        const axis = AXES[this.axisIndex];
        const bends = entry.actor.bendOverrides().map((bend) => ({ ...bend }));
        const existing = bends.find((bend) => bend.bone === bone && bend.axis === axis);

        if (existing) existing.angle = THREE.MathUtils.clamp(existing.angle + amount, -ANGLE_LIMIT, ANGLE_LIMIT);
        else bends.push({ bone, axis, angle: amount });

        entry.actor.setBendOverrides(bends);
    }

    private currentAngle(): number {
        const entry = this.selected();
        const bone = this.selectedBone();
        if (!entry || !bone) return 0;

        const axis = AXES[this.axisIndex];
        return entry.actor.bendOverrides().find((bend) => bend.bone === bone && bend.axis === axis)?.angle ?? 0;
    }

    private resetBone() {
        const entry = this.selected();
        const bone = this.selectedBone();
        if (!entry || !bone) return;

        const axis = AXES[this.axisIndex];
        entry.actor.setBendOverrides(entry.actor.bendOverrides().filter((bend) => !(bend.bone === bone && bend.axis === axis)));
        this.say(`↺ ${bone} ${axis}`);
    }

    private resetActor() {
        const entry = this.selected();
        if (!entry) return;

        entry.actor.setBendOverrides([]);
        this.say(`↺ ${entry.id} cleared`);
    }

    private logPose() {
        const entry = this.selected();
        if (!entry) return;

        const bends = entry.actor.bendOverrides();
        const body = bends
            .map((bend) => `    { bone: "${bend.bone}", axis: "${bend.axis}", angle: ${bend.angle.toFixed(3)} },`)
            .join("\n");

        console.log(`[SceneDirector] ${entry.id} (base pose: ${entry.actor.currentPose() ?? "none"})\n[\n${body}\n]`);
        this.say(`📋 ${entry.id} pose in console`);
    }

    private recordKey(scene: DirectedScene) {
        const entry = this.selected();
        if (!entry) return;

        const time = scene.timeline.position;
        const keys = this.clips.get(entry.id) ?? [];
        const bends = entry.actor.bendOverrides().map((bend) => ({ ...bend }));

        const existing = keys.findIndex((key) => Math.abs(key.time - time) < FRAME / 2);
        if (existing >= 0) keys[existing] = { time, bends };
        else keys.push({ time, bends });

        keys.sort((a, b) => a.time - b.time);
        this.clips.set(entry.id, keys);
        this.say(`⬤ key ${keys.length} @ ${time.toFixed(2)}s`);
    }

    private dropKey(scene: DirectedScene) {
        const entry = this.selected();
        if (!entry) return;

        const keys = this.clips.get(entry.id);
        if (!keys || keys.length === 0) return;

        const time = scene.timeline.position;
        let nearest = 0;
        for (let i = 1; i < keys.length; i++) {
            if (Math.abs(keys[i].time - time) < Math.abs(keys[nearest].time - time)) nearest = i;
        }

        keys.splice(nearest, 1);
        this.say(`✕ key removed (${keys.length} left)`);
    }

    private clearClip() {
        const entry = this.selected();
        if (!entry) return;

        this.clips.delete(entry.id);
        this.say(`✕ ${entry.id} clip cleared`);
    }

    private applyClips(scene: DirectedScene) {
        const time = scene.timeline.position;

        for (const [id, keys] of this.clips) {
            if (keys.length === 0) continue;

            const actor = this.cast.find((entry) => entry.id === id)?.actor;
            if (!actor) continue;

            if (keys.length === 1 || time <= keys[0].time) {
                actor.setBendOverrides(keys[0].bends);
                continue;
            }

            const last = keys[keys.length - 1];
            if (time >= last.time) {
                actor.setBendOverrides(last.bends);
                continue;
            }

            let index = 0;
            while (index < keys.length - 2 && keys[index + 1].time <= time) index++;

            const from = keys[index];
            const to = keys[index + 1];
            const span = Math.max(0.0001, to.time - from.time);
            actor.setBendOverrides(lerpBends(from.bends, to.bends, (time - from.time) / span));
        }
    }

    private exportClips() {
        if (this.clips.size === 0) {
            this.say("no keys recorded");
            return;
        }

        const payload = {
            frameRate: Math.round(1 / FRAME),
            clips: Array.from(this.clips.entries()).map(([id, keys]) => ({
                actor: id,
                keys: keys.map((key) => ({
                    time: Number(key.time.toFixed(3)),
                    bends: key.bends.map((bend) => ({
                        bone: bend.bone,
                        axis: bend.axis,
                        angle: Number(bend.angle.toFixed(4)),
                    })),
                })),
            })),
        };

        const json = JSON.stringify(payload, null, 2);
        console.log("[SceneDirector] clips\n" + json);

        try {
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `scene-clips-${Date.now()}.json`;
            link.click();
            URL.revokeObjectURL(url);
        } catch {
            // Console output is the fallback when the download is blocked.
        }

        this.say(`💾 ${this.clips.size} clip(s) exported`);
    }

    private say(text: string) {
        this.onNotification?.(text, 1800);
    }

    private emit(active: boolean) {
        if (!active || !this.scene) {
            this.onState?.(null);
            return;
        }

        const timeline = this.scene.timeline;
        const entry = this.selected();
        const bone = this.selectedBone();
        const lines = timeline.lines();
        const now = timeline.position;
        const spoken = [...lines].reverse().find((line) => line.at <= now);

        this.onState?.({
            paused: timeline.isPaused(),
            time: now,
            duration: timeline.duration,
            frame: Math.round(now / FRAME),
            frames: Math.round(timeline.duration / FRAME),
            cue: spoken ? `${spoken.speaker}: ${spoken.text}` : null,
            boneMode: this.boneMode,
            actor: entry?.id ?? "—",
            actorIndex: this.cast.length === 0 ? 0 : this.actorIndex + 1,
            actorCount: this.cast.length,
            bone: bone ?? "—",
            axis: AXES[this.axisIndex],
            angle: this.currentAngle(),
            keys: entry ? (this.clips.get(entry.id)?.length ?? 0) : 0,
            clipPlaying: this.clipPlaying,
        });
    }

    public dispose() {
        this.marker?.removeFromParent();
        this.marker?.geometry.dispose();
        (this.marker?.material as THREE.Material | undefined)?.dispose();
        this.marker = null;
        this.markedId = null;
        this.scene = null;
        this.cast = [];
        this.clips.clear();
        this.input = null;
    }
}
