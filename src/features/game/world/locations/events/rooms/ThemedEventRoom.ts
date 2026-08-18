// src/features/game/world/locations/events/rooms/ThemedEventRoom.ts
import * as THREE from "three";
import { EventRoom } from "../EventRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { EventRoomTheme } from "../roomThemes";
import { createPlaqueTexture } from "../lobbyTextures";
import { EVENT_DOORS_BY_ID } from "../../../../data/eventDoors";

export class ThemedEventRoom extends EventRoom {
    private beacon: THREE.Mesh | null = null;
    private beaconMaterial: THREE.MeshBasicMaterial | null = null;
    private beaconLight: THREE.PointLight | null = null;
    private orbiters: THREE.Object3D[] = [];
    private pulseMaterials: THREE.MeshBasicMaterial[] = [];
    private clock = 0;

    constructor(theme: EventRoomTheme, seed: number) {
        super(theme, seed);
    }

    protected decorate(_rm: ResourceManager): void {
        this.buildCentrepiece();
        this.buildProps();
        this.buildHerald();
    }

    private themedMaterial(color: number, roughness = 0.82, metalness = 0.1): THREE.MeshStandardMaterial {
        return this.bin.material(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    }

    private glowMaterial(color: number, opacity: number): THREE.MeshBasicMaterial {
        const material = this.bin.material(new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        }));
        this.pulseMaterials.push(material);
        return material;
    }

    private buildCentrepiece() {
        const stone = this.themedMaterial(this.theme.propColor, 0.86, 0.12);
        const metal = this.themedMaterial(this.theme.wallAccent, 0.44, 0.72);

        const dais = new THREE.Group();

        for (let step = 0; step < 3; step++) {
            const radius = 11 - step * 2.6;
            const top = 0.4 + step * 0.4;
            const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.4, 0.4, 48), stone);
            disc.position.y = top - 0.2;
            disc.receiveShadow = true;
            disc.castShadow = true;
            dais.add(disc);
            this.collisionGrid.insertPlatform(0, radius + 0.4, top - 0.4, top);
        }

        const glyphRing = new THREE.Mesh(
            new THREE.RingGeometry(6.2, 7.4, 64),
            this.glowMaterial(this.theme.accent, 0.34)
        );
        glyphRing.rotation.x = -Math.PI / 2;
        glyphRing.position.y = 1.25;
        dais.add(glyphRing);

        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 2.4, 11, 6), metal);
        spire.position.y = 6.7;
        spire.castShadow = true;
        dais.add(spire);

        this.beaconMaterial = this.bin.material(new THREE.MeshBasicMaterial({
            color: this.theme.accent,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        }));

        this.beacon = new THREE.Mesh(new THREE.OctahedronGeometry(2.4, 0), this.beaconMaterial);
        this.beacon.position.y = 14.4;
        dais.add(this.beacon);

        const cage = new THREE.Mesh(new THREE.OctahedronGeometry(3.3, 0), metal);
        cage.position.y = 14.4;
        cage.scale.setScalar(1);
        dais.add(cage);
        this.orbiters.push(cage);

        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(4 + i * 1.1, 0.14, 6, 40), metal);
            ring.position.y = 14.4;
            ring.rotation.x = Math.PI / 3 * i;
            ring.rotation.z = i * 0.6;
            dais.add(ring);
            this.orbiters.push(ring);
        }

        this.beaconLight = new THREE.PointLight(this.theme.accent, 40, 62, 2);
        this.beaconLight.position.y = 14.4;
        dais.add(this.beaconLight);

        const shaft = new THREE.Mesh(
            new THREE.CylinderGeometry(2.2, 5.4, this.theme.wallHeight + 10, 24, 1, true),
            this.glowMaterial(this.theme.accent, 0.07)
        );
        shaft.position.y = 14.4 + (this.theme.wallHeight + 10) / 2;
        dais.add(shaft);

        this.collisionGrid.insertCylinder(new THREE.Vector3(0, 6, 0), 2.6, 12);
        this.scene.add(dais);
    }

    private buildProps() {
        const count = this.theme.propCount;
        const innerRadius = 18;
        const outerRadius = this.theme.radius - 8;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + this.random() * 0.24;
            const radius = innerRadius + this.random() * (outerRadius - innerRadius);
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = this.random() * Math.PI * 2;

            const footprint = this.buildProp(group, i);

            this.scene.add(group);
            if (footprint > 0) {
                this.collisionGrid.insertCylinder(new THREE.Vector3(x, 3, z), footprint, 8);
            }
        }
    }

    private buildProp(group: THREE.Group, index: number): number {
        const stone = this.themedMaterial(this.theme.propColor, 0.88, 0.08);
        const metal = this.themedMaterial(this.theme.wallAccent, 0.4, 0.76);

        switch (this.theme.prop) {
            case "monolith": {
                const height = 7 + this.random() * 11;
                const slab = new THREE.Mesh(new THREE.BoxGeometry(3.4, height, 1.6), stone);
                slab.position.y = height / 2;
                slab.rotation.z = (this.random() - 0.5) * 0.5;
                slab.castShadow = true;
                slab.receiveShadow = true;
                group.add(slab);

                const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.5, height * 0.7), this.glowMaterial(this.theme.accent, 0.4));
                crack.position.set(0, height / 2, 0.86);
                crack.rotation.z = (this.random() - 0.5) * 0.5;
                group.add(crack);
                return 2.2;
            }

            case "rig": {
                const bars = 4;
                for (let i = 0; i < bars; i++) {
                    const height = 3 + this.random() * 10;
                    const up = this.random() > 0.35;
                    const bar = new THREE.Mesh(
                        new THREE.BoxGeometry(1.5, height, 1.5),
                        this.themedMaterial(up ? 0x3fbf6f : 0xbf3f4f, 0.6, 0.24)
                    );
                    bar.position.set((i - bars / 2) * 2.1, height / 2, 0);
                    bar.castShadow = true;
                    group.add(bar);

                    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, height + 3.4, 6), metal);
                    wick.position.set((i - bars / 2) * 2.1, (height + 3.4) / 2, 0);
                    group.add(wick);
                }
                return 4.4;
            }

            case "reef": {
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.1, 5 + this.random() * 5, 8), stone);
                trunk.position.y = 3;
                trunk.castShadow = true;
                group.add(trunk);

                for (let i = 0; i < 5; i++) {
                    const fan = new THREE.Mesh(
                        new THREE.SphereGeometry(1.2 + this.random() * 1.4, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
                        this.themedMaterial(this.theme.accent, 0.7, 0.1)
                    );
                    fan.position.set((this.random() - 0.5) * 3, 4 + this.random() * 4, (this.random() - 0.5) * 3);
                    fan.scale.set(1, 0.5 + this.random(), 1);
                    fan.castShadow = true;
                    group.add(fan);
                }
                return 2.6;
            }

            case "vault": {
                const box = new THREE.Mesh(new THREE.BoxGeometry(4.4, 5.2, 3.4), metal);
                box.position.y = 2.6;
                box.castShadow = true;
                box.receiveShadow = true;
                group.add(box);

                const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.22, 8, 20), stone);
                wheel.position.set(0, 2.8, 1.8);
                group.add(wheel);
                this.orbiters.push(wheel);

                for (let i = 0; i < 4; i++) {
                    const coin = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.85, 0.85, 0.22, 20),
                        this.themedMaterial(this.theme.accent, 0.28, 0.9)
                    );
                    coin.position.set(2.9, 0.2 + i * 0.26, -1.4 + this.random() * 0.6);
                    coin.rotation.z = 0.06;
                    group.add(coin);
                }
                return 3;
            }

            case "pylon": {
                const height = 14 + this.random() * 10;
                const mast = new THREE.Mesh(new THREE.BoxGeometry(1.5, height, 1.5), metal);
                mast.position.y = height / 2;
                mast.castShadow = true;
                group.add(mast);

                for (const y of [height * 0.55, height * 0.82]) {
                    const arm = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.7), metal);
                    arm.position.y = y;
                    group.add(arm);
                }

                const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 16, 5), metal);
                cable.position.set(0, height * 0.7, 0);
                cable.rotation.z = Math.PI / 2.4;
                group.add(cable);

                const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), this.glowMaterial(this.theme.accent, 0.8));
                beacon.position.y = height + 0.6;
                group.add(beacon);
                return 2;
            }

            case "ledger": {
                const height = 8 + this.random() * 7;
                const slab = new THREE.Mesh(new THREE.BoxGeometry(4.6, height, 0.9), stone);
                slab.position.y = height / 2;
                slab.castShadow = true;
                slab.receiveShadow = true;
                group.add(slab);

                for (let i = 0; i < 7; i++) {
                    const line = new THREE.Mesh(
                        new THREE.PlaneGeometry(3.4 - this.random() * 1.6, 0.16),
                        this.glowMaterial(this.theme.accent, 0.5)
                    );
                    line.position.set(-0.3, height * 0.18 + i * (height * 0.1), 0.48);
                    group.add(line);
                }

                const frame = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 1.2), metal);
                frame.position.y = height + 0.2;
                group.add(frame);
                return 2.6;
            }

            case "cache": {
                const crate = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3, 3.2), stone);
                crate.position.y = 1.5;
                crate.rotation.z = (this.random() - 0.5) * 0.14;
                crate.castShadow = true;
                crate.receiveShadow = true;
                group.add(crate);

                for (const axis of [0, 1]) {
                    const strap = new THREE.Mesh(
                        new THREE.BoxGeometry(axis === 0 ? 3.4 : 0.5, 3.2, axis === 0 ? 0.5 : 3.4),
                        metal
                    );
                    strap.position.y = 1.5;
                    group.add(strap);
                }

                const beaconLamp = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), this.glowMaterial(this.theme.accent, 0.85));
                beaconLamp.position.set(0, 3.3, 0);
                group.add(beaconLamp);

                if (index % 3 === 0) {
                    const canopy = new THREE.Mesh(
                        new THREE.SphereGeometry(3.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.4),
                        this.themedMaterial(this.theme.accent, 0.9, 0.02)
                    );
                    canopy.position.y = 6.4;
                    canopy.castShadow = true;
                    group.add(canopy);

                    for (let i = 0; i < 4; i++) {
                        const angle = (i / 4) * Math.PI * 2;
                        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 4), metal);
                        cord.position.set(Math.cos(angle) * 1.4, 4.6, Math.sin(angle) * 1.4);
                        cord.rotation.z = Math.cos(angle) * 0.28;
                        cord.rotation.x = -Math.sin(angle) * 0.28;
                        group.add(cord);
                    }
                }
                return 2.2;
            }

            case "pyre": {
                const height = 2.4 + this.random() * 1.6;
                for (let layer = 0; layer < 3; layer++) {
                    for (let i = 0; i < 3; i++) {
                        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 4.4, 7), stone);
                        log.rotation.z = Math.PI / 2;
                        log.rotation.y = layer % 2 === 0 ? 0 : Math.PI / 2;
                        log.position.set(layer % 2 === 0 ? 0 : (i - 1) * 1.1, 0.4 + layer * 0.75, layer % 2 === 0 ? (i - 1) * 1.1 : 0);
                        log.castShadow = true;
                        group.add(log);
                    }
                }

                const fire = new THREE.Mesh(new THREE.ConeGeometry(1.5, height + 2.6, 10), this.glowMaterial(this.theme.accent, 0.65));
                fire.position.y = 3.2;
                group.add(fire);

                const core = new THREE.Mesh(new THREE.ConeGeometry(0.7, height + 0.8, 8), this.glowMaterial(this.theme.trim, 0.8));
                core.position.y = 2.8;
                group.add(core);
                return 2.4;
            }

            case "crystal":
            default: {
                const cluster = 3 + Math.floor(this.random() * 3);
                for (let i = 0; i < cluster; i++) {
                    const height = 4 + this.random() * 9;
                    const shard = new THREE.Mesh(
                        new THREE.ConeGeometry(0.7 + this.random() * 0.9, height, 6),
                        this.bin.material(new THREE.MeshPhysicalMaterial({
                            color: this.theme.accent,
                            roughness: 0.08,
                            metalness: 0,
                            transmission: 0.6,
                            thickness: 1.4,
                            transparent: true,
                            opacity: 0.82,
                            envMapIntensity: 1.4,
                        }))
                    );
                    shard.position.set((this.random() - 0.5) * 3.2, height / 2, (this.random() - 0.5) * 3.2);
                    shard.rotation.z = (this.random() - 0.5) * 0.5;
                    shard.rotation.x = (this.random() - 0.5) * 0.5;
                    shard.castShadow = true;
                    group.add(shard);
                }

                const bed = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 0), stone);
                bed.position.y = 0.6;
                bed.scale.y = 0.5;
                bed.receiveShadow = true;
                group.add(bed);
                return 2.6;
            }
        }
    }

    private buildHerald() {
        const event = EVENT_DOORS_BY_ID.get(this.theme.id);
        if (!event) return;

        const accent = `#${new THREE.Color(this.theme.accent).getHexString()}`;
        const stone = this.themedMaterial(this.theme.wallAccent, 0.7, 0.24);
        const gold = this.themedMaterial(0xd8b46a, 0.28, 0.9);

        const group = new THREE.Group();
        group.position.set(0, 0, this.theme.radius - 20);
        group.rotation.y = Math.PI;

        const base = new THREE.Mesh(new THREE.BoxGeometry(12, 0.7, 3), stone);
        base.position.y = 0.35;
        base.receiveShadow = true;
        group.add(base);

        for (const side of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 7.4, 12), gold);
            post.position.set(side * 5, 4.1, 0);
            post.castShadow = true;
            group.add(post);
        }

        const panel = new THREE.Mesh(
            new THREE.PlaneGeometry(9.6, 2.4),
            this.bin.material(new THREE.MeshBasicMaterial({
                map: createPlaqueTexture(this.bin, event.name, `${event.tagline} — preparing`, accent, true),
                transparent: true,
                side: THREE.DoubleSide,
                toneMapped: false,
            }))
        );
        panel.position.set(0, 6, 0.2);
        group.add(panel);

        const frame = new THREE.Mesh(new THREE.BoxGeometry(10.2, 3, 0.3), stone);
        frame.position.set(0, 6, 0);
        frame.castShadow = true;
        group.add(frame);

        const halo = new THREE.Mesh(new THREE.PlaneGeometry(13, 5.4), this.glowMaterial(this.theme.accent, 0.16));
        halo.position.set(0, 6, 0.34);
        group.add(halo);

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(group.position.x, group.position.z, 12, 2.4, group.rotation.y, 0, 8);
    }

    override update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);
        this.clock += delta;

        if (this.beacon) {
            this.beacon.rotation.y += delta * 0.6;
            this.beacon.rotation.x += delta * 0.24;
            this.beacon.scale.setScalar(1 + Math.sin(this.clock * 2.1) * 0.08);
        }
        if (this.beaconMaterial) {
            this.beaconMaterial.opacity = 0.72 + Math.sin(this.clock * 2.6) * 0.16;
        }
        if (this.beaconLight) {
            this.beaconLight.intensity = 34 + Math.sin(this.clock * 1.9) * 8;
        }

        for (let i = 0; i < this.orbiters.length; i++) {
            this.orbiters[i].rotation.y += delta * (0.18 + i * 0.07);
        }

        for (let i = 0; i < this.pulseMaterials.length; i++) {
            const material = this.pulseMaterials[i];
            const base = material.userData.baseOpacity ?? material.opacity;
            material.userData.baseOpacity = base;
            material.opacity = base * (0.82 + Math.sin(this.clock * 1.7 + i * 0.4) * 0.18);
        }
    }

    dispose() {
        this.beacon = null;
        this.beaconMaterial = null;
        this.beaconLight = null;
        this.orbiters = [];
        this.pulseMaterials = [];
        super.dispose();
    }
}
