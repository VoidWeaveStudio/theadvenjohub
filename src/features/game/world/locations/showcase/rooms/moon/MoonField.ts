// src/features/game/world/locations/showcase/rooms/moon/MoonField.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import { CollisionGrid } from "../../../../CollisionGrid";
import { ShowcaseTextures, surfaceMaterial } from "../../textures";
import { Rocket } from "../launch/Rocket";
import { FIELD_PADS, type FieldPad } from "./moonLayout";

export interface MoonFieldDeps {
    scene: THREE.Scene;
    bin: AssetBin;
    tex: ShowcaseTextures;
    random: () => number;
    grid: CollisionGrid;
    groundHeight: (x: number, z: number) => number;
}

export class MoonField {
    private readonly rockets = new Map<string, Rocket>();
    private readonly beacons: THREE.MeshBasicMaterial[] = [];
    private readonly cranes: THREE.Object3D[] = [];
    private readonly plates: THREE.MeshStandardMaterial[] = [];

    constructor(private readonly deps: MoonFieldDeps) { }

    private mesh(
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        position?: [number, number, number],
        rotation?: [number, number, number]
    ): THREE.Mesh {
        const created = new THREE.Mesh(this.deps.bin.geometry(geometry), material);
        if (position) created.position.set(position[0], position[1], position[2]);
        if (rotation) created.rotation.set(rotation[0], rotation[1], rotation[2]);
        created.castShadow = true;
        created.receiveShadow = true;
        return created;
    }

    public create() {
        const { tex, bin } = this.deps;

        const deck = surfaceMaterial(bin, tex.panel([4, 1], 0x6e7178, 0x3f434a, 4), { roughness: 0.9, metalness: 0.12, bump: 0.05 });
        const steel = surfaceMaterial(bin, tex.panel([2, 1], 0x9aa2ae, 0x4a4f58, 3), { roughness: 0.5, metalness: 0.72, bump: 0.04 });
        const hazard = surfaceMaterial(bin, tex.hazard([6, 1], 0xffb547, 0x1c2028), { roughness: 0.8, metalness: 0.1 });

        for (const pad of FIELD_PADS) this.buildPad(pad, deck, steel, hazard);
    }

    private buildPad(pad: FieldPad, deck: THREE.Material, steel: THREE.Material, hazard: THREE.Material) {
        const { scene, bin, tex, grid, random } = this.deps;
        const base = this.deps.groundHeight(pad.x, pad.z);

        const group = new THREE.Group();
        group.position.set(pad.x, base, pad.z);
        group.rotation.y = pad.facing;
        scene.add(group);

        const apron = this.mesh(new THREE.CylinderGeometry(10, 10.6, 0.7, 30), deck, [0, 0.35, 0]);
        apron.receiveShadow = true;
        group.add(apron);

        const ring = this.mesh(new THREE.RingGeometry(7.4, 8.4, 32), hazard, [0, 0.72, 0], [-Math.PI / 2, 0, 0]);
        ring.castShadow = false;
        group.add(ring);

        grid.insertCylinder(new THREE.Vector3(pad.x, base + 0.35, pad.z), 10.6, 0.7);

        if (pad.ready >= 0.5) this.buildStandingPad(pad, group, steel, base);
        else this.buildYardPad(pad, group, steel, base);

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + 0.6;
            const tank = this.mesh(
                new THREE.CylinderGeometry(1.1, 1.1, 3.4, 12),
                steel,
                [Math.cos(angle) * 12.4, 1.7, Math.sin(angle) * 12.4]
            );
            group.add(tank);

            const cap = this.mesh(
                new THREE.SphereGeometry(1.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
                steel,
                [Math.cos(angle) * 12.4, 3.4, Math.sin(angle) * 12.4]
            );
            cap.castShadow = false;
            group.add(cap);
        }

        for (let i = 0; i < 6; i++) {
            const angle = random() * Math.PI * 2;
            const distance = 12 + random() * 5;
            const crate = this.mesh(
                new THREE.BoxGeometry(1.6, 1.3, 1.6),
                steel,
                [Math.cos(angle) * distance, 0.65, Math.sin(angle) * distance],
                [0, random() * Math.PI, 0]
            );
            group.add(crate);
        }

        const plate = surfaceMaterial(
            bin,
            tex.emblem(`fieldpad${pad.ticker}`, "rocket", 0x14181f, pad.tint, `$${pad.ticker}`),
            { roughness: 0.6, metalness: 0.2, emissive: pad.tint, emissiveIntensity: 0.5 }
        );
        this.plates.push(plate);

        const sign = this.mesh(new THREE.PlaneGeometry(4.4, 4.4), plate, [0, 3.2, -11.4], [0, Math.PI, 0]);
        sign.castShadow = false;
        group.add(sign);

        for (const dx of [-2, 2]) {
            const post = this.mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.4, 6), steel, [dx, 1.7, -11.4]);
            post.castShadow = false;
            group.add(post);
        }

        const beaconMaterial = bin.material(new THREE.MeshBasicMaterial({
            color: pad.tint,
            transparent: true,
            opacity: 0.9,
            toneMapped: false,
        }));
        this.beacons.push(beaconMaterial);

        const beacon = this.mesh(new THREE.SphereGeometry(0.4, 10, 8), beaconMaterial, [0, 4.6, -11.4]);
        beacon.castShadow = false;
        group.add(beacon);

        const light = new THREE.PointLight(pad.tint, 22, 26, 2);
        light.position.set(0, 4, -10);
        group.add(light);
    }

    private buildStandingPad(pad: FieldPad, group: THREE.Group, steel: THREE.Material, base: number) {
        const rocket = new Rocket(this.deps.bin, this.deps.tex, this.deps.random, {
            ticker: pad.ticker,
            legs: true,
            simple: true,
        });

        const craft = rocket.create();
        craft.position.set(0, 2, 0);
        craft.scale.setScalar(pad.ready >= 0.8 ? 1 : 0.86);
        group.add(craft);
        this.rockets.set(pad.id, rocket);

        this.deps.grid.insertCylinder(new THREE.Vector3(pad.x, base + 8, pad.z), 3.4, 16);

        const tower = new THREE.Group();
        tower.position.set(-8.4, 0, 0);
        group.add(tower);

        const height = pad.ready >= 0.8 ? 30 : 22;
        for (const dx of [-1.6, 1.6]) {
            for (const dz of [-1.6, 1.6]) {
                const leg = this.mesh(new THREE.BoxGeometry(0.32, height, 0.32), steel, [dx, height / 2, dz]);
                tower.add(leg);
            }
        }

        const levels = Math.floor(height / 3.6);
        for (let level = 1; level <= levels; level++) {
            const y = level * 3.6;
            const deck = this.mesh(new THREE.BoxGeometry(3.4, 0.14, 3.4), steel, [0, y, 0]);
            deck.castShadow = false;
            tower.add(deck);

            const brace = this.mesh(new THREE.BoxGeometry(0.14, 3.8, 0.14), steel, [1.6, y - 1.8, 0], [level % 2 === 0 ? 0.55 : -0.55, 0, 0]);
            brace.castShadow = false;
            tower.add(brace);
        }

        const arm = this.mesh(new THREE.BoxGeometry(5.4, 0.2, 1.6), steel, [4.4, height - 8, 0]);
        arm.castShadow = false;
        tower.add(arm);

        this.deps.grid.insertOrientedBox(
            pad.x + Math.cos(pad.facing) * -8.4,
            pad.z - Math.sin(pad.facing) * -8.4,
            3.6,
            3.6,
            pad.facing,
            base,
            base + height
        );
    }

    private buildYardPad(pad: FieldPad, group: THREE.Group, steel: THREE.Material, base: number) {
        const body = this.mesh(new THREE.CylinderGeometry(2.3, 2.5, 17, 20), steel, [0, 3, 1], [0, 0, Math.PI / 2]);
        group.add(body);

        const nose = this.mesh(new THREE.ConeGeometry(2.3, 5.4, 20), steel, [11.2, 3, 1], [0, 0, -Math.PI / 2]);
        group.add(nose);

        for (const dz of [-2.6, 2.6]) {
            const cradle = this.mesh(new THREE.BoxGeometry(12, 1.2, 1.2), steel, [0, 0.9, 1 + dz]);
            cradle.castShadow = false;
            group.add(cradle);
        }

        for (let i = 0; i < 4; i++) {
            const post = this.mesh(new THREE.CylinderGeometry(0.24, 0.3, 3, 8), steel, [-6 + i * 4, 1.5, -3.4]);
            post.castShadow = false;
            group.add(post);
        }

        const crane = new THREE.Group();
        crane.position.set(-7, 0, -6);
        group.add(crane);
        this.cranes.push(crane);

        const mast = this.mesh(new THREE.CylinderGeometry(0.4, 0.5, 14, 10), steel, [0, 7, 0]);
        crane.add(mast);

        const jib = this.mesh(new THREE.BoxGeometry(12, 0.4, 0.5), steel, [5, 13.4, 0], [0, 0, 0.12]);
        jib.castShadow = false;
        crane.add(jib);

        const cable = this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 4), steel, [9.4, 10.4, 0]);
        cable.castShadow = false;
        crane.add(cable);

        const hook = this.mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), steel, [9.4, 7.2, 0]);
        hook.castShadow = false;
        crane.add(hook);

        this.deps.grid.insertCylinder(new THREE.Vector3(pad.x, base + 3, pad.z), 4, 6);
    }

    public rocketFor(id: string): Rocket | null {
        return this.rockets.get(id) ?? null;
    }

    public update(delta: number, elapsed: number) {
        const pulse = Math.abs(Math.sin(elapsed * 1.7));
        for (let i = 0; i < this.beacons.length; i++) {
            this.beacons[i].opacity = 0.2 + (i % 2 === 0 ? pulse : 1 - pulse) * 0.7;
        }

        for (let i = 0; i < this.cranes.length; i++) {
            this.cranes[i].rotation.y = Math.sin(elapsed * 0.12 + i) * 0.5;
        }

        for (const rocket of this.rockets.values()) rocket.update(delta);
    }

    public dispose() {
        for (const rocket of this.rockets.values()) rocket.dispose();
        this.rockets.clear();
        this.beacons.length = 0;
        this.cranes.length = 0;
        this.plates.length = 0;
    }
}
