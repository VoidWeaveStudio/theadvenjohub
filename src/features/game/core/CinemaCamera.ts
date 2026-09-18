// src/features/game/core/CinemaCamera.ts
import * as THREE from "three";
import { InputManager } from "./InputManager";
import { t } from "@/core/i18n";
import { isRainEnabled, setRainEnabled } from "@/features/game/world/locations/showcase/rainVisibility";

const NEAR = 0.05;
const FAR = 30000;

const MIN_SPEED = 0.2;
const MAX_SPEED = 400;
const SPEED_STEP = 1.18;
const DEFAULT_SPEED = 12;

const MIN_FOV = 10;
const MAX_FOV = 120;
const FOV_STEP = 2;
const DEFAULT_FOV = 55;

const BOOST_MULTIPLIER = 4;
const CRAWL_MULTIPLIER = 0.25;

const LOOK_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI / 2 - 0.001;
const ROLL_SPEED = 0.9;
const MAX_ROLL = Math.PI;

const MIN_ORBIT_RADIUS = 1.5;
const MAX_ORBIT_RADIUS = 600;
const DEFAULT_ORBIT_RADIUS = 14;
const ORBIT_SPEED_STEP = 0.06;
const MAX_ORBIT_SPEED = 1.6;

const MIN_RAIL_SECONDS = 2;
const MAX_RAIL_SECONDS = 600;
const DEFAULT_RAIL_SECONDS = 12;
const RAIL_STEP_SECONDS = 1;
const MAX_KEYFRAMES = 64;

const TOAST_MS = 2200;
const PLAY_EMIT_INTERVAL_MS = 120;

export type CinemaMode = "free" | "orbit" | "rail";

export interface CinemaSmoothing {
    labelKey: string;
    move: number;
    look: number;
}

const SMOOTHING_STEPS: CinemaSmoothing[] = [
    { labelKey: "g.cinema.smooth.off", move: 60, look: 90 },
    { labelKey: "g.cinema.smooth.soft", move: 14, look: 20 },
    { labelKey: "g.cinema.smooth.film", move: 6.5, look: 9 },
    { labelKey: "g.cinema.smooth.heavy", move: 3, look: 4.5 },
];

export interface CinemaToast {
    key: string;
    vars?: Record<string, string | number>;
}

export interface CinemaState {
    active: boolean;
    mode: CinemaMode;
    speed: number;
    fov: number;
    smoothingKey: string;
    roll: number;
    hideUi: boolean;
    hideSelf: boolean;
    hideCaptions: boolean;
    keyframes: number;
    railSeconds: number;
    railLoop: boolean;
    railProgress: number;
    orbitRadius: number;
    orbitSpeed: number;
    toast: CinemaToast | null;
}

interface Keyframe {
    position: THREE.Vector3;
    yaw: number;
    pitch: number;
    roll: number;
    fov: number;
}

function damp(rate: number, delta: number): number {
    return 1 - Math.exp(-rate * delta);
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
        2 * p1 +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
}

function sampleScalarTrack(values: number[], t: number): number {
    const last = values.length - 1;
    if (last < 0) return 0;
    if (last === 0) return values[0];

    const clamped = THREE.MathUtils.clamp(t, 0, last);
    const index = Math.min(Math.floor(clamped), last - 1);
    const local = clamped - index;

    const p0 = values[Math.max(0, index - 1)];
    const p1 = values[index];
    const p2 = values[index + 1];
    const p3 = values[Math.min(last, index + 2)];

    return catmullRom(p0, p1, p2, p3, local);
}

function unwrapAngle(previous: number, angle: number): number {
    let result = angle;
    while (result - previous > Math.PI) result -= Math.PI * 2;
    while (previous - result > Math.PI) result += Math.PI * 2;
    return result;
}

export class CinemaCamera {
    public readonly camera: THREE.PerspectiveCamera;
    public onStateChange?: (state: CinemaState) => void;

    private active = false;
    private mode: CinemaMode = "free";

    private readonly position = new THREE.Vector3();
    private readonly velocity = new THREE.Vector3();
    private yaw = 0;
    private pitch = 0;
    private roll = 0;
    private targetYaw = 0;
    private targetPitch = 0;

    private speed = DEFAULT_SPEED;
    private fov = DEFAULT_FOV;
    private smoothingIndex = 1;
    private hideUi = false;
    private hideSelf = true;
    private hideCaptions = false;

    private readonly orbitTarget = new THREE.Vector3();
    private orbitRadius = DEFAULT_ORBIT_RADIUS;
    private orbitSpeed = 0.25;
    private orbitAngle = 0;
    private orbitHeight = 0;

    private keyframes: Keyframe[] = [];
    private railCurve: THREE.CatmullRomCurve3 | null = null;
    private railYaw: number[] = [];
    private railPitch: number[] = [];
    private railRoll: number[] = [];
    private railFov: number[] = [];
    private railSeconds = DEFAULT_RAIL_SECONDS;
    private railLoop = false;
    private railTime = 0;

    private toast: CinemaToast | null = null;
    private toastUntil = 0;
    private lastPlayEmit = 0;

    private readonly forward = new THREE.Vector3();
    private readonly right = new THREE.Vector3();
    private readonly wish = new THREE.Vector3();
    private readonly railPoint = new THREE.Vector3();

    constructor() {
        this.camera = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, NEAR, FAR);
        this.camera.rotation.order = "YXZ";
    }

    public isActive(): boolean {
        return this.active;
    }

    public isUiHidden(): boolean {
        return this.active && this.hideUi;
    }

    public hidesPlayer(): boolean {
        return this.active && this.hideSelf;
    }

    public hidesCaptions(): boolean {
        return this.active && this.hideCaptions;
    }

    public setAspect(aspect: number) {
        this.camera.aspect = aspect > 0 ? aspect : 1;
        this.camera.updateProjectionMatrix();
    }

    public getState(): CinemaState {
        return {
            active: this.active,
            mode: this.mode,
            speed: this.speed,
            fov: this.fov,
            smoothingKey: SMOOTHING_STEPS[this.smoothingIndex].labelKey,
            roll: this.roll,
            hideUi: this.hideUi,
            hideSelf: this.hideSelf,
            hideCaptions: this.hideCaptions,
            keyframes: this.keyframes.length,
            railSeconds: this.railSeconds,
            railLoop: this.railLoop,
            railProgress: this.mode === "rail" ? THREE.MathUtils.clamp(this.railTime / this.railSeconds, 0, 1) : 0,
            orbitRadius: this.orbitRadius,
            orbitSpeed: this.orbitSpeed,
            toast: this.toast,
        };
    }

    private emit() {
        this.onStateChange?.(this.getState());
    }

    private say(key: string, vars?: Record<string, string | number>) {
        this.toast = { key, vars };
        this.toastUntil = performance.now() + TOAST_MS;
        this.emit();
    }

    public enter(origin: THREE.Vector3, yaw: number, pitch: number) {
        if (this.active) return;

        this.active = true;
        this.mode = "free";
        this.position.copy(origin);
        this.velocity.set(0, 0, 0);
        this.yaw = yaw;
        this.pitch = THREE.MathUtils.clamp(pitch, -MAX_PITCH, MAX_PITCH);
        this.targetYaw = this.yaw;
        this.targetPitch = this.pitch;
        this.roll = 0;
        this.railTime = 0;

        this.applyTransform();
        this.say("g.cinema.toast.enter");
    }

    public exit() {
        if (!this.active) return;

        this.active = false;
        this.mode = "free";
        this.velocity.set(0, 0, 0);
        this.toast = null;
        this.emit();
    }

    public update(delta: number, input: InputManager) {
        if (!this.active) return;

        this.readShortcuts(input);

        if (this.mode === "rail") {
            this.updateRail(delta, input);
        } else if (this.mode === "orbit") {
            this.updateOrbit(delta, input);
        } else {
            this.updateFree(delta, input);
        }

        this.applyTransform();
        this.expireToast();
    }

    private expireToast() {
        if (!this.toast || performance.now() < this.toastUntil) return;
        this.toast = null;
        this.emit();
    }

    private readShortcuts(input: InputManager) {
        const wheel = input.consumeWheel();
        if (wheel !== 0) {
            const factor = wheel < 0 ? SPEED_STEP : 1 / SPEED_STEP;
            this.speed = THREE.MathUtils.clamp(this.speed * factor, MIN_SPEED, MAX_SPEED);
            this.emit();
        }

        if (input.isKeyJustPressed("BracketLeft")) {
            this.fov = THREE.MathUtils.clamp(this.fov - FOV_STEP, MIN_FOV, MAX_FOV);
            this.emit();
        }
        if (input.isKeyJustPressed("BracketRight")) {
            this.fov = THREE.MathUtils.clamp(this.fov + FOV_STEP, MIN_FOV, MAX_FOV);
            this.emit();
        }

        if (input.isKeyJustPressed("KeyZ")) {
            this.smoothingIndex = (this.smoothingIndex + 1) % SMOOTHING_STEPS.length;
            this.say("g.cinema.toast.smoothing", { mode: t(SMOOTHING_STEPS[this.smoothingIndex].labelKey) });
        }

        if (input.isKeyJustPressed("KeyH")) {
            this.hideUi = !this.hideUi;
            this.emit();
        }

        if (input.isKeyJustPressed("KeyJ")) {
            this.hideSelf = !this.hideSelf;
            this.say(this.hideSelf ? "g.cinema.toast.selfHidden" : "g.cinema.toast.selfShown");
        }

        if (input.isKeyJustPressed("KeyC")) {
            this.hideCaptions = !this.hideCaptions;
            this.say(this.hideCaptions ? "g.cinema.toast.captionsHidden" : "g.cinema.toast.captionsShown");
        }

        if (input.isKeyJustPressed("KeyV")) {
            setRainEnabled(!isRainEnabled());
            this.say(isRainEnabled() ? "g.cinema.toast.rainOn" : "g.cinema.toast.rainOff");
        }

        if (input.isKeyJustPressed("KeyR")) {
            this.roll = 0;
            this.say("g.cinema.toast.rollReset");
        }

        if (input.isKeyJustPressed("KeyO")) {
            this.toggleOrbit();
        }

        if (input.isKeyJustPressed("KeyK")) {
            this.addKeyframe();
        }

        if (input.isKeyJustPressed("KeyU")) {
            this.clearKeyframes();
        }

        if (input.isKeyJustPressed("KeyL")) {
            this.toggleRail();
        }

        if (input.isKeyJustPressed("KeyP")) {
            this.railLoop = !this.railLoop;
            this.say(this.railLoop ? "g.cinema.toast.loopOn" : "g.cinema.toast.loopOff");
        }

        if (input.isKeyJustPressed("Comma")) {
            this.railSeconds = THREE.MathUtils.clamp(this.railSeconds - RAIL_STEP_SECONDS, MIN_RAIL_SECONDS, MAX_RAIL_SECONDS);
            this.emit();
        }
        if (input.isKeyJustPressed("Period")) {
            this.railSeconds = THREE.MathUtils.clamp(this.railSeconds + RAIL_STEP_SECONDS, MIN_RAIL_SECONDS, MAX_RAIL_SECONDS);
            this.emit();
        }
    }

    private speedMultiplier(input: InputManager): number {
        if (input.isKeyPressed("ShiftLeft") || input.isKeyPressed("ShiftRight")) return BOOST_MULTIPLIER;
        if (input.isKeyPressed("AltLeft") || input.isKeyPressed("AltRight")) return CRAWL_MULTIPLIER;
        return 1;
    }

    private applyLook(delta: number, input: InputManager) {
        const movement = input.consumeMouseMovement();
        this.targetYaw -= movement.x * LOOK_SENSITIVITY;
        this.targetPitch = THREE.MathUtils.clamp(
            this.targetPitch - movement.y * LOOK_SENSITIVITY,
            -MAX_PITCH,
            MAX_PITCH
        );

        const blend = damp(SMOOTHING_STEPS[this.smoothingIndex].look, delta);
        this.yaw += (this.targetYaw - this.yaw) * blend;
        this.pitch += (this.targetPitch - this.pitch) * blend;

        if (input.isKeyPressed("KeyQ")) this.roll = THREE.MathUtils.clamp(this.roll + ROLL_SPEED * delta, -MAX_ROLL, MAX_ROLL);
        if (input.isKeyPressed("KeyE")) this.roll = THREE.MathUtils.clamp(this.roll - ROLL_SPEED * delta, -MAX_ROLL, MAX_ROLL);
    }

    private updateFree(delta: number, input: InputManager) {
        this.applyLook(delta, input);

        const cosPitch = Math.cos(this.pitch);
        this.forward.set(-cosPitch * Math.sin(this.yaw), Math.sin(this.pitch), -cosPitch * Math.cos(this.yaw));
        this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

        this.wish.set(0, 0, 0);
        if (input.isKeyPressed("KeyW")) this.wish.add(this.forward);
        if (input.isKeyPressed("KeyS")) this.wish.sub(this.forward);
        if (input.isKeyPressed("KeyD")) this.wish.add(this.right);
        if (input.isKeyPressed("KeyA")) this.wish.sub(this.right);
        if (input.isKeyPressed("Space")) this.wish.y += 1;
        if (input.isKeyPressed("ControlLeft") || input.isKeyPressed("ControlRight")) this.wish.y -= 1;

        if (this.wish.lengthSq() > 0) {
            this.wish.normalize().multiplyScalar(this.speed * this.speedMultiplier(input));
        }

        const blend = damp(SMOOTHING_STEPS[this.smoothingIndex].move, delta);
        this.velocity.lerp(this.wish, blend);
        this.position.addScaledVector(this.velocity, delta);
    }

    private toggleOrbit() {
        if (this.mode === "orbit") {
            this.mode = "free";
            this.targetYaw = this.yaw;
            this.targetPitch = this.pitch;
            this.say("g.cinema.toast.orbitOff");
            return;
        }

        const cosPitch = Math.cos(this.pitch);
        this.forward.set(-cosPitch * Math.sin(this.yaw), Math.sin(this.pitch), -cosPitch * Math.cos(this.yaw));
        this.orbitTarget.copy(this.position).addScaledVector(this.forward, this.orbitRadius);
        this.orbitAngle = Math.atan2(this.position.x - this.orbitTarget.x, this.position.z - this.orbitTarget.z);
        this.orbitHeight = this.position.y - this.orbitTarget.y;
        this.mode = "orbit";
        this.say("g.cinema.toast.orbitOn");
    }

    private updateOrbit(delta: number, input: InputManager) {
        const multiplier = this.speedMultiplier(input);

        if (input.isKeyPressed("KeyD")) this.orbitSpeed = THREE.MathUtils.clamp(this.orbitSpeed + ORBIT_SPEED_STEP * delta * 10, -MAX_ORBIT_SPEED, MAX_ORBIT_SPEED);
        if (input.isKeyPressed("KeyA")) this.orbitSpeed = THREE.MathUtils.clamp(this.orbitSpeed - ORBIT_SPEED_STEP * delta * 10, -MAX_ORBIT_SPEED, MAX_ORBIT_SPEED);
        if (input.isKeyPressed("KeyW")) this.orbitRadius = THREE.MathUtils.clamp(this.orbitRadius - this.speed * multiplier * delta, MIN_ORBIT_RADIUS, MAX_ORBIT_RADIUS);
        if (input.isKeyPressed("KeyS")) this.orbitRadius = THREE.MathUtils.clamp(this.orbitRadius + this.speed * multiplier * delta, MIN_ORBIT_RADIUS, MAX_ORBIT_RADIUS);
        if (input.isKeyPressed("Space")) this.orbitHeight += this.speed * multiplier * delta;
        if (input.isKeyPressed("ControlLeft") || input.isKeyPressed("ControlRight")) this.orbitHeight -= this.speed * multiplier * delta;

        if (input.isKeyPressed("KeyQ")) this.roll = THREE.MathUtils.clamp(this.roll + ROLL_SPEED * delta, -MAX_ROLL, MAX_ROLL);
        if (input.isKeyPressed("KeyE")) this.roll = THREE.MathUtils.clamp(this.roll - ROLL_SPEED * delta, -MAX_ROLL, MAX_ROLL);

        const movement = input.consumeMouseMovement();
        this.orbitAngle -= movement.x * LOOK_SENSITIVITY;
        this.orbitHeight -= movement.y * LOOK_SENSITIVITY * this.orbitRadius;
        this.orbitAngle += this.orbitSpeed * delta;

        this.position.set(
            this.orbitTarget.x + Math.sin(this.orbitAngle) * this.orbitRadius,
            this.orbitTarget.y + this.orbitHeight,
            this.orbitTarget.z + Math.cos(this.orbitAngle) * this.orbitRadius
        );

        const toTarget = this.wish.subVectors(this.orbitTarget, this.position);
        const flat = Math.hypot(toTarget.x, toTarget.z);
        this.yaw = Math.atan2(-toTarget.x, -toTarget.z);
        this.pitch = Math.atan2(toTarget.y, flat);
        this.targetYaw = this.yaw;
        this.targetPitch = this.pitch;
    }

    private addKeyframe() {
        if (this.keyframes.length >= MAX_KEYFRAMES) {
            this.say("g.cinema.toast.limit", { count: MAX_KEYFRAMES });
            return;
        }

        const previous = this.keyframes[this.keyframes.length - 1];
        this.keyframes.push({
            position: this.position.clone(),
            yaw: previous ? unwrapAngle(previous.yaw, this.yaw) : this.yaw,
            pitch: this.pitch,
            roll: previous ? unwrapAngle(previous.roll, this.roll) : this.roll,
            fov: this.fov,
        });

        this.railCurve = null;
        this.say("g.cinema.toast.frame", { count: this.keyframes.length });
    }

    private clearKeyframes() {
        if (this.keyframes.length === 0) return;
        this.keyframes = [];
        this.railCurve = null;
        if (this.mode === "rail") this.mode = "free";
        this.say("g.cinema.toast.cleared");
    }

    private buildRail(): boolean {
        if (this.keyframes.length < 2) return false;

        this.railCurve = new THREE.CatmullRomCurve3(
            this.keyframes.map((frame) => frame.position.clone()),
            false,
            "catmullrom",
            0.5
        );
        this.railYaw = this.keyframes.map((frame) => frame.yaw);
        this.railPitch = this.keyframes.map((frame) => frame.pitch);
        this.railRoll = this.keyframes.map((frame) => frame.roll);
        this.railFov = this.keyframes.map((frame) => frame.fov);
        return true;
    }

    private toggleRail() {
        if (this.mode === "rail") {
            this.mode = "free";
            this.targetYaw = this.yaw;
            this.targetPitch = this.pitch;
            this.velocity.set(0, 0, 0);
            this.say("g.cinema.toast.railStop");
            return;
        }

        if (!this.buildRail()) {
            this.say("g.cinema.toast.railNeed");
            return;
        }

        this.mode = "rail";
        this.railTime = 0;
        this.say("g.cinema.toast.railStart", { count: this.keyframes.length, seconds: this.railSeconds });
    }

    private updateRail(delta: number, input: InputManager) {
        if (!this.railCurve) {
            this.mode = "free";
            return;
        }

        const multiplier = this.speedMultiplier(input);
        this.railTime += delta * multiplier;

        let progress = this.railTime / this.railSeconds;
        if (progress >= 1) {
            if (this.railLoop) {
                this.railTime = 0;
                progress = 0;
            } else {
                progress = 1;
                this.mode = "free";
                this.targetYaw = this.yaw;
                this.targetPitch = this.pitch;
                this.say("g.cinema.toast.railDone");
            }
        }

        const eased = this.railLoop ? progress : progress * progress * (3 - 2 * progress);
        const last = this.keyframes.length - 1;
        const track = eased * last;

        this.railCurve.getPoint(eased, this.railPoint);
        this.position.copy(this.railPoint);
        this.yaw = sampleScalarTrack(this.railYaw, track);
        this.pitch = THREE.MathUtils.clamp(sampleScalarTrack(this.railPitch, track), -MAX_PITCH, MAX_PITCH);
        this.roll = sampleScalarTrack(this.railRoll, track);
        this.fov = THREE.MathUtils.clamp(sampleScalarTrack(this.railFov, track), MIN_FOV, MAX_FOV);

        const now = performance.now();
        if (now - this.lastPlayEmit > PLAY_EMIT_INTERVAL_MS) {
            this.lastPlayEmit = now;
            this.emit();
        }
    }

    private applyTransform() {
        this.camera.position.copy(this.position);
        this.camera.rotation.set(this.pitch, this.yaw, this.roll, "YXZ");

        if (Math.abs(this.camera.fov - this.fov) > 0.001) {
            this.camera.fov = this.fov;
            this.camera.updateProjectionMatrix();
        }
    }
}
