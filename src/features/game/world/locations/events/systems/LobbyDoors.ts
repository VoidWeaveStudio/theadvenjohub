// src/features/game/world/locations/events/systems/LobbyDoors.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../CollisionGrid";
import { AssetBin } from "../../../AssetBin";
import { EVENT_DOORS, EVENT_DOOR_PREFIX, EventDoor, ResolvedEvent, isEventLive } from "../../../../data/eventDoors";
import { createCrestTexture, createPlaqueTexture, createRunnerMaterial, createWalnutMaterial, makeRandom } from "../lobbyTextures";
import {
    DOOR_CLEAR_HEIGHT,
    DOOR_CLEAR_WIDTH,
    DOOR_INTERACT_RADIUS,
    DOOR_PORTICO_DEPTH,
    DOOR_PORTICO_RADIUS,
    DOOR_PORTICO_WIDTH,
    bayAngle,
    inwardRotation,
    isLowEndDevice,
    placeOnRing,
} from "../lobbyLayout";
import type { ShellMaterials } from "./LobbyShell";
import { t, onLanguageChange } from "@/core/i18n";

const LEAF_WIDTH = DOOR_CLEAR_WIDTH / 2 - 0.1;
const LEAF_HEIGHT = DOOR_CLEAR_HEIGHT - 0.3;
const DOOR_LOCAL_Z = -2.15;
const VEIL_LOCAL_Z = -3.02;
const OPEN_DISTANCE = 11;
const OPEN_ANGLE = Math.PI * 0.34;
const MOTE_COUNT = 26;
const SCHEDULE_CHECK_SECONDS = 1;

interface DoorHandle {
    event: EventDoor;
    live: boolean;
    config: ResolvedEvent | null;
    group: THREE.Group;
    leftPivot: THREE.Group;
    rightPivot: THREE.Group;
    veil: THREE.MeshBasicMaterial;
    halo: THREE.MeshBasicMaterial;
    crestGlow: THREE.MeshBasicMaterial;
    pool: THREE.Mesh;
    poolMaterial: THREE.MeshBasicMaterial;
    light: THREE.PointLight;
    motes: THREE.Points | null;
    moteSpeeds: Float32Array | null;
    seals: THREE.Object3D[];
    lantern: THREE.MeshBasicMaterial;
    plaque: THREE.MeshBasicMaterial;
    crest: THREE.MeshBasicMaterial;
    openAmount: number;
    phase: number;
    worldPosition: THREE.Vector3;
}

function createMoteTexture(bin: AssetBin): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return bin.texture(texture);
}

export class LobbyDoors {
    private readonly random = makeRandom(0x7c31d9);
    private readonly doors: DoorHandle[] = [];

    private walnut!: THREE.MeshStandardMaterial;
    private runner!: THREE.MeshStandardMaterial;
    private moteTexture: THREE.Texture | null = null;
    private elapsed = 0;
    private scheduleCheck = 0;
    private stopLanguageWatch: (() => void) | null = null;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly collisionGrid: CollisionGrid,
        private readonly bin: AssetBin
    ) { }

    create(materials: ShellMaterials) {
        this.walnut = createWalnutMaterial(this.bin, this.random);
        this.runner = createRunnerMaterial(this.bin, "#e2c887");
        if (!isLowEndDevice()) this.moteTexture = createMoteTexture(this.bin);

        EVENT_DOORS.forEach((event, index) => {
            this.buildDoorway(event, bayAngle(index), materials, index);
        });

        // A plaque is a baked canvas, so switching language has to repaint it.
        this.stopLanguageWatch = onLanguageChange(() => this.repaintPlaques());
    }

    private repaintPlaques() {
        for (const door of this.doors) {
            const resolved = door.config;
            door.plaque.map?.dispose();
            door.plaque.map = createPlaqueTexture(
                this.bin,
                resolved?.title ?? t(door.event.name),
                resolved?.tagline ?? t(door.event.tagline),
                `#${new THREE.Color(resolved?.accent ?? door.event.accent).getHexString()}`,
                resolved ? isEventLive(resolved) : door.event.live
            );
            door.plaque.needsUpdate = true;
        }
    }

    private buildDoorway(event: EventDoor, angle: number, materials: ShellMaterials, index: number) {
        const accent = new THREE.Color(event.accent);
        const trim = new THREE.Color(event.trim);
        const accentCss = `#${accent.getHexString()}`;

        const group = new THREE.Group();
        placeOnRing(group, angle, DOOR_PORTICO_RADIUS);
        group.userData.interactionId = `${EVENT_DOOR_PREFIX}${event.id}`;
        group.userData.interactionRadius = DOOR_INTERACT_RADIUS;

        const plaqueMaterial = this.buildPortico(group, materials, event);
        const { leftPivot, rightPivot, seals } = this.buildLeaves(group, materials, event);

        const veilMaterial = this.bin.material(new THREE.MeshBasicMaterial({
            color: event.live ? event.accent : 0x1a1a20,
            transparent: true,
            opacity: event.live ? 0.72 : 0.3,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));
        const veil = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_CLEAR_WIDTH, DOOR_CLEAR_HEIGHT), veilMaterial);
        veil.position.set(0, DOOR_CLEAR_HEIGHT / 2 + 0.4, VEIL_LOCAL_Z);
        veil.renderOrder = 4;
        group.add(veil);

        const haloMaterial = this.bin.material(new THREE.MeshBasicMaterial({
            color: event.accent,
            transparent: true,
            opacity: event.live ? 0.3 : 0.06,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));
        const halo = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_CLEAR_WIDTH + 7, DOOR_CLEAR_HEIGHT + 7), haloMaterial);
        halo.position.set(0, DOOR_CLEAR_HEIGHT / 2 + 0.6, VEIL_LOCAL_Z + 0.05);
        halo.renderOrder = 3;
        group.add(halo);

        const { crestGlow, crestMaterial } = this.buildPediment(group, materials, event, accentCss);

        const poolMaterial = this.bin.material(new THREE.MeshBasicMaterial({
            color: event.accent,
            transparent: true,
            opacity: event.live ? 0.24 : 0.05,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));
        const pool = new THREE.Mesh(new THREE.CircleGeometry(7.5, 32), poolMaterial);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(0, 0.05, 4.6);
        pool.renderOrder = 2;
        group.add(pool);

        const carpet = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 13), this.runner);
        carpet.rotation.x = -Math.PI / 2;
        carpet.position.set(0, 0.035, 7.4);
        carpet.receiveShadow = true;
        group.add(carpet);

        const light = new THREE.PointLight(event.accent, 24, 34, 2);
        light.position.set(0, DOOR_CLEAR_HEIGHT * 0.55, -1.2);
        light.visible = event.live;
        group.add(light);

        const lanternMaterial = this.bin.material(new THREE.MeshBasicMaterial({
            color: event.live ? event.trim : 0x4a4a52,
            toneMapped: false,
            fog: false,
        }));
        for (const side of [-1, 1]) {
            const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.1), materials.gilded);
            bracket.position.set(side * (DOOR_PORTICO_WIDTH / 2 - 0.9), 9.6, 0.5);
            group.add(bracket);

            const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 0), lanternMaterial);
            lantern.position.set(side * (DOOR_PORTICO_WIDTH / 2 - 0.9), 9.0, 1.05);
            group.add(lantern);

            const finial = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.6, 8), materials.gilded);
            finial.position.set(lantern.position.x, lantern.position.y + 0.9, lantern.position.z);
            group.add(finial);
        }

        let motes: THREE.Points | null = null;
        let moteSpeeds: Float32Array | null = null;
        if (this.moteTexture) {
            const positions = new Float32Array(MOTE_COUNT * 3);
            moteSpeeds = new Float32Array(MOTE_COUNT);
            for (let i = 0; i < MOTE_COUNT; i++) {
                positions[i * 3] = (this.random() - 0.5) * DOOR_CLEAR_WIDTH;
                positions[i * 3 + 1] = this.random() * DOOR_CLEAR_HEIGHT;
                positions[i * 3 + 2] = VEIL_LOCAL_Z + this.random() * 3;
                moteSpeeds[i] = 0.35 + this.random() * 0.8;
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

            motes = new THREE.Points(geometry, this.bin.material(new THREE.PointsMaterial({
                color: trim,
                size: 0.36,
                map: this.moteTexture,
                transparent: true,
                opacity: 0.75,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
                fog: false,
            })));
            motes.frustumCulled = false;
            group.add(motes);
        }

        this.scene.add(group);

        const worldPosition = group.position.clone();
        this.collisionGrid.insertOrientedBox(
            Math.sin(angle) * (DOOR_PORTICO_RADIUS + DOOR_PORTICO_DEPTH / 2),
            -Math.cos(angle) * (DOOR_PORTICO_RADIUS + DOOR_PORTICO_DEPTH / 2),
            DOOR_PORTICO_WIDTH,
            DOOR_PORTICO_DEPTH + 1.2,
            inwardRotation(angle),
            0,
            DOOR_CLEAR_HEIGHT + 6
        );

        this.doors.push({
            event,
            live: event.live,
            config: null,
            group,
            leftPivot,
            rightPivot,
            veil: veilMaterial,
            halo: haloMaterial,
            crestGlow,
            pool,
            poolMaterial,
            light,
            motes,
            moteSpeeds,
            seals,
            lantern: lanternMaterial,
            plaque: plaqueMaterial,
            crest: crestMaterial,
            openAmount: 0,
            phase: index * 0.63,
            worldPosition,
        });
    }

    private buildPortico(group: THREE.Group, materials: ShellMaterials, event: EventDoor): THREE.MeshBasicMaterial {
        const jambWidth = (DOOR_PORTICO_WIDTH - DOOR_CLEAR_WIDTH) / 2;
        for (const side of [-1, 1]) {
            const pier = new THREE.Mesh(
                new THREE.BoxGeometry(jambWidth, DOOR_CLEAR_HEIGHT + 1.4, DOOR_PORTICO_DEPTH),
                materials.marble
            );
            pier.position.set(
                side * (DOOR_CLEAR_WIDTH / 2 + jambWidth / 2),
                (DOOR_CLEAR_HEIGHT + 1.4) / 2,
                -DOOR_PORTICO_DEPTH / 2
            );
            pier.castShadow = true;
            pier.receiveShadow = true;
            group.add(pier);

            const pilaster = new THREE.Mesh(
                new THREE.BoxGeometry(1.5, DOOR_CLEAR_HEIGHT + 0.4, 0.55),
                materials.limestone
            );
            pilaster.position.set(side * (DOOR_CLEAR_WIDTH / 2 + jambWidth / 2), (DOOR_CLEAR_HEIGHT + 0.4) / 2 + 0.6, 0.3);
            pilaster.castShadow = true;
            group.add(pilaster);

            const capital = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 0.9), materials.gilded);
            capital.position.set(side * (DOOR_CLEAR_WIDTH / 2 + jambWidth / 2), DOOR_CLEAR_HEIGHT + 1.25, 0.4);
            group.add(capital);

            const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.6, 1.1), materials.marble);
            plinth.position.set(side * (DOOR_CLEAR_WIDTH / 2 + jambWidth / 2), 0.3, 0.4);
            group.add(plinth);

            const reveal = new THREE.Mesh(
                new THREE.BoxGeometry(0.5, DOOR_CLEAR_HEIGHT, DOOR_PORTICO_DEPTH),
                materials.limestone
            );
            reveal.position.set(side * (DOOR_CLEAR_WIDTH / 2 - 0.2), DOOR_CLEAR_HEIGHT / 2, -DOOR_PORTICO_DEPTH / 2);
            group.add(reveal);
        }

        const lintel = new THREE.Mesh(
            new THREE.BoxGeometry(DOOR_PORTICO_WIDTH, 1.9, DOOR_PORTICO_DEPTH + 0.6),
            materials.marble
        );
        lintel.position.set(0, DOOR_CLEAR_HEIGHT + 1.85, -DOOR_PORTICO_DEPTH / 2 + 0.3);
        lintel.castShadow = true;
        group.add(lintel);

        const soffit = new THREE.Mesh(
            new THREE.BoxGeometry(DOOR_CLEAR_WIDTH, 0.4, DOOR_PORTICO_DEPTH),
            materials.limestone
        );
        soffit.position.set(0, DOOR_CLEAR_HEIGHT + 0.6, -DOOR_PORTICO_DEPTH / 2);
        group.add(soffit);

        const architrave = new THREE.Mesh(
            new THREE.BoxGeometry(DOOR_PORTICO_WIDTH + 0.8, 0.36, 0.4),
            materials.gilded
        );
        architrave.position.set(0, DOOR_CLEAR_HEIGHT + 0.95, 0.5);
        group.add(architrave);

        const threshold = new THREE.Mesh(new THREE.BoxGeometry(DOOR_PORTICO_WIDTH, 0.22, 2.4), materials.bronze);
        threshold.position.set(0, 0.11, -1.1);
        group.add(threshold);

        for (let step = 0; step < 2; step++) {
            const width = DOOR_PORTICO_WIDTH + 2.4 - step * 1.2;
            const stair = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, 1.5 - step * 0.4), materials.marble);
            stair.position.set(0, 0.11 - step * 0.001, 0.9 + step * 1.1);
            stair.receiveShadow = true;
            group.add(stair);
        }

        const plaqueMaterial = this.bin.material(new THREE.MeshBasicMaterial({
            map: createPlaqueTexture(this.bin, t(event.name), t(event.tagline), `#${new THREE.Color(event.accent).getHexString()}`, event.live),
            transparent: true,
            toneMapped: false,
            fog: false,
        }));

        const plaque = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 2.35), plaqueMaterial);
        plaque.position.set(0, DOOR_CLEAR_HEIGHT + 1.85, 0.78);
        group.add(plaque);

        const plaqueFrame = new THREE.Mesh(new THREE.BoxGeometry(9.9, 2.85, 0.22), materials.gilded);
        plaqueFrame.position.set(0, DOOR_CLEAR_HEIGHT + 1.85, 0.66);
        group.add(plaqueFrame);

        return plaqueMaterial;
    }

    private buildPediment(
        group: THREE.Group,
        materials: ShellMaterials,
        event: EventDoor,
        accentCss: string
    ): { crestGlow: THREE.MeshBasicMaterial; crestMaterial: THREE.MeshBasicMaterial } {
        const baseY = DOOR_CLEAR_HEIGHT + 2.85;
        const halfWidth = DOOR_PORTICO_WIDTH / 2 + 0.9;
        const peak = 3.1;

        const shape = new THREE.Shape();
        shape.moveTo(-halfWidth, 0);
        shape.lineTo(halfWidth, 0);
        shape.lineTo(0, peak);
        shape.lineTo(-halfWidth, 0);

        const pediment = new THREE.Mesh(
            this.bin.geometry(new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: false })),
            materials.marble
        );
        pediment.position.set(0, baseY, -0.1);
        pediment.castShadow = true;
        group.add(pediment);

        const rakeGeometry = this.bin.geometry(new THREE.BoxGeometry(Math.hypot(halfWidth, peak), 0.3, 1.8));
        for (const side of [-1, 1]) {
            const rake = new THREE.Mesh(rakeGeometry, materials.gilded);
            rake.position.set(side * halfWidth / 2, baseY + peak / 2, 0.65);
            rake.rotation.z = side * -Math.atan2(peak, halfWidth);
            group.add(rake);
        }

        const cornice = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 + 1, 0.42, 1.9), materials.gilded);
        cornice.position.set(0, baseY - 0.2, 0.6);
        group.add(cornice);

        const crestMaterial = this.bin.material(new THREE.MeshBasicMaterial({
            map: createCrestTexture(this.bin, event.glyph, accentCss, event.live),
            transparent: true,
            toneMapped: false,
            fog: false,
        }));

        const crest = new THREE.Mesh(new THREE.CircleGeometry(1.35, 32), crestMaterial);
        crest.position.set(0, baseY + 1.15, 0.78);
        group.add(crest);

        const crestGlow = this.bin.material(new THREE.MeshBasicMaterial({
            color: event.accent,
            transparent: true,
            opacity: event.live ? 0.32 : 0.05,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));
        const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(2.7, 32), crestGlow);
        glowDisc.position.set(0, baseY + 1.15, 0.72);
        glowDisc.renderOrder = 3;
        group.add(glowDisc);

        const wreath = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.14, 6, 32), materials.gilded);
        wreath.position.set(0, baseY + 1.15, 0.84);
        group.add(wreath);

        return { crestGlow, crestMaterial };
    }

    private buildLeaves(
        group: THREE.Group,
        materials: ShellMaterials,
        event: EventDoor
    ): { leftPivot: THREE.Group; rightPivot: THREE.Group; seals: THREE.Object3D[] } {
        const pivots: THREE.Group[] = [];
        const seals: THREE.Object3D[] = [];

        for (const side of [-1, 1]) {
            const pivot = new THREE.Group();
            pivot.position.set(side * (DOOR_CLEAR_WIDTH / 2), 0, DOOR_LOCAL_Z);
            group.add(pivot);

            const leaf = new THREE.Mesh(new THREE.BoxGeometry(LEAF_WIDTH, LEAF_HEIGHT, 0.34), this.walnut);
            leaf.position.set(-side * LEAF_WIDTH / 2, LEAF_HEIGHT / 2, 0);
            leaf.castShadow = true;
            leaf.receiveShadow = true;
            pivot.add(leaf);

            const styleGeometry = this.bin.geometry(new THREE.BoxGeometry(0.28, LEAF_HEIGHT, 0.42));
            for (const offset of [-LEAF_WIDTH / 2 + 0.2, LEAF_WIDTH / 2 - 0.2]) {
                const style = new THREE.Mesh(styleGeometry, materials.gilded);
                style.position.set(-side * LEAF_WIDTH / 2 + offset, LEAF_HEIGHT / 2, 0.02);
                pivot.add(style);
            }

            const railGeometry = this.bin.geometry(new THREE.BoxGeometry(LEAF_WIDTH - 0.5, 0.24, 0.42));
            for (const y of [1.1, LEAF_HEIGHT * 0.42, LEAF_HEIGHT * 0.72, LEAF_HEIGHT - 0.7]) {
                const rail = new THREE.Mesh(railGeometry, materials.gilded);
                rail.position.set(-side * LEAF_WIDTH / 2, y, 0.02);
                pivot.add(rail);
            }

            const panelGeometry = this.bin.geometry(new THREE.BoxGeometry(LEAF_WIDTH - 1.5, 3.4, 0.12));
            for (const y of [LEAF_HEIGHT * 0.24, LEAF_HEIGHT * 0.57, LEAF_HEIGHT * 0.86]) {
                const panel = new THREE.Mesh(panelGeometry, materials.bronze);
                panel.position.set(-side * LEAF_WIDTH / 2, y, 0.2);
                pivot.add(panel);
            }

            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 6, 20), materials.gilded);
            ring.position.set(-side * (LEAF_WIDTH - 0.75), 6.1, 0.32);
            pivot.add(ring);

            const boss = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), materials.gilded);
            boss.position.set(-side * (LEAF_WIDTH - 0.75), 6.55, 0.34);
            pivot.add(boss);

            const seal = new THREE.Mesh(
                new THREE.CylinderGeometry(0.55, 0.55, 0.16, 16),
                this.bin.material(new THREE.MeshStandardMaterial({
                    color: 0x7a2230,
                    roughness: 0.5,
                    metalness: 0.2,
                    emissive: new THREE.Color(event.accent).multiplyScalar(0.12),
                }))
            );
            seal.rotation.x = Math.PI / 2;
            seal.position.set(-side * (LEAF_WIDTH - 1.4), 7.2, 0.3);
            seal.visible = !event.live;
            pivot.add(seal);
            seals.push(seal);

            pivots.push(pivot);
        }

        return { leftPivot: pivots[0], rightPivot: pivots[1], seals };
    }

    public applyEvents(events: ResolvedEvent[]) {
        const byId = new Map(events.map((event) => [event.id, event]));

        for (const door of this.doors) {
            const resolved = byId.get(door.event.id);
            if (!resolved) continue;

            door.config = resolved;

            door.plaque.map?.dispose();
            door.plaque.map = createPlaqueTexture(
                this.bin,
                resolved.title,
                resolved.tagline,
                `#${new THREE.Color(resolved.accent).getHexString()}`,
                isEventLive(resolved)
            );
            door.plaque.needsUpdate = true;

            this.applyLiveState(door, isEventLive(resolved));
        }
    }

    private applyLiveState(door: DoorHandle, live: boolean) {
        if (door.live === live) return;
        door.live = live;

        const accent = door.config?.accent ?? door.event.accent;

        for (const seal of door.seals) seal.visible = !live;
        door.light.visible = live;
        door.veil.color.set(live ? accent : 0x1a1a20);
        door.lantern.color.set(live ? door.event.trim : 0x4a4a52);
        if (door.motes) door.motes.visible = live;

        door.crest.map?.dispose();
        door.crest.map = createCrestTexture(
            this.bin,
            door.event.glyph,
            `#${new THREE.Color(accent).getHexString()}`,
            live
        );
        door.crest.needsUpdate = true;
    }

    public getInteractables(): THREE.Object3D[] {
        return this.doors.map((door) => door.group);
    }

    update(playerPosition: THREE.Vector3, delta: number) {
        this.elapsed += delta;

        this.scheduleCheck -= delta;
        if (this.scheduleCheck <= 0) {
            this.scheduleCheck = SCHEDULE_CHECK_SECONDS;
            for (const door of this.doors) {
                if (door.config) this.applyLiveState(door, isEventLive(door.config));
            }
        }

        for (const door of this.doors) {
            const distance = playerPosition.distanceTo(door.worldPosition);
            const target = door.live && distance < OPEN_DISTANCE ? 1 : 0;
            const rate = target > door.openAmount ? 2.6 : 1.7;
            door.openAmount += (target - door.openAmount) * Math.min(1, delta * rate);

            const swing = door.openAmount * OPEN_ANGLE;
            door.leftPivot.rotation.y = swing;
            door.rightPivot.rotation.y = -swing;

            if (!door.live) {
                door.veil.opacity = 0.24 + Math.sin(this.elapsed * 0.9 + door.phase) * 0.05 + door.openAmount * 0.14;
                door.crestGlow.opacity = 0.05 + Math.sin(this.elapsed * 0.8 + door.phase) * 0.02 + door.openAmount * 0.09;
                door.poolMaterial.opacity = 0.04 + door.openAmount * 0.08;
                continue;
            }

            const pulse = 0.62 + Math.sin(this.elapsed * 1.7 + door.phase) * 0.14;
            door.veil.opacity = pulse;
            door.halo.opacity = 0.2 + Math.sin(this.elapsed * 1.3 + door.phase) * 0.07 + door.openAmount * 0.18;
            door.crestGlow.opacity = 0.26 + Math.sin(this.elapsed * 2.1 + door.phase) * 0.09;
            door.poolMaterial.opacity = 0.16 + Math.sin(this.elapsed * 1.1 + door.phase) * 0.05 + door.openAmount * 0.16;
            door.pool.scale.setScalar(0.94 + door.openAmount * 0.12);
            door.light.intensity = 22 + Math.sin(this.elapsed * 2.4 + door.phase) * 5 + door.openAmount * 16;

            if (door.motes && door.moteSpeeds) {
                const array = (door.motes.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
                for (let i = 0; i < MOTE_COUNT; i++) {
                    const index = i * 3;
                    array[index + 1] += door.moteSpeeds[i] * delta;
                    array[index] += Math.sin(this.elapsed * 1.4 + i) * delta * 0.24;
                    if (array[index + 1] > DOOR_CLEAR_HEIGHT) {
                        array[index + 1] = 0.2;
                        array[index] = (this.random() - 0.5) * DOOR_CLEAR_WIDTH;
                    }
                }
                (door.motes.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
                (door.motes.material as THREE.PointsMaterial).opacity = 0.4 + door.openAmount * 0.45;
            }
        }
    }

    dispose() {
        this.stopLanguageWatch?.();
        this.stopLanguageWatch = null;
        this.doors.length = 0;
        this.moteTexture = null;
    }
}
