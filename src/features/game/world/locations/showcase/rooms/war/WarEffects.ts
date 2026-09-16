// src/features/game/world/locations/showcase/rooms/war/WarEffects.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import { flameTexture, smokeTexture, sparkTexture } from "./warTextures";

const TRACER_POOL = 56;
const FLASH_POOL = 24;
const PUFF_POOL = 120;
const BLAST_POOL = 10;
const ROCKET_POOL = 10;
const DEBRIS_POOL = 90;
const BLAST_LIGHTS = 4;

const TRACER_SPEED = 220;
const SHELL_SPEED = 120;

interface Tracer {
    mesh: THREE.Mesh;
    from: THREE.Vector3;
    to: THREE.Vector3;
    life: number;
    duration: number;
    active: boolean;
    impact: boolean;
}

interface Flash {
    sprite: THREE.Sprite;
    life: number;
    active: boolean;
}

interface Puff {
    sprite: THREE.Sprite;
    velocity: THREE.Vector3;
    life: number;
    duration: number;
    size: number;
    growth: number;
    active: boolean;
    fade: number;
}

interface Blast {
    core: THREE.Mesh;
    ring: THREE.Mesh;
    life: number;
    duration: number;
    radius: number;
    active: boolean;
}

interface Rocket {
    group: THREE.Group;
    flame: THREE.Sprite;
    from: THREE.Vector3;
    to: THREE.Vector3;
    life: number;
    duration: number;
    arc: number;
    trailTimer: number;
    radius: number;
    active: boolean;
}

interface Fire {
    group: THREE.Group;
    sheets: THREE.Mesh[];
    light: THREE.PointLight | null;
    scale: number;
    phase: number;
    smokeTimer: number;
}

export class WarEffects {
    private tracers: Tracer[] = [];
    private flashes: Flash[] = [];
    private puffs: Puff[] = [];
    private blasts: Blast[] = [];
    private rockets: Rocket[] = [];
    private fires: Fire[] = [];
    private blastLights: THREE.PointLight[] = [];
    private blastLightLife: number[] = [];

    private debris: THREE.Points | null = null;
    private debrisPositions!: Float32Array;
    private debrisVelocity!: Float32Array;
    private debrisLife!: Float32Array;
    private debrisCursor = 0;
    private pending: Array<{ position: THREE.Vector3; radius: number; delay: number }> = [];

    private flameMap!: THREE.CanvasTexture;
    private smokeMap!: THREE.CanvasTexture;
    private sparkMap!: THREE.CanvasTexture;

    private readonly tmpA = new THREE.Vector3();
    private readonly tmpB = new THREE.Vector3();
    private readonly tmpQuat = new THREE.Quaternion();
    private readonly up = new THREE.Vector3(0, 1, 0);

    constructor(
        private readonly scene: THREE.Scene,
        private readonly bin: AssetBin,
        private readonly random: () => number
    ) { }

    public create() {
        this.flameMap = flameTexture(this.bin);
        this.smokeMap = smokeTexture(this.bin);
        this.sparkMap = sparkTexture(this.bin);

        this.buildTracers();
        this.buildFlashes();
        this.buildPuffs();
        this.buildBlasts();
        this.buildRockets();
        this.buildDebris();

        for (let i = 0; i < BLAST_LIGHTS; i++) {
            const light = new THREE.PointLight(0xffb066, 0, 90, 2);
            light.visible = false;
            this.scene.add(light);
            this.blastLights.push(light);
            this.blastLightLife.push(0);
        }
    }

    private buildTracers() {
        const geometry = this.bin.geometry(new THREE.CylinderGeometry(0.045, 0.045, 1, 5));
        geometry.translate(0, 0.5, 0);

        for (let i = 0; i < TRACER_POOL; i++) {
            const material = this.bin.material(new THREE.MeshBasicMaterial({
                color: 0xffd27a,
                transparent: true,
                opacity: 0.95,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
                fog: false,
            }));

            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;
            mesh.frustumCulled = false;
            this.scene.add(mesh);

            this.tracers.push({
                mesh,
                from: new THREE.Vector3(),
                to: new THREE.Vector3(),
                life: 0,
                duration: 0.1,
                active: false,
                impact: true,
            });
        }
    }

    private buildFlashes() {
        for (let i = 0; i < FLASH_POOL; i++) {
            const material = this.bin.material(new THREE.SpriteMaterial({
                map: this.flameMap,
                color: 0xffd9a0,
                transparent: true,
                opacity: 0.95,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
                fog: false,
            }));

            const sprite = new THREE.Sprite(material);
            sprite.visible = false;
            sprite.frustumCulled = false;
            this.scene.add(sprite);

            this.flashes.push({ sprite, life: 0, active: false });
        }
    }

    private buildPuffs() {
        for (let i = 0; i < PUFF_POOL; i++) {
            const material = this.bin.material(new THREE.SpriteMaterial({
                map: this.smokeMap,
                color: 0x8a8377,
                transparent: true,
                opacity: 0.5,
                depthWrite: false,
                toneMapped: false,
                fog: true,
            }));

            const sprite = new THREE.Sprite(material);
            sprite.visible = false;
            sprite.frustumCulled = false;
            this.scene.add(sprite);

            this.puffs.push({
                sprite,
                velocity: new THREE.Vector3(),
                life: 0,
                duration: 1,
                size: 1,
                growth: 1,
                active: false,
                fade: 0.5,
            });
        }
    }

    private buildBlasts() {
        const coreGeometry = this.bin.geometry(new THREE.IcosahedronGeometry(1, 2));
        const ringGeometry = this.bin.geometry(new THREE.TorusGeometry(1, 0.09, 6, 28));

        for (let i = 0; i < BLAST_POOL; i++) {
            const coreMaterial = this.bin.material(new THREE.MeshBasicMaterial({
                color: 0xffb45a,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
                fog: false,
            }));
            const ringMaterial = this.bin.material(new THREE.MeshBasicMaterial({
                color: 0xffe0b0,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
                toneMapped: false,
                fog: false,
            }));

            const core = new THREE.Mesh(coreGeometry, coreMaterial);
            core.visible = false;
            core.frustumCulled = false;
            this.scene.add(core);

            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = -Math.PI / 2;
            ring.visible = false;
            ring.frustumCulled = false;
            this.scene.add(ring);

            this.blasts.push({ core, ring, life: 0, duration: 1, radius: 4, active: false });
        }
    }

    private buildRockets() {
        const bodyGeometry = this.bin.geometry(new THREE.CylinderGeometry(0.17, 0.2, 1.4, 8));
        const noseGeometry = this.bin.geometry(new THREE.ConeGeometry(0.2, 0.55, 8));
        const finGeometry = this.bin.geometry(new THREE.BoxGeometry(0.05, 0.34, 0.3));

        const bodyMaterial = this.bin.material(new THREE.MeshStandardMaterial({ color: 0x6d6a63, roughness: 0.55, metalness: 0.5 }));
        const noseMaterial = this.bin.material(new THREE.MeshStandardMaterial({ color: 0xb4463a, roughness: 0.5, metalness: 0.3 }));

        for (let i = 0; i < ROCKET_POOL; i++) {
            const group = new THREE.Group();
            group.visible = false;

            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            body.rotation.x = Math.PI / 2;
            group.add(body);

            const nose = new THREE.Mesh(noseGeometry, noseMaterial);
            nose.rotation.x = Math.PI / 2;
            nose.position.z = 0.95;
            group.add(nose);

            for (let f = 0; f < 4; f++) {
                const fin = new THREE.Mesh(finGeometry, bodyMaterial);
                fin.position.z = -0.6;
                fin.rotation.z = (f / 4) * Math.PI * 2;
                fin.position.x = Math.cos((f / 4) * Math.PI * 2) * 0.2;
                fin.position.y = Math.sin((f / 4) * Math.PI * 2) * 0.2;
                group.add(fin);
            }

            const flameMaterial = this.bin.material(new THREE.SpriteMaterial({
                map: this.flameMap,
                color: 0xffb45a,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
                fog: false,
            }));
            const flame = new THREE.Sprite(flameMaterial);
            flame.scale.setScalar(1.5);
            flame.position.z = -1.1;
            group.add(flame);

            this.scene.add(group);

            this.rockets.push({
                group,
                flame,
                from: new THREE.Vector3(),
                to: new THREE.Vector3(),
                life: 0,
                duration: 2,
                arc: 12,
                trailTimer: 0,
                radius: 6,
                active: false,
            });
        }
    }

    private buildDebris() {
        this.debrisPositions = new Float32Array(DEBRIS_POOL * 3);
        this.debrisVelocity = new Float32Array(DEBRIS_POOL * 3);
        this.debrisLife = new Float32Array(DEBRIS_POOL);

        for (let i = 0; i < DEBRIS_POOL; i++) this.debrisPositions[i * 3 + 1] = -1000;

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(this.debrisPositions, 3));

        const material = this.bin.material(new THREE.PointsMaterial({
            map: this.sparkMap,
            color: 0xffb060,
            size: 0.5,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        this.scene.add(points);
        this.debris = points;
    }

    public spawnTracer(from: THREE.Vector3, to: THREE.Vector3, color: number, impact = true) {
        const tracer = this.tracers.find((entry) => !entry.active);
        if (!tracer) return;

        tracer.from.copy(from);
        tracer.to.copy(to);
        tracer.life = 0;
        tracer.duration = Math.max(0.05, from.distanceTo(to) / TRACER_SPEED);
        tracer.active = true;
        tracer.impact = impact;
        tracer.mesh.visible = true;
        (tracer.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);

        const length = from.distanceTo(to);
        tracer.mesh.scale.set(1, Math.min(8, length * 0.35), 1);
    }

    public spawnFlash(position: THREE.Vector3, size = 1.1, color = 0xffd9a0) {
        const flash = this.flashes.find((entry) => !entry.active);
        if (!flash) return;

        flash.sprite.position.copy(position);
        flash.sprite.scale.setScalar(size * (0.85 + this.random() * 0.4));
        flash.sprite.material.rotation = this.random() * Math.PI * 2;
        (flash.sprite.material as THREE.SpriteMaterial).color.setHex(color);
        flash.sprite.visible = true;
        flash.life = 0;
        flash.active = true;
    }

    public spawnPuff(position: THREE.Vector3, size: number, rise: number, duration: number, color = 0x8a8377, fade = 0.55) {
        const puff = this.puffs.find((entry) => !entry.active);
        if (!puff) return;

        puff.sprite.position.copy(position);
        puff.velocity.set((this.random() - 0.5) * 0.9, rise, (this.random() - 0.5) * 0.9);
        puff.size = size;
        puff.growth = size * (1.4 + this.random() * 1.2);
        puff.life = 0;
        puff.duration = duration;
        puff.fade = fade;
        puff.active = true;
        puff.sprite.visible = true;
        puff.sprite.scale.setScalar(size);
        (puff.sprite.material as THREE.SpriteMaterial).color.setHex(color);
        puff.sprite.material.rotation = this.random() * Math.PI * 2;
    }

    public spawnImpact(position: THREE.Vector3, scale = 1) {
        this.spawnPuff(position, 0.7 * scale, 0.9, 0.8, 0x9c9182, 0.5);
        this.spawnFlash(position, 0.5 * scale, 0xffc98a);
        this.spawnDebris(position, 4, 3.5 * scale);
    }

    public spawnDebris(position: THREE.Vector3, count: number, speed: number) {
        for (let i = 0; i < count; i++) {
            const index = this.debrisCursor % DEBRIS_POOL;
            this.debrisCursor++;

            this.debrisPositions[index * 3] = position.x;
            this.debrisPositions[index * 3 + 1] = position.y;
            this.debrisPositions[index * 3 + 2] = position.z;

            this.debrisVelocity[index * 3] = (this.random() - 0.5) * speed;
            this.debrisVelocity[index * 3 + 1] = speed * (0.4 + this.random() * 0.9);
            this.debrisVelocity[index * 3 + 2] = (this.random() - 0.5) * speed;

            this.debrisLife[index] = 0.7 + this.random() * 0.9;
        }
    }

    public spawnExplosion(position: THREE.Vector3, radius = 5) {
        const blast = this.blasts.find((entry) => !entry.active);
        if (blast) {
            blast.core.position.copy(position);
            blast.ring.position.set(position.x, position.y + 0.3, position.z);
            blast.core.visible = true;
            blast.ring.visible = true;
            blast.life = 0;
            blast.duration = 0.65 + radius * 0.04;
            blast.radius = radius;
            blast.active = true;
        }

        for (let i = 0; i < BLAST_LIGHTS; i++) {
            if (this.blastLightLife[i] > 0) continue;
            this.blastLights[i].position.set(position.x, position.y + radius * 0.4, position.z);
            this.blastLights[i].visible = true;
            this.blastLightLife[i] = 0.4;
            break;
        }

        const puffs = Math.min(9, 3 + Math.round(radius * 0.7));
        for (let i = 0; i < puffs; i++) {
            this.tmpA.set(
                position.x + (this.random() - 0.5) * radius,
                position.y + this.random() * radius * 0.5,
                position.z + (this.random() - 0.5) * radius
            );
            this.spawnPuff(this.tmpA, radius * (0.5 + this.random() * 0.5), 1.6 + this.random() * 2, 2.4 + this.random() * 1.6, 0x6f6862, 0.55);
        }

        this.spawnDebris(position, 14, radius * 2.4);
    }

    public spawnShell(from: THREE.Vector3, to: THREE.Vector3, radius = 6) {
        this.spawnFlash(from, 2.6, 0xffd9a0);
        this.spawnPuff(from, 2.2, 0.8, 1.6, 0x9a9186, 0.5);
        this.spawnTracer(from, to, 0xfff0c0, false);

        this.pending.push({
            position: to.clone(),
            radius,
            delay: Math.min(1.2, from.distanceTo(to) / SHELL_SPEED),
        });
    }

    public spawnRocket(from: THREE.Vector3, to: THREE.Vector3, arc = 14, radius = 7) {
        const rocket = this.rockets.find((entry) => !entry.active);
        if (!rocket) {
            this.spawnExplosion(to, radius);
            return;
        }

        rocket.from.copy(from);
        rocket.to.copy(to);
        rocket.life = 0;
        rocket.duration = Math.max(1.1, from.distanceTo(to) / 42);
        rocket.arc = arc;
        rocket.radius = radius;
        rocket.trailTimer = 0;
        rocket.active = true;
        rocket.group.visible = true;
        rocket.group.position.copy(from);

        this.spawnFlash(from, 2.2, 0xffb45a);
        this.spawnPuff(from, 2.4, 0.6, 1.8, 0x8d857c, 0.5);
    }

    public addFire(position: THREE.Vector3, scale = 1, withLight = true): Fire {
        const group = new THREE.Group();
        group.position.copy(position);

        const sheets: THREE.Mesh[] = [];
        const geometry = this.bin.geometry(new THREE.PlaneGeometry(1.2, 1.8));

        for (let i = 0; i < 3; i++) {
            const material = this.bin.material(new THREE.MeshBasicMaterial({
                map: this.flameMap,
                color: i === 0 ? 0xffd08a : 0xff9a3c,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
                toneMapped: false,
                fog: false,
            }));

            const sheet = new THREE.Mesh(geometry, material);
            sheet.position.y = 0.9 * scale;
            sheet.rotation.y = (i / 3) * Math.PI;
            sheet.scale.setScalar(scale);
            group.add(sheet);
            sheets.push(sheet);
        }

        const base = new THREE.Mesh(
            this.bin.geometry(new THREE.CircleGeometry(1.1, 18)),
            this.bin.material(new THREE.MeshBasicMaterial({
                map: this.flameMap,
                color: 0xff8a3a,
                transparent: true,
                opacity: 0.5,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
                fog: false,
            }))
        );
        base.rotation.x = -Math.PI / 2;
        base.position.y = 0.05;
        base.scale.setScalar(scale);
        group.add(base);

        let light: THREE.PointLight | null = null;
        if (withLight) {
            light = new THREE.PointLight(0xff7a2a, 14 * scale, 20 * scale, 2);
            light.position.y = 1.2 * scale;
            group.add(light);
        }

        this.scene.add(group);

        const fire: Fire = { group, sheets, light, scale, phase: this.random() * 9, smokeTimer: this.random() };
        this.fires.push(fire);
        return fire;
    }

    private updateTracers(delta: number) {
        for (const tracer of this.tracers) {
            if (!tracer.active) continue;

            tracer.life += delta;
            const t = tracer.life / tracer.duration;

            if (t >= 1) {
                tracer.active = false;
                tracer.mesh.visible = false;
                if (tracer.impact && this.random() < 0.45) this.spawnImpact(tracer.to, 0.8);
                continue;
            }

            this.tmpA.lerpVectors(tracer.from, tracer.to, t);
            this.tmpB.subVectors(tracer.to, tracer.from).normalize();
            tracer.mesh.position.copy(this.tmpA);
            tracer.mesh.quaternion.setFromUnitVectors(this.up, this.tmpB);
        }
    }

    private updateFlashes(delta: number) {
        for (const flash of this.flashes) {
            if (!flash.active) continue;

            flash.life += delta;
            if (flash.life > 0.08) {
                flash.active = false;
                flash.sprite.visible = false;
                continue;
            }

            const fade = 1 - flash.life / 0.08;
            (flash.sprite.material as THREE.SpriteMaterial).opacity = fade;
        }
    }

    private updatePuffs(delta: number) {
        for (const puff of this.puffs) {
            if (!puff.active) continue;

            puff.life += delta;
            const t = puff.life / puff.duration;

            if (t >= 1) {
                puff.active = false;
                puff.sprite.visible = false;
                continue;
            }

            puff.sprite.position.addScaledVector(puff.velocity, delta);
            puff.sprite.scale.setScalar(puff.size + (puff.growth - puff.size) * t);
            (puff.sprite.material as THREE.SpriteMaterial).opacity = puff.fade * (1 - t * t);
            puff.sprite.material.rotation += delta * 0.2;
        }
    }

    private updateBlasts(delta: number) {
        for (const blast of this.blasts) {
            if (!blast.active) continue;

            blast.life += delta;
            const t = blast.life / blast.duration;

            if (t >= 1) {
                blast.active = false;
                blast.core.visible = false;
                blast.ring.visible = false;
                continue;
            }

            const grow = Math.pow(t, 0.45);
            blast.core.scale.setScalar(blast.radius * grow * 0.85);
            blast.ring.scale.setScalar(blast.radius * grow * 1.7);
            (blast.core.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - t);
            (blast.ring.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t * t);
        }

        for (let i = 0; i < this.blastLights.length; i++) {
            if (this.blastLightLife[i] <= 0) continue;
            this.blastLightLife[i] -= delta;
            const factor = Math.max(0, this.blastLightLife[i] / 0.4);
            this.blastLights[i].intensity = 420 * factor;
            if (this.blastLightLife[i] <= 0) this.blastLights[i].visible = false;
        }
    }

    private updateRockets(delta: number) {
        for (const rocket of this.rockets) {
            if (!rocket.active) continue;

            rocket.life += delta;
            const t = rocket.life / rocket.duration;

            if (t >= 1) {
                rocket.active = false;
                rocket.group.visible = false;
                this.spawnExplosion(rocket.to, rocket.radius);
                continue;
            }

            this.tmpA.lerpVectors(rocket.from, rocket.to, t);
            this.tmpA.y += Math.sin(t * Math.PI) * rocket.arc;

            const previous = Math.max(0, t - 0.03);
            this.tmpB.lerpVectors(rocket.from, rocket.to, previous);
            this.tmpB.y += Math.sin(previous * Math.PI) * rocket.arc;

            rocket.group.position.copy(this.tmpA);
            this.tmpB.subVectors(this.tmpA, this.tmpB).normalize();
            rocket.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.tmpB);

            rocket.flame.scale.setScalar(1.3 + Math.sin(rocket.life * 40) * 0.35);

            rocket.trailTimer -= delta;
            if (rocket.trailTimer <= 0) {
                rocket.trailTimer = 0.035;
                this.spawnPuff(rocket.group.position, 0.9, 0.35, 1.9, 0x9a938a, 0.45);
            }
        }
    }

    private updateDebris(delta: number) {
        if (!this.debris) return;

        let dirty = false;
        for (let i = 0; i < DEBRIS_POOL; i++) {
            if (this.debrisLife[i] <= 0) continue;

            this.debrisLife[i] -= delta;
            dirty = true;

            if (this.debrisLife[i] <= 0) {
                this.debrisPositions[i * 3 + 1] = -1000;
                continue;
            }

            this.debrisVelocity[i * 3 + 1] -= 18 * delta;
            this.debrisPositions[i * 3] += this.debrisVelocity[i * 3] * delta;
            this.debrisPositions[i * 3 + 1] += this.debrisVelocity[i * 3 + 1] * delta;
            this.debrisPositions[i * 3 + 2] += this.debrisVelocity[i * 3 + 2] * delta;
        }

        if (dirty) {
            (this.debris.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
        }
    }

    private updateFires(delta: number, elapsed: number) {
        for (const fire of this.fires) {
            const flicker = 0.82 + Math.sin(elapsed * 9 + fire.phase) * 0.12 + Math.sin(elapsed * 21 + fire.phase * 2) * 0.06;

            for (let i = 0; i < fire.sheets.length; i++) {
                const sheet = fire.sheets[i];
                const wobble = Math.sin(elapsed * (7 + i * 2.3) + fire.phase + i) * 0.1;
                sheet.scale.set(
                    fire.scale * (0.9 + wobble),
                    fire.scale * (flicker + wobble * 0.4),
                    fire.scale
                );
                sheet.position.y = fire.scale * (0.85 + wobble * 0.25);
                sheet.rotation.y += delta * (0.35 + i * 0.12);
                (sheet.material as THREE.MeshBasicMaterial).opacity = 0.75 + Math.sin(elapsed * 13 + i * 2 + fire.phase) * 0.2;
            }

            if (fire.light) fire.light.intensity = 12 * fire.scale * flicker;

            fire.smokeTimer -= delta;
            if (fire.smokeTimer <= 0) {
                fire.smokeTimer = 1.3 + this.random() * 1.4;
                this.tmpA.set(
                    fire.group.position.x + (this.random() - 0.5) * fire.scale,
                    fire.group.position.y + fire.scale * 1.6,
                    fire.group.position.z + (this.random() - 0.5) * fire.scale
                );
                this.spawnPuff(this.tmpA, fire.scale * 1.2, 1.8 + this.random(), 3.4, 0x5e574f, 0.4);
            }
        }
    }

    private updatePending(delta: number) {
        for (let i = this.pending.length - 1; i >= 0; i--) {
            const entry = this.pending[i];
            entry.delay -= delta;
            if (entry.delay > 0) continue;

            this.spawnExplosion(entry.position, entry.radius);
            this.pending.splice(i, 1);
        }
    }

    public update(delta: number, elapsed: number) {
        this.updatePending(delta);
        this.updateTracers(delta);
        this.updateFlashes(delta);
        this.updatePuffs(delta);
        this.updateBlasts(delta);
        this.updateRockets(delta);
        this.updateDebris(delta);
        this.updateFires(delta, elapsed);
    }
}
