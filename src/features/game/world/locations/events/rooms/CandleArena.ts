// src/features/game/world/locations/events/rooms/CandleArena.ts
import * as THREE from "three";
import { EventRoom } from "../EventRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { ARENA_ALTAR_INTERACTION } from "../../../../data/eventDoors";
import { EVENT_ROOM_THEMES_BY_ID } from "../roomThemes";

const ALTAR_RADIUS = 6;
const ALTAR_HEIGHT = 1.1;
const CANDLE_BASE_HEIGHT = 4.2;
const GATE_RADIUS = 46;
const GATE_ANGLES = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
const BRAZIER_RADIUS = 34;

interface Brazier {
    flame: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    light: THREE.PointLight;
    phase: number;
}

interface SpawnGate {
    veil: THREE.MeshBasicMaterial;
    phase: number;
}

export class CandleArena extends EventRoom {
    private static readonly scratchColor = new THREE.Color();

    private braziers: Brazier[] = [];
    private gates: SpawnGate[] = [];

    private altarGroup: THREE.Group | null = null;
    private candle: THREE.Group | null = null;
    private candleBody: THREE.Mesh | null = null;
    private candleMaterial: THREE.MeshStandardMaterial | null = null;
    private flameInner: THREE.Mesh | null = null;
    private flameOuter: THREE.Mesh | null = null;
    private flameHalo: THREE.Mesh | null = null;
    private flameLight: THREE.PointLight | null = null;
    private runeMaterial: THREE.MeshBasicMaterial | null = null;
    private wax: THREE.Mesh[] = [];

    private candleHealthRatio = 1;
    private candleWave = 0;
    private candleFlash = 0;


    constructor() {
        super(EVENT_ROOM_THEMES_BY_ID.get("arena")!, 0x5ad39b);
    }

    protected decorate(_rm: ResourceManager): void {
        this.buildColonnade();
        this.buildRubble();
        this.buildAltar();
        this.buildCandle();
        this.buildSpawnGates();
        this.buildBraziers();
    }

    private buildColonnade() {
        const stone = this.bin.material(new THREE.MeshStandardMaterial({
            color: this.theme.propColor,
            roughness: 0.9,
            metalness: 0.04,
        }));
        const shaft = this.bin.geometry(new THREE.CylinderGeometry(1.5, 1.7, 1, 12));
        const drum = this.bin.geometry(new THREE.CylinderGeometry(1.6, 1.6, 1, 12));
        const count = this.theme.propCount;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.PI / count;
            const radius = this.theme.radius - 10;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const broken = i % 3 === 1;
            const height = broken ? 5 + this.random() * 5 : this.theme.wallHeight - 4;

            const column = new THREE.Mesh(shaft, stone);
            column.scale.set(1, height, 1);
            column.position.set(x, height / 2, z);
            column.rotation.y = this.random() * Math.PI;
            column.castShadow = true;
            column.receiveShadow = true;
            this.scene.add(column);

            this.collisionGrid.insertCylinder(new THREE.Vector3(x, height / 2, z), 1.85, height);

            if (broken) {
                const fallen = new THREE.Mesh(shaft, stone);
                const length = 6 + this.random() * 5;
                fallen.scale.set(0.9, length, 0.9);
                fallen.position.set(x - Math.cos(angle) * 3.5, 1.4, z - Math.sin(angle) * 3.5);
                fallen.rotation.z = Math.PI / 2;
                fallen.rotation.y = angle;
                fallen.castShadow = true;
                this.scene.add(fallen);
                continue;
            }

            const capital = new THREE.Mesh(drum, stone);
            capital.scale.set(1.35, 1.1, 1.35);
            capital.position.set(x, height + 0.55, z);
            capital.castShadow = true;
            this.scene.add(capital);

            const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 6.5), stone);
            lintel.position.set(x, height + 1.4, z);
            lintel.rotation.y = -angle;
            lintel.castShadow = true;
            this.scene.add(lintel);
        }
    }

    private buildRubble() {
        const stone = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x453b31,
            roughness: 0.98,
            metalness: 0.02,
        }));
        const chunk = this.bin.geometry(new THREE.DodecahedronGeometry(1, 0));

        for (let i = 0; i < 44; i++) {
            const angle = this.random() * Math.PI * 2;
            const radius = ALTAR_RADIUS + 7 + this.random() * (this.theme.radius - 22);
            const rock = new THREE.Mesh(chunk, stone);
            rock.scale.setScalar(0.5 + this.random() * 1.7);
            rock.position.set(Math.cos(angle) * radius, 0.2 + this.random() * 0.4, Math.sin(angle) * radius);
            rock.rotation.set(this.random() * 6, this.random() * 6, this.random() * 6);
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
        }
    }

    private buildAltar() {
        const group = new THREE.Group();
        const stepMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x584a3a,
            roughness: 0.86,
            metalness: 0.06,
        }));
        const gold = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xc9a961,
            roughness: 0.3,
            metalness: 0.9,
        }));

        const stepHeight = ALTAR_HEIGHT / 3;
        for (let i = 0; i < 3; i++) {
            const half = ALTAR_RADIUS + i * 1.5;
            const top = ALTAR_HEIGHT - i * stepHeight;

            const step = new THREE.Mesh(new THREE.CylinderGeometry(half, half + 0.3, stepHeight, 40), stepMaterial);
            step.position.y = top - stepHeight / 2;
            step.receiveShadow = true;
            step.castShadow = true;
            group.add(step);

            this.collisionGrid.insertPlatform(0, half + 0.3, top - stepHeight, top);
        }

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.5, 8), gold);
            post.position.set(Math.cos(angle) * (ALTAR_RADIUS - 0.7), ALTAR_HEIGHT + 0.75, Math.sin(angle) * (ALTAR_RADIUS - 0.7));
            group.add(post);

            const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), gold);
            cap.position.set(Math.cos(angle) * (ALTAR_RADIUS - 0.7), ALTAR_HEIGHT + 1.65, Math.sin(angle) * (ALTAR_RADIUS - 0.7));
            group.add(cap);
        }

        this.runeMaterial = this.bin.material(new THREE.MeshBasicMaterial({
            color: this.theme.accent,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        }));

        const runes = new THREE.Mesh(new THREE.RingGeometry(ALTAR_RADIUS - 1.7, ALTAR_RADIUS - 0.6, 48), this.runeMaterial);
        runes.rotation.x = -Math.PI / 2;
        runes.position.y = ALTAR_HEIGHT + 0.02;
        group.add(runes);

        const outerRunes = new THREE.Mesh(new THREE.RingGeometry(ALTAR_RADIUS + 4.6, ALTAR_RADIUS + 5.4, 64), this.runeMaterial);
        outerRunes.rotation.x = -Math.PI / 2;
        outerRunes.position.y = 0.05;
        group.add(outerRunes);

        group.userData.interactionId = ARENA_ALTAR_INTERACTION;
        group.userData.interactionRadius = 9;

        this.scene.add(group);
        this.altarGroup = group;
    }

    private buildCandle() {
        this.candle = new THREE.Group();
        this.candle.position.set(0, ALTAR_HEIGHT, 0);

        this.candleMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x86efac,
            emissive: 0x22c55e,
            emissiveIntensity: 0.9,
            roughness: 0.35,
            metalness: 0.05,
            toneMapped: false,
        }));

        this.candleBody = new THREE.Mesh(
            new THREE.CylinderGeometry(1.15, 1.35, CANDLE_BASE_HEIGHT, 20),
            this.candleMaterial
        );
        this.candleBody.position.y = CANDLE_BASE_HEIGHT / 2;
        this.candleBody.castShadow = true;
        this.candle.add(this.candleBody);

        for (let i = 0; i < 7; i++) {
            const angle = (i / 7) * Math.PI * 2 + this.random();
            const drip = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.16, 0.7 + this.random() * 1.1, 4, 8),
                this.candleMaterial
            );
            drip.position.set(
                Math.cos(angle) * 1.18,
                CANDLE_BASE_HEIGHT - 0.7 - this.random() * 0.8,
                Math.sin(angle) * 1.18
            );
            this.candle.add(drip);
            this.wax.push(drip);
        }

        const wick = new THREE.Mesh(
            new THREE.CylinderGeometry(0.07, 0.05, 0.6, 6),
            this.bin.material(new THREE.MeshBasicMaterial({ color: 0x2a2018, toneMapped: false }))
        );
        wick.position.y = CANDLE_BASE_HEIGHT + 0.3;
        this.candle.add(wick);

        this.flameOuter = new THREE.Mesh(
            new THREE.ConeGeometry(0.75, 2.6, 12),
            this.bin.material(new THREE.MeshBasicMaterial({
                color: 0x4ade80,
                transparent: true,
                opacity: 0.45,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            }))
        );
        this.flameOuter.position.y = CANDLE_BASE_HEIGHT + 1.7;
        this.candle.add(this.flameOuter);

        this.flameInner = new THREE.Mesh(
            new THREE.ConeGeometry(0.36, 1.5, 10),
            this.bin.material(new THREE.MeshBasicMaterial({
                color: 0xeafff2,
                transparent: true,
                opacity: 0.95,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            }))
        );
        this.flameInner.position.y = CANDLE_BASE_HEIGHT + 1.25;
        this.candle.add(this.flameInner);

        this.flameHalo = new THREE.Mesh(
            new THREE.SphereGeometry(3.4, 16, 12),
            this.bin.material(new THREE.MeshBasicMaterial({
                color: 0x4ade80,
                transparent: true,
                opacity: 0.16,
                depthWrite: false,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            }))
        );
        this.flameHalo.position.y = CANDLE_BASE_HEIGHT + 1.4;
        this.candle.add(this.flameHalo);

        this.flameLight = new THREE.PointLight(0x4ade80, 30, 70, 2);
        this.flameLight.position.y = CANDLE_BASE_HEIGHT + 1.6;
        this.candle.add(this.flameLight);

        this.scene.add(this.candle);

        this.collisionGrid.insertCylinder(
            new THREE.Vector3(0, (ALTAR_HEIGHT + CANDLE_BASE_HEIGHT) / 2, 0),
            1.5,
            ALTAR_HEIGHT + CANDLE_BASE_HEIGHT
        );
    }

    private buildSpawnGates() {
        const frame = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x2a1f30,
            roughness: 0.78,
            metalness: 0.34,
        }));

        for (const angle of GATE_ANGLES) {
            const group = new THREE.Group();
            group.position.set(Math.sin(angle) * GATE_RADIUS, 0, -Math.cos(angle) * GATE_RADIUS);
            group.rotation.y = -angle;

            const arch = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.55, 10, 26, Math.PI), frame);
            arch.position.y = 0.1;
            arch.castShadow = true;
            group.add(arch);

            for (const side of [-1, 1]) {
                const jamb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 6.6, 1.4), frame);
                jamb.position.set(side * 4.5, 3.3, 0);
                jamb.castShadow = true;
                group.add(jamb);
            }

            const veilMaterial = this.bin.material(new THREE.MeshBasicMaterial({
                color: 0x8b5cf6,
                transparent: true,
                opacity: 0.36,
                depthWrite: false,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            }));

            const veil = new THREE.Mesh(new THREE.CircleGeometry(4.2, 26, 0, Math.PI), veilMaterial);
            veil.position.y = 0.1;
            group.add(veil);

            const sill = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 2.4), frame);
            sill.position.set(0, 0.15, 0.6);
            group.add(sill);

            this.scene.add(group);
            this.gates.push({ veil: veilMaterial, phase: this.random() * Math.PI * 2 });
        }
    }

    private buildBraziers() {
        const metal = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x2e2620,
            roughness: 0.7,
            metalness: 0.46,
        }));

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const x = Math.cos(angle) * BRAZIER_RADIUS;
            const z = Math.sin(angle) * BRAZIER_RADIUS;

            const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.9, 3, 10), metal);
            stand.position.set(x, 1.5, z);
            stand.castShadow = true;
            this.scene.add(stand);

            const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 0.55, 0.8, 14), metal);
            bowl.position.set(x, 3.3, z);
            bowl.castShadow = true;
            this.scene.add(bowl);

            const flameMaterial = this.bin.material(new THREE.MeshBasicMaterial({
                color: 0xff9a4a,
                transparent: true,
                opacity: 0.85,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            }));

            const flame = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.2, 10), flameMaterial);
            flame.position.set(x, 4.6, z);
            this.scene.add(flame);

            const light = new THREE.PointLight(0xff9a4a, 16, 36, 2);
            light.position.set(x, 4.8, z);
            this.scene.add(light);

            this.braziers.push({ flame, material: flameMaterial, light, phase: this.random() * Math.PI * 2 });
            this.collisionGrid.insertCylinder(new THREE.Vector3(x, 1.7, z), 1.1, 3.4);
        }
    }

    public override getInteractables(): THREE.Object3D[] {
        const base = super.getInteractables();
        return this.altarGroup ? [...base, this.altarGroup] : base;
    }

    public setCandleState(healthRatio: number, wave: number) {
        this.candleHealthRatio = Math.max(0, Math.min(1, healthRatio));
        this.candleWave = wave;
    }

    public flashCandle() {
        this.candleFlash = 1;
    }

    override update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        const now = this.time;

        for (const brazier of this.braziers) {
            const flicker = 0.75 + Math.sin(now * 7 + brazier.phase) * 0.15 + Math.random() * 0.06;
            brazier.flame.scale.set(flicker, 0.85 + flicker * 0.35, flicker);
            brazier.material.opacity = 0.7 + Math.sin(now * 9 + brazier.phase) * 0.15;
            brazier.light.intensity = 14 + Math.sin(now * 8 + brazier.phase) * 3;
        }

        for (const gate of this.gates) {
            gate.veil.opacity = 0.3 + Math.sin(now * 1.6 + gate.phase) * 0.12;
        }

        if (this.runeMaterial) {
            this.runeMaterial.opacity = 0.38 + Math.sin(now * 1.9) * 0.14 + this.candleFlash * 0.3;
        }

        this.updateCandle(now, delta);
    }

    private updateCandle(now: number, delta: number) {
        if (!this.candleBody || !this.candleMaterial || !this.flameInner || !this.flameOuter || !this.flameHalo || !this.flameLight) return;

        if (this.candleFlash > 0) this.candleFlash = Math.max(0, this.candleFlash - delta * 2.5);

        const growth = 1 + Math.min(this.candleWave, 25) * 0.05;
        const height = CANDLE_BASE_HEIGHT * growth;
        this.candleBody.scale.set(1, growth, 1);
        this.candleBody.position.y = height / 2;

        for (const drip of this.wax) {
            drip.position.y = height - 0.7 - (height - CANDLE_BASE_HEIGHT) * 0.1;
        }

        const hurt = 1 - this.candleHealthRatio;
        const flicker = 1 + Math.sin(now * 11) * 0.12 + Math.sin(now * 23) * 0.05;
        const strength = 0.35 + this.candleHealthRatio * 0.65;

        this.flameInner.position.y = height + 1.25;
        this.flameOuter.position.y = height + 1.7;
        this.flameHalo.position.y = height + 1.4;
        this.flameLight.position.y = height + 1.6;

        this.flameInner.scale.set(flicker, strength * flicker, flicker);
        this.flameOuter.scale.set(flicker * 1.05, strength * flicker * 1.1, flicker * 1.05);
        this.flameHalo.scale.setScalar(0.8 + strength * 0.5 + this.candleFlash * 0.3);

        this.candleMaterial.color.setRGB(0.52 + hurt * 0.45, 0.94 - hurt * 0.6, 0.68 - hurt * 0.45);
        this.candleMaterial.emissive.setRGB(0.13 + hurt * 0.75 + this.candleFlash, 0.77 - hurt * 0.55, 0.35 - hurt * 0.25);
        this.candleMaterial.emissiveIntensity = 0.9 + this.candleFlash * 1.6;

        CandleArena.scratchColor.setRGB(0.29 + hurt * 0.7, 0.87 - hurt * 0.62, 0.5 - hurt * 0.38);
        (this.flameOuter.material as THREE.MeshBasicMaterial).color.copy(CandleArena.scratchColor);
        (this.flameHalo.material as THREE.MeshBasicMaterial).color.copy(CandleArena.scratchColor);
        if (this.runeMaterial) this.runeMaterial.color.copy(CandleArena.scratchColor);
        this.flameLight.color.copy(CandleArena.scratchColor);
        this.flameLight.intensity = (16 + strength * 18) + this.candleFlash * 16;
    }

    dispose() {
        this.braziers = [];
        this.gates = [];
        this.wax = [];
        this.altarGroup = null;
        this.candle = null;
        this.candleBody = null;
        this.candleMaterial = null;
        this.flameInner = null;
        this.flameOuter = null;
        this.flameHalo = null;
        this.flameLight = null;
        this.runeMaterial = null;
        super.dispose();
    }
}
