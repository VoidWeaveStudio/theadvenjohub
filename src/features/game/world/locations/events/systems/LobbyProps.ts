// src/features/game/world/locations/events/systems/LobbyProps.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../CollisionGrid";
import { AssetBin } from "../../../AssetBin";
import { EVENT_DOORS, ResolvedEvent, eventWindow } from "../../../../data/eventDoors";
import { createCarpetMaterial, createDirectoryTexture, drawDirectory, makeRandom, type DirectoryRow } from "../lobbyTextures";
import {
    BAY_COUNT,
    BENCH_RING_RADIUS,
    CHANDELIER_COUNT,
    CHANDELIER_RING_RADIUS,
    CHANDELIER_Y,
    FOUNTAIN_RADIUS,
    HALL_RADIUS,
    PLANTER_RING_RADIUS,
    ROTUNDA_RADIUS,
    RUG_RADIUS,
    WALL_HEIGHT,
    bayAngle,
    isLowEndDevice,
    placeOnRing,
} from "../lobbyLayout";
import type { ShellMaterials } from "./LobbyShell";
import { t, onLanguageChange } from "@/core/i18n";

const DROPLET_COUNT = 90;
const BANNER_COUNT = BAY_COUNT;

interface Chandelier {
    group: THREE.Group;
    material: THREE.MeshBasicMaterial;
    light: THREE.PointLight;
    phase: number;
}

export class LobbyProps {
    private readonly random = makeRandom(0x1d5b8e);

    private directoryTexture: THREE.CanvasTexture | null = null;
    private directorySignature = "";
    private lastEvents: ResolvedEvent[] = [];
    private stopLanguageWatch: (() => void) | null = null;

    private waterMaterial: THREE.MeshPhysicalMaterial | null = null;
    private jetMaterial: THREE.MeshBasicMaterial | null = null;
    private droplets: THREE.Points | null = null;
    private dropletVelocities: Float32Array | null = null;
    private chandeliers: Chandelier[] = [];
    private banners: THREE.Mesh[] = [];
    private candleFlame: THREE.Mesh | null = null;
    private candleLight: THREE.PointLight | null = null;
    private elapsed = 0;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly collisionGrid: CollisionGrid,
        private readonly bin: AssetBin
    ) { }

    create(materials: ShellMaterials) {
        this.buildRotunda(materials);
        this.buildFountain(materials);
        this.buildDirectory(materials);
        this.buildBenches(materials);
        this.buildPlanters(materials);
        this.buildChandeliers(materials);
        this.buildBanners();
    }

    private buildRotunda(materials: ShellMaterials) {
        const rug = new THREE.Mesh(
            new THREE.CircleGeometry(RUG_RADIUS, 96),
            createCarpetMaterial(this.bin, "#e2c887")
        );
        rug.rotation.x = -Math.PI / 2;
        rug.position.y = 0.02;
        rug.receiveShadow = true;
        rug.matrixAutoUpdate = false;
        rug.updateMatrix();
        this.scene.add(rug);

        for (let step = 0; step < 2; step++) {
            const radius = ROTUNDA_RADIUS - step * 2.4;
            const top = 0.28 + step * 0.28;

            const ring = new THREE.Mesh(
                new THREE.CylinderGeometry(radius, radius + 0.25, 0.28, 96),
                materials.marble
            );
            ring.position.y = top - 0.14;
            ring.receiveShadow = true;
            ring.castShadow = true;
            this.scene.add(ring);

            this.collisionGrid.insertPlatform(0, radius + 0.25, top - 0.28, top);

            const edge = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.1, 0.09, 6, 96), materials.gilded);
            edge.rotation.x = Math.PI / 2;
            edge.position.y = top;
            this.scene.add(edge);
        }
    }

    private buildFountain(materials: ShellMaterials) {
        const baseY = 0.56;

        const basin = new THREE.Mesh(
            new THREE.CylinderGeometry(FOUNTAIN_RADIUS, FOUNTAIN_RADIUS - 0.5, 1.5, 48),
            materials.marble
        );
        basin.position.y = baseY + 0.75;
        basin.castShadow = true;
        basin.receiveShadow = true;
        this.scene.add(basin);

        const lip = new THREE.Mesh(new THREE.TorusGeometry(FOUNTAIN_RADIUS, 0.28, 10, 64), materials.marble);
        lip.rotation.x = Math.PI / 2;
        lip.position.y = baseY + 1.5;
        lip.castShadow = true;
        this.scene.add(lip);

        const trim = new THREE.Mesh(new THREE.TorusGeometry(FOUNTAIN_RADIUS - 0.34, 0.09, 6, 64), materials.gilded);
        trim.rotation.x = Math.PI / 2;
        trim.position.y = baseY + 1.62;
        this.scene.add(trim);

        this.collisionGrid.insertCylinder(
            new THREE.Vector3(0, (baseY + 1.6) / 2, 0),
            FOUNTAIN_RADIUS + 0.3,
            baseY + 1.6
        );

        this.waterMaterial = this.bin.material(new THREE.MeshPhysicalMaterial({
            color: 0x9fd8e8,
            roughness: 0.06,
            metalness: 0,
            transmission: 0.75,
            thickness: 0.9,
            transparent: true,
            opacity: 0.82,
            envMapIntensity: 1.6,
        }));

        const water = new THREE.Mesh(new THREE.CircleGeometry(FOUNTAIN_RADIUS - 0.4, 64), this.waterMaterial);
        water.rotation.x = -Math.PI / 2;
        water.position.y = baseY + 1.28;
        this.scene.add(water);

        const pedestal = new THREE.Mesh(
            new THREE.CylinderGeometry(1.5, 2.1, 2.6, 24),
            materials.marble
        );
        pedestal.position.y = baseY + 2.5;
        pedestal.castShadow = true;
        this.scene.add(pedestal);

        const upperBowl = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.2, 0.7, 32), materials.gilded);
        upperBowl.position.y = baseY + 4.1;
        upperBowl.castShadow = true;
        this.scene.add(upperBowl);

        const candleBody = new THREE.Mesh(
            new THREE.CylinderGeometry(0.85, 1, 3.4, 24),
            this.bin.material(new THREE.MeshStandardMaterial({
                color: 0xf5efdd,
                roughness: 0.4,
                metalness: 0.02,
                emissive: 0x2a2418,
                emissiveIntensity: 0.4,
            }))
        );
        candleBody.position.y = baseY + 6.15;
        candleBody.castShadow = true;
        this.scene.add(candleBody);

        const flameMaterial = this.bin.material(new THREE.MeshBasicMaterial({
            color: 0xffd28a,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));
        this.candleFlame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 12), flameMaterial);
        this.candleFlame.position.y = baseY + 8.6;
        this.scene.add(this.candleFlame);

        this.candleLight = new THREE.PointLight(0xffcf8f, 26, 46, 2);
        this.candleLight.position.y = baseY + 8.6;
        this.scene.add(this.candleLight);

        this.jetMaterial = this.bin.material(new THREE.MeshBasicMaterial({
            color: 0xcdeaf5,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));

        const jetGeometry = this.bin.geometry(new THREE.CylinderGeometry(0.06, 0.16, 3.2, 8, 1, true));
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const jet = new THREE.Mesh(jetGeometry, this.jetMaterial);
            jet.position.set(Math.cos(angle) * 2.4, baseY + 3.4, Math.sin(angle) * 2.4);
            jet.rotation.z = Math.cos(angle) * 0.34;
            jet.rotation.x = -Math.sin(angle) * 0.34;
            this.scene.add(jet);
        }

        const pool = new THREE.PointLight(0x8fd6f0, 16, 34, 2);
        pool.position.set(0, baseY + 2, 0);
        this.scene.add(pool);

        if (!isLowEndDevice()) this.buildDroplets(baseY);
    }

    private buildDroplets(baseY: number) {
        const positions = new Float32Array(DROPLET_COUNT * 3);
        this.dropletVelocities = new Float32Array(DROPLET_COUNT * 3);

        for (let i = 0; i < DROPLET_COUNT; i++) {
            this.resetDroplet(positions, this.dropletVelocities, i, baseY);
            positions[i * 3 + 1] = baseY + 1.4 + this.random() * 3;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        this.droplets = new THREE.Points(geometry, this.bin.material(new THREE.PointsMaterial({
            color: 0xd8f2ff,
            size: 0.16,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        })));
        this.droplets.frustumCulled = false;
        this.droplets.userData.baseY = baseY;
        this.scene.add(this.droplets);
    }

    private resetDroplet(positions: Float32Array, velocities: Float32Array, index: number, baseY: number) {
        const angle = this.random() * Math.PI * 2;
        const i3 = index * 3;
        positions[i3] = Math.cos(angle) * 2.4;
        positions[i3 + 1] = baseY + 4.4;
        positions[i3 + 2] = Math.sin(angle) * 2.4;
        velocities[i3] = Math.cos(angle) * (1 + this.random() * 0.9);
        velocities[i3 + 1] = 1.6 + this.random() * 1.6;
        velocities[i3 + 2] = Math.sin(angle) * (1 + this.random() * 0.9);
    }

    // The board is a canvas, not a baked sheet: whatever the schedule says on
    // the next poll gets redrawn in place.
    private directoryRows(events: ResolvedEvent[]): DirectoryRow[] {
        const byId = new Map(events.map((event) => [event.id, event]));

        return EVENT_DOORS.map((door) => {
            const state = byId.get(door.id);
            const open = state ? state.enabled && eventWindow(state).open : door.live;
            const upcoming = !!state && state.enabled && eventWindow(state).state === "upcoming";

            return {
                label: `${door.glyph}  ${t(state?.title ?? door.name)}`,
                value: open ? t("g.lobby.open") : upcoming ? t("g.lobby.soon") : t("g.lobby.sealed"),
                accent: `#${new THREE.Color(state?.accent ?? door.accent).getHexString()}`,
                live: open,
            };
        });
    }

    public applyEvents(events: ResolvedEvent[]) {
        if (!this.directoryTexture) return;
        this.lastEvents = events;

        const rows = this.directoryRows(events);
        const signature = rows.map((row) => `${row.label}:${row.value}`).join("|");
        if (signature === this.directorySignature) return;

        this.directorySignature = signature;
        drawDirectory(this.directoryTexture.image as HTMLCanvasElement, rows);
        this.directoryTexture.needsUpdate = true;
    }

    private buildDirectory(materials: ShellMaterials) {
        const rows = this.directoryRows([]);
        this.directorySignature = rows.map((row) => `${row.label}:${row.value}`).join("|");

        // The board is redrawn from the last schedule we saw, so a language
        // switch does not have to wait for the next poll.
        this.stopLanguageWatch = onLanguageChange(() => {
            this.directorySignature = "";
            this.applyEvents(this.lastEvents);
        });

        const angle = Math.PI + Math.PI / BAY_COUNT;
        const board = new THREE.Group();
        placeOnRing(board, angle, 34);

        const stand = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.2, 1.1), materials.bronze);
        stand.position.y = 1.6;
        stand.castShadow = true;
        board.add(stand);

        const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.3, 0.5, 20), materials.marble);
        foot.position.y = 0.25;
        foot.receiveShadow = true;
        board.add(foot);

        const frame = new THREE.Mesh(new THREE.BoxGeometry(8.6, 8.6, 0.4), materials.gilded);
        frame.position.y = 7.2;
        frame.castShadow = true;
        board.add(frame);

        const panel = new THREE.Mesh(
            new THREE.PlaneGeometry(8, 8),
            this.bin.material(new THREE.MeshBasicMaterial({
                map: (this.directoryTexture = createDirectoryTexture(this.bin, rows)),
                toneMapped: false,
                fog: false,
            }))
        );
        panel.position.set(0, 7.2, 0.22);
        board.add(panel);

        const crown = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.5, 0.9), materials.gilded);
        crown.position.y = 11.7;
        board.add(crown);

        const readLight = new THREE.PointLight(0xffeccd, 12, 20, 2);
        readLight.position.set(0, 11, 2.4);
        board.add(readLight);

        this.scene.add(board);
        this.collisionGrid.insertOrientedBox(board.position.x, board.position.z, 9, 2.4, board.rotation.y, 0, 12);
    }

    private buildBenches(materials: ShellMaterials) {
        const seat = this.bin.geometry(new THREE.BoxGeometry(7.4, 0.42, 2.1));
        const legGeometry = this.bin.geometry(new THREE.BoxGeometry(0.5, 1.1, 1.7));
        const backGeometry = this.bin.geometry(new THREE.BoxGeometry(7.4, 1.5, 0.28));

        for (let i = 0; i < BAY_COUNT; i++) {
            const angle = bayAngle(i) + Math.PI / BAY_COUNT;
            const group = new THREE.Group();
            placeOnRing(group, angle, BENCH_RING_RADIUS);

            const top = new THREE.Mesh(seat, materials.marble);
            top.position.y = 1.32;
            top.castShadow = true;
            top.receiveShadow = true;
            group.add(top);

            for (const side of [-1, 1]) {
                const leg = new THREE.Mesh(legGeometry, materials.bronze);
                leg.position.set(side * 2.9, 0.55, 0);
                group.add(leg);
            }

            const back = new THREE.Mesh(backGeometry, materials.marble);
            back.position.set(0, 2.28, -0.9);
            back.castShadow = true;
            group.add(back);

            const rail = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.16, 0.36), materials.gilded);
            rail.position.set(0, 3.05, -0.9);
            group.add(rail);

            this.scene.add(group);
            this.collisionGrid.insertOrientedBox(
                group.position.x,
                group.position.z,
                7.4,
                2.4,
                group.rotation.y,
                0,
                1.5
            );
        }
    }

    private buildPlanters(materials: ShellMaterials) {
        const foliage = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x2f6b3f,
            roughness: 0.85,
            metalness: 0,
        }));
        const foliageLight = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x4f9455,
            roughness: 0.8,
            metalness: 0,
        }));
        const trunk = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x4a3826,
            roughness: 0.92,
            metalness: 0,
        }));

        const potGeometry = this.bin.geometry(new THREE.CylinderGeometry(1.75, 1.35, 2, 20));
        const soilGeometry = this.bin.geometry(new THREE.CylinderGeometry(1.6, 1.6, 0.2, 20));
        const trunkGeometry = this.bin.geometry(new THREE.CylinderGeometry(0.22, 0.32, 3, 10));
        const leafGeometry = this.bin.geometry(new THREE.IcosahedronGeometry(1, 0));

        for (let i = 0; i < BAY_COUNT * 2; i++) {
            const angle = (i / (BAY_COUNT * 2)) * Math.PI * 2 + Math.PI / (BAY_COUNT * 2);
            const group = new THREE.Group();
            placeOnRing(group, angle, PLANTER_RING_RADIUS);

            const pot = new THREE.Mesh(potGeometry, materials.marble);
            pot.position.y = 1;
            pot.castShadow = true;
            pot.receiveShadow = true;
            group.add(pot);

            const band = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.1, 6, 20), materials.gilded);
            band.rotation.x = Math.PI / 2;
            band.position.y = 1.65;
            group.add(band);

            const soil = new THREE.Mesh(soilGeometry, trunk);
            soil.position.y = 2;
            group.add(soil);

            const stem = new THREE.Mesh(trunkGeometry, trunk);
            stem.position.y = 3.4;
            group.add(stem);

            for (let b = 0; b < 5; b++) {
                const blob = new THREE.Mesh(leafGeometry, b % 2 === 0 ? foliage : foliageLight);
                const spread = 0.9 + this.random() * 0.7;
                blob.position.set(
                    (this.random() - 0.5) * 2.2,
                    4.4 + this.random() * 1.9,
                    (this.random() - 0.5) * 2.2
                );
                blob.scale.setScalar(spread);
                blob.castShadow = true;
                group.add(blob);
            }

            this.scene.add(group);
            this.collisionGrid.insertCylinder(new THREE.Vector3(group.position.x, 1, group.position.z), 1.9, 2.4);
        }
    }

    private buildChandeliers(materials: ShellMaterials) {
        const armGeometry = this.bin.geometry(new THREE.TorusGeometry(2.6, 0.12, 6, 28));
        const candleGeometry = this.bin.geometry(new THREE.CylinderGeometry(0.16, 0.18, 0.8, 8));
        const flameGeometry = this.bin.geometry(new THREE.ConeGeometry(0.2, 0.66, 8));
        const chainGeometry = this.bin.geometry(new THREE.CylinderGeometry(0.07, 0.07, 6, 6));

        const positions: [number, number][] = [[0, 0]];
        for (let i = 0; i < CHANDELIER_COUNT - 1; i++) {
            const angle = (i / (CHANDELIER_COUNT - 1)) * Math.PI * 2;
            positions.push([Math.sin(angle) * CHANDELIER_RING_RADIUS, -Math.cos(angle) * CHANDELIER_RING_RADIUS]);
        }

        positions.forEach(([x, z], index) => {
            const group = new THREE.Group();
            group.position.set(x, CHANDELIER_Y, z);

            const chain = new THREE.Mesh(chainGeometry, materials.bronze);
            chain.position.y = 3.6;
            group.add(chain);

            const crown = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.3, 12), materials.gilded);
            crown.position.y = 1.1;
            group.add(crown);

            for (const [radius, y] of [[2.6, 0], [1.7, 1.1]] as const) {
                const ring = new THREE.Mesh(armGeometry, materials.gilded);
                ring.rotation.x = Math.PI / 2;
                ring.scale.setScalar(radius / 2.6);
                ring.position.y = y;
                group.add(ring);
            }

            const flameMaterial = this.bin.material(new THREE.MeshBasicMaterial({
                color: 0xffdba4,
                transparent: true,
                opacity: 0.92,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
                fog: false,
            }));

            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2;
                const outer = i % 2 === 0;
                const radius = outer ? 2.6 : 1.7;
                const y = outer ? 0.5 : 1.6;

                const candle = new THREE.Mesh(candleGeometry, materials.marble);
                candle.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
                group.add(candle);

                const flame = new THREE.Mesh(flameGeometry, flameMaterial);
                flame.position.set(Math.cos(angle) * radius, y + 0.68, Math.sin(angle) * radius);
                group.add(flame);
            }

            const light = new THREE.PointLight(0xffe3b8, index === 0 ? 46 : 30, 52, 2);
            light.position.y = 0.4;
            group.add(light);

            this.scene.add(group);
            this.chandeliers.push({ group, material: flameMaterial, light, phase: index * 1.31 });
        });
    }

    private buildBanners() {
        const bannerMaterials = EVENT_DOORS.map((event) => this.bin.material(new THREE.MeshStandardMaterial({
            color: event.accent,
            roughness: 0.86,
            metalness: 0.04,
            side: THREE.DoubleSide,
            emissive: new THREE.Color(event.accent).multiplyScalar(event.live ? 0.22 : 0.04),
        })));

        const geometry = this.bin.geometry(new THREE.PlaneGeometry(3.4, 9, 1, 8));

        for (let i = 0; i < BANNER_COUNT; i++) {
            const angle = bayAngle(i) + Math.PI / BAY_COUNT;
            const banner = new THREE.Mesh(geometry, bannerMaterials[i % bannerMaterials.length]);
            placeOnRing(banner, angle, HALL_RADIUS - 0.4, WALL_HEIGHT - 5.6);
            banner.castShadow = false;
            this.scene.add(banner);
            this.banners.push(banner);

            const rod = new THREE.Mesh(
                new THREE.CylinderGeometry(0.12, 0.12, 3.9, 8),
                this.bin.material(new THREE.MeshStandardMaterial({ color: 0xd8b46a, roughness: 0.3, metalness: 0.9 }))
            );
            placeOnRing(rod, angle, HALL_RADIUS - 0.4, WALL_HEIGHT - 1);
            rod.rotation.z = Math.PI / 2;
            this.scene.add(rod);
        }
    }

    update(delta: number) {
        this.elapsed += delta;

        if (this.candleFlame) {
            const flicker = 1 + Math.sin(this.elapsed * 9) * 0.1 + Math.sin(this.elapsed * 21) * 0.05;
            this.candleFlame.scale.set(flicker, flicker * 1.05, flicker);
        }
        if (this.candleLight) {
            this.candleLight.intensity = 24 + Math.sin(this.elapsed * 7.5) * 3.5;
        }

        for (const chandelier of this.chandeliers) {
            chandelier.material.opacity = 0.84 + Math.sin(this.elapsed * 6 + chandelier.phase) * 0.09;
            chandelier.light.intensity = (chandelier.phase === 0 ? 44 : 29) + Math.sin(this.elapsed * 4.4 + chandelier.phase) * 3;
            chandelier.group.rotation.y = Math.sin(this.elapsed * 0.16 + chandelier.phase) * 0.05;
        }

        for (let i = 0; i < this.banners.length; i++) {
            this.banners[i].rotation.x = Math.sin(this.elapsed * 0.7 + i) * 0.018;
        }

        if (this.jetMaterial) {
            this.jetMaterial.opacity = 0.3 + Math.sin(this.elapsed * 3.1) * 0.06;
        }

        this.updateDroplets(delta);
    }

    private updateDroplets(delta: number) {
        if (!this.droplets || !this.dropletVelocities) return;

        const attribute = this.droplets.geometry.getAttribute("position") as THREE.BufferAttribute;
        const positions = attribute.array as Float32Array;
        const baseY = this.droplets.userData.baseY as number;

        for (let i = 0; i < DROPLET_COUNT; i++) {
            const i3 = i * 3;
            this.dropletVelocities[i3 + 1] -= 9.2 * delta;
            positions[i3] += this.dropletVelocities[i3] * delta;
            positions[i3 + 1] += this.dropletVelocities[i3 + 1] * delta;
            positions[i3 + 2] += this.dropletVelocities[i3 + 2] * delta;

            if (positions[i3 + 1] < baseY + 1.3) {
                this.resetDroplet(positions, this.dropletVelocities, i, baseY);
            }
        }

        attribute.needsUpdate = true;
    }

    dispose() {
        this.stopLanguageWatch?.();
        this.stopLanguageWatch = null;
        this.chandeliers = [];
        this.banners = [];
        this.droplets = null;
        this.dropletVelocities = null;
        this.candleFlame = null;
        this.candleLight = null;
        this.waterMaterial = null;
        this.jetMaterial = null;
    }
}
