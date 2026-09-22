// src/features/game/world/locations/showcase/scene/SceneTimeline.ts
import * as THREE from "three";
import type { ShowcaseActor } from "../actors/ShowcaseActor";
import type { PoseId } from "../actors/poses";

// A scene is stored as cues on an absolute clock rather than as a chain of callbacks,
// so any moment can be rebuilt from the cue list alone. That is what makes stepping
// backwards frame by frame possible: seek(t) never depends on how we got to t.

export interface CueSpan {
    start: number;
    end: number;
}

interface MoveCue extends CueSpan {
    kind: "move";
    actor: string;
    from: THREE.Vector3;
    to: THREE.Vector3;
    run: boolean;
    linear?: boolean;
    pose?: PoseId;
}

interface HoldCue extends CueSpan {
    kind: "hold";
    actor: string;
    at: THREE.Vector3;
    pose?: PoseId;
    face?: THREE.Vector3;
    facing?: number;
    held?: boolean;
}

interface LineCue extends CueSpan {
    kind: "line";
    actor?: string;
    speaker: string;
    text: string;
    // A line the whole congregation shouts: every actor's mouth moves, not just one.
    chorus?: boolean;
}

interface StateCue extends CueSpan {
    kind: "state";
    key: string;
    from: number;
    to: number;
}

type Cue = MoveCue | HoldCue | LineCue | StateCue;

export interface SceneLine {
    at: number;
    speaker: string;
    text: string;
}

export interface SceneSubtitle {
    speaker: string;
    text: string;
}

const _look = new THREE.Vector3();

function easeInOut(t: number): number {
    return t * t * (3 - 2 * t);
}

export class SceneTimeline {
    private readonly actors = new Map<string, ShowcaseActor>();
    private readonly rest = new Map<string, HoldCue>();
    private readonly cues: Cue[] = [];
    private readonly byActor = new Map<string, Array<MoveCue | HoldCue>>();
    private chorus: ShowcaseActor[] = [];
    private readonly stateKeys = new Set<string>();
    private readonly stateSinks = new Map<string, (value: number) => void>();
    private readonly liveState = new Map<string, number>();

    private cursor = 0;
    private length = 0;
    private time = 0;
    private paused = false;

    public onSubtitle?: (subtitle: SceneSubtitle | null) => void;

    public register(id: string, actor: ShowcaseActor, rest: { at: THREE.Vector3; pose?: PoseId; face?: THREE.Vector3; facing?: number; held?: boolean }) {
        actor.setScripted(true);
        this.actors.set(id, actor);
        this.rest.set(id, {
            kind: "hold",
            actor: id,
            start: 0,
            end: 0,
            at: rest.at.clone(),
            pose: rest.pose,
            face: rest.face?.clone(),
            facing: rest.facing,
            held: rest.held,
        });
    }

    // The filler crowd is not on the timeline, but it has to shout along, so the room
    // hands its extras over once they exist.
    public setChorus(actors: ShowcaseActor[]) {
        this.chorus = actors;
    }

    public sink(key: string, apply: (value: number) => void) {
        this.stateKeys.add(key);
        this.stateSinks.set(key, apply);
    }

    public getActor(id: string): ShowcaseActor | undefined {
        return this.actors.get(id);
    }

    public actorIds(): string[] {
        return Array.from(this.actors.keys());
    }

    // Authoring helpers. `beat` walks the cursor forward; cues take absolute times so a
    // long walk can overlap several beats of dialogue.
    public beat(duration: number): number {
        const start = this.cursor;
        this.cursor += duration;
        this.length = Math.max(this.length, this.cursor);
        return start;
    }

    public get cursorTime(): number {
        return this.cursor;
    }

    public setCursor(time: number) {
        this.cursor = time;
        this.length = Math.max(this.length, time);
    }

    private push(cue: Cue) {
        this.cues.push(cue);
        this.length = Math.max(this.length, cue.end);

        if (cue.kind === "move" || cue.kind === "hold") {
            const list = this.byActor.get(cue.actor) ?? [];
            list.push(cue);
            list.sort((a, b) => a.start - b.start);
            this.byActor.set(cue.actor, list);
        }

        if (cue.kind === "state") this.stateKeys.add(cue.key);
    }

    public move(
        actor: string,
        from: THREE.Vector3,
        to: THREE.Vector3,
        start: number,
        duration: number,
        options: { run?: boolean; pose?: PoseId; linear?: boolean } = {}
    ) {
        this.push({
            kind: "move",
            actor,
            from: from.clone(),
            to: to.clone(),
            start,
            end: start + duration,
            run: options.run === true,
            linear: options.linear === true,
            pose: options.pose,
        });
    }

    public hold(
        actor: string,
        at: THREE.Vector3,
        start: number,
        duration: number,
        options: { pose?: PoseId; face?: THREE.Vector3; facing?: number; held?: boolean } = {}
    ) {
        this.push({
            kind: "hold",
            actor,
            at: at.clone(),
            start,
            end: start + duration,
            pose: options.pose,
            face: options.face?.clone(),
            facing: options.facing,
            held: options.held,
        });
    }

    public line(speaker: string, text: string, start: number, duration: number, actor?: string, chorus = false) {
        this.push({ kind: "line", actor, speaker, text, start, end: start + duration, chorus });
    }

    public state(key: string, value: number, start: number) {
        this.push({ kind: "state", key, from: value, to: value, start, end: start });
    }

    public ramp(key: string, from: number, to: number, start: number, duration: number) {
        this.push({ kind: "state", key, from, to, start, end: start + duration });
    }

    public get duration(): number {
        return this.length;
    }

    public get position(): number {
        return this.time;
    }

    public isPaused(): boolean {
        return this.paused;
    }

    public setPaused(value: boolean) {
        this.paused = value;
    }

    public lines(): SceneLine[] {
        return this.cues
            .filter((cue): cue is LineCue => cue.kind === "line")
            .map((cue) => ({ at: cue.start, speaker: cue.speaker, text: cue.text }))
            .sort((a, b) => a.at - b.at);
    }

    public update(delta: number) {
        if (this.paused) {
            this.seek(this.time);
            return;
        }

        let next = this.time + delta;
        if (this.length > 0 && next >= this.length) next -= this.length;
        this.seek(next);
    }

    public step(seconds: number) {
        let next = this.time + seconds;
        if (this.length > 0) {
            while (next < 0) next += this.length;
            while (next >= this.length) next -= this.length;
        } else {
            next = 0;
        }
        this.seek(next);
    }

    public seek(time: number) {
        this.time = this.length > 0 ? THREE.MathUtils.clamp(time, 0, this.length) : 0;

        this.applyActors();
        this.applyStates();
        this.applySubtitle();
    }

    private applyActors() {
        for (const [id, actor] of this.actors) {
            actor.setFrozen(this.paused);

            const cues = this.byActor.get(id);
            let active: MoveCue | HoldCue | undefined;

            if (cues) {
                for (const cue of cues) {
                    if (cue.start > this.time) break;
                    active = cue;
                }
            }

            if (!active) active = this.rest.get(id);
            if (!active) continue;

            if (active.kind === "move") this.applyMove(actor, active);
            else this.applyHold(actor, active, this.rest.get(id));
        }
    }

    private applyMove(actor: ShowcaseActor, cue: MoveCue) {
        const span = Math.max(0.0001, cue.end - cue.start);
        const raw = THREE.MathUtils.clamp((this.time - cue.start) / span, 0, 1);
        const progress = cue.linear === true ? raw : easeInOut(raw);

        const x = THREE.MathUtils.lerp(cue.from.x, cue.to.x, progress);
        const y = THREE.MathUtils.lerp(cue.from.y, cue.to.y, progress);
        const z = THREE.MathUtils.lerp(cue.from.z, cue.to.z, progress);

        actor.setDestination(null);
        actor.moveTo(x, y, z);
        actor.snapPose(cue.pose);

        const dx = cue.to.x - cue.from.x;
        const dz = cue.to.z - cue.from.z;
        if (Math.hypot(dx, dz) > 0.001) actor.setFacing(Math.atan2(dx, dz));

        const walking = raw > 0 && raw < 1;
        actor.setMotion(walking ? (cue.run ? "run" : "walk") : "idle");
        actor.setHeldVisible(true);
    }

    private applyHold(actor: ShowcaseActor, cue: HoldCue, rest?: HoldCue) {
        actor.setDestination(null);
        actor.moveTo(cue.at.x, cue.at.y, cue.at.z);
        actor.snapPose(cue.pose);
        actor.setMotion("idle");

        // A cue that says nothing about facing falls back to the actor's resting
        // heading, never to whatever the previous frame happened to leave behind —
        // otherwise the same frame would look different depending on the scrub
        // direction.
        const face = cue.face ?? rest?.face;
        const facing = cue.facing ?? rest?.facing;

        if (face) {
            _look.copy(face);
            actor.setFacing(Math.atan2(_look.x - cue.at.x, _look.z - cue.at.z));
        } else {
            actor.setFacing(facing ?? 0);
        }

        actor.setHeldVisible(cue.held ?? true);
    }

    private applyStates() {
        for (const key of this.stateKeys) {
            let value = 0;
            let best = -1;

            for (const cue of this.cues) {
                if (cue.kind !== "state" || cue.key !== key) continue;
                if (cue.start > this.time || cue.start < best) continue;

                best = cue.start;
                const span = cue.end - cue.start;
                value = span <= 0
                    ? cue.to
                    : THREE.MathUtils.lerp(cue.from, cue.to, THREE.MathUtils.clamp((this.time - cue.start) / span, 0, 1));
            }

            if (this.liveState.get(key) === value) continue;
            this.liveState.set(key, value);
            this.stateSinks.get(key)?.(value);
        }
    }

    private applySubtitle() {
        let current: LineCue | null = null;

        for (const cue of this.cues) {
            if (cue.kind !== "line") continue;
            if (this.time < cue.start || this.time >= cue.end) continue;
            if (!current || cue.start > current.start) current = cue;
        }

        const shouting = current?.chorus === true;

        for (const [id, actor] of this.actors) {
            actor.setTalking(shouting || current?.actor === id, current?.text);
        }

        for (const actor of this.chorus) actor.setTalking(shouting, current?.text);

        this.onSubtitle?.(current ? { speaker: current.speaker, text: current.text } : null);
    }
}
