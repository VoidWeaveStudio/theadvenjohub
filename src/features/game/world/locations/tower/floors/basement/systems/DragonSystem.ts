// src/features/game/world/locations/tower/floors/basement/systems/DragonSystem.ts
import * as THREE from "three";
import { PointsDragon } from "../../../../../../entities/PointsDragon";

const PLATFORM_CLEARANCE = 45;
const MAX_ORBIT_RADIUS = 300;
const MIN_FLIGHT_Y = -120;
const MAX_FLIGHT_Y = 160;
const CONTROL_POINTS = 16;
const CURVE_SAMPLES = 900;
const FLIGHT_SPEED = 30;
const WAVE_AMPLITUDE = 9;
const WAVE_FREQUENCY = 0.34;
const ROLL_AMPLITUDE = 0.42;

export class DragonSystem {
    private readonly dragon: PointsDragon;
    private readonly samples: THREE.Vector3[] = [];
    private readonly tangents: THREE.Vector3[] = [];

    private readonly minOrbitRadius: number;
    private curveLength = 1;
    private headDistance = 0;
    private elapsed = 0;

    private readonly _pos = new THREE.Vector3();
    private readonly _target = new THREE.Vector3();
    private readonly _tangent = new THREE.Vector3();
    private readonly _normal = new THREE.Vector3();
    private readonly _binormal = new THREE.Vector3();
    private readonly _up = new THREE.Vector3(0, 1, 0);
    private readonly _matrix = new THREE.Matrix4();
    private readonly _quat = new THREE.Quaternion();
    private readonly _roll = new THREE.Quaternion();

    constructor(private readonly scene: THREE.Scene, platformRadius: number) {
        this.minOrbitRadius = platformRadius + PLATFORM_CLEARANCE;
        this.dragon = new PointsDragon({ segments: 96, bodyRadius: 3.4, segmentSpacing: 1.6, density: 46 });
        this.buildPath();
        this.scene.add(this.dragon.object);
        this.update(0);
    }

    private buildPath() {
        const handles: THREE.Vector3[] = [];

        for (let i = 0; i < CONTROL_POINTS; i++) {
            const angle = (i / CONTROL_POINTS) * Math.PI * 2;
            const inward = i % 2 === 0;
            const span = MAX_ORBIT_RADIUS - this.minOrbitRadius;
            const radius = inward
                ? this.minOrbitRadius + 10 + Math.random() * span * 0.25
                : this.minOrbitRadius + span * 0.55 + Math.random() * span * 0.45;
            const y = i % 3 === 0
                ? MAX_FLIGHT_Y - Math.random() * 60
                : i % 3 === 1
                    ? MIN_FLIGHT_Y + Math.random() * 60
                    : (MIN_FLIGHT_Y + MAX_FLIGHT_Y) * 0.5 + (Math.random() - 0.5) * 70;

            handles.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
        }

        const curve = new THREE.CatmullRomCurve3(handles, true, "centripetal", 0.5);

        const points = curve.getSpacedPoints(CURVE_SAMPLES);
        let closest = Infinity;
        for (const point of points) {
            closest = Math.min(closest, Math.hypot(point.x, point.z));
        }

        if (closest < this.minOrbitRadius) {
            const correction = this.minOrbitRadius - closest + 6;
            for (const handle of handles) {
                const planar = Math.hypot(handle.x, handle.z) || 1;
                handle.x *= (planar + correction) / planar;
                handle.z *= (planar + correction) / planar;
            }
        }

        const finalCurve = new THREE.CatmullRomCurve3(handles, true, "centripetal", 0.5);
        this.curveLength = finalCurve.getLength();

        const finalPoints = finalCurve.getSpacedPoints(CURVE_SAMPLES);
        for (let i = 0; i < CURVE_SAMPLES; i++) {
            this.samples.push(finalPoints[i]);
            this.tangents.push(finalCurve.getTangentAt(i / CURVE_SAMPLES).normalize());
        }
    }

    private sampleAt(distance: number, outPos: THREE.Vector3, outTangent: THREE.Vector3) {
        const count = this.samples.length;
        const normalized = ((distance % this.curveLength) + this.curveLength) % this.curveLength;
        const scaled = (normalized / this.curveLength) * count;

        const index = Math.floor(scaled) % count;
        const next = (index + 1) % count;
        const blend = scaled - Math.floor(scaled);

        outPos.copy(this.samples[index]).lerp(this.samples[next], blend);
        outTangent.copy(this.tangents[index]).lerp(this.tangents[next], blend).normalize();
    }

    update(delta: number) {
        this.elapsed += delta;
        this.headDistance += FLIGHT_SPEED * delta;

        const segments = this.dragon.segments;
        const spacing = this.dragon.segmentSpacing;

        for (let i = 0; i < segments; i++) {
            const distance = this.headDistance - i * spacing;
            this.sampleAt(distance, this._pos, this._tangent);

            this._binormal.crossVectors(this._tangent, this._up).normalize();
            this._normal.crossVectors(this._binormal, this._tangent).normalize();

            const along = i / segments;
            const taper = 0.25 + along * 1.35;
            const phase = this.elapsed * 2.1 - i * WAVE_FREQUENCY;

            const swing = Math.sin(phase) * WAVE_AMPLITUDE * taper;
            const lift = Math.cos(phase * 0.55) * WAVE_AMPLITUDE * 0.5 * taper;

            this._pos.addScaledVector(this._binormal, swing);
            this._pos.addScaledVector(this._normal, lift);

            this._target.copy(this._pos).add(this._tangent);
            this._matrix.lookAt(this._pos, this._target, this._normal);
            this._quat.setFromRotationMatrix(this._matrix);

            this._roll.setFromAxisAngle(this._tangent, Math.sin(phase * 0.8) * ROLL_AMPLITUDE * taper);
            this._quat.premultiply(this._roll);

            this.dragon.setSegmentTransform(i, this._pos, this._quat);
        }

        this.dragon.commitSpine(this.elapsed);
    }

    dispose() {
        this.dragon.dispose();
    }
}
