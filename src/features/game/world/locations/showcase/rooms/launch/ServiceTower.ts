// src/features/game/world/locations/showcase/rooms/launch/ServiceTower.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import { ShowcaseTextures, surfaceMaterial } from "../../textures";

export interface ServiceTowerOptions {
    height: number;
    baseY: number;
    armY: number;
    armReach: number;
    cageLowY: number;
    cageHighY: number;
    accent?: number;
}

const LEG_SPAN = 2.6;

export class ServiceTower {
    public readonly group = new THREE.Group();
    public readonly cage = new THREE.Group();

    private arm: THREE.Group | null = null;
    private readonly beacons: THREE.MeshBasicMaterial[] = [];
    private readonly lamps: THREE.PointLight[] = [];

    constructor(
        private readonly bin: AssetBin,
        private readonly tex: ShowcaseTextures,
        private readonly options: ServiceTowerOptions
    ) { }

    private mesh(
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        position?: [number, number, number],
        rotation?: [number, number, number]
    ): THREE.Mesh {
        const created = new THREE.Mesh(this.bin.geometry(geometry), material);
        if (position) created.position.set(position[0], position[1], position[2]);
        if (rotation) created.rotation.set(rotation[0], rotation[1], rotation[2]);
        created.castShadow = true;
        created.receiveShadow = true;
        return created;
    }

    public create(): THREE.Group {
        const steel = surfaceMaterial(this.bin, this.tex.panel([2, 1], 0x9aa2ae, 0x4a4f58, 3), { roughness: 0.48, metalness: 0.74, bump: 0.05 });
        const paint = this.bin.material(new THREE.MeshStandardMaterial({ color: 0xd94f4f, roughness: 0.6, metalness: 0.4 }));
        const grate = surfaceMaterial(this.bin, this.tex.grid([2, 2], 0x2f353d, 0x8a919b, 6), { roughness: 0.7, metalness: 0.5 });

        const { height, baseY, armY, armReach, cageLowY, cageHighY } = this.options;
        this.group.position.y = baseY;

        for (const dx of [-LEG_SPAN, LEG_SPAN]) {
            for (const dz of [-LEG_SPAN, LEG_SPAN]) {
                this.group.add(this.mesh(new THREE.BoxGeometry(0.42, height, 0.42), steel, [dx, height / 2, dz]));
            }
        }

        const step = (armY - baseY) / 6;
        const levels = Math.floor(height / step);
        for (let level = 1; level <= levels; level++) {
            const y = level * step;

            const deck = this.mesh(new THREE.BoxGeometry(LEG_SPAN * 2, 0.16, LEG_SPAN * 2), grate, [0, y, 0]);
            deck.castShadow = false;
            this.group.add(deck);

            for (const dz of [-LEG_SPAN, LEG_SPAN]) {
                const rail = this.mesh(new THREE.BoxGeometry(LEG_SPAN * 2, 0.1, 0.1), steel, [0, y + 1.05, dz]);
                rail.castShadow = false;
                this.group.add(rail);
            }

            for (const dx of [-LEG_SPAN, LEG_SPAN]) {
                const brace = this.mesh(new THREE.BoxGeometry(0.16, step * 1.15, 0.16), steel, [dx, y - step / 2, 0], [level % 2 === 0 ? 0.62 : -0.62, 0, 0]);
                brace.castShadow = false;
                this.group.add(brace);

                const rail = this.mesh(new THREE.BoxGeometry(0.1, 0.1, LEG_SPAN * 2), steel, [dx, y + 1.05, 0]);
                rail.castShadow = false;
                this.group.add(rail);
            }
        }

        for (const dz of [-LEG_SPAN + 0.3, LEG_SPAN - 0.3]) {
            const guide = this.mesh(new THREE.BoxGeometry(0.2, cageHighY - baseY + 2, 0.2), steel, [-LEG_SPAN - 0.55, (cageHighY - baseY) / 2, dz]);
            guide.castShadow = false;
            this.group.add(guide);
        }

        this.buildCage(steel, grate);

        const mast = this.mesh(new THREE.CylinderGeometry(0.12, 0.2, 9, 8), steel, [0, height + 4.4, 0]);
        this.group.add(mast);

        for (const level of [0.4, 0.72, 1]) {
            const material = this.bin.material(new THREE.MeshBasicMaterial({ color: 0xff4a4a, transparent: true, opacity: 0.9, toneMapped: false }));
            this.beacons.push(material);

            const bulb = this.mesh(new THREE.SphereGeometry(0.26, 10, 8), material, [0, height * level, LEG_SPAN + 0.2]);
            bulb.castShadow = false;
            this.group.add(bulb);
        }

        for (const level of [0.32, 0.66]) {
            const lamp = new THREE.PointLight(this.options.accent ?? 0xffe6c4, 28, 34, 2);
            lamp.position.set(LEG_SPAN + 0.6, height * level, 0);
            this.group.add(lamp);
            this.lamps.push(lamp);

            const housing = this.mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), steel, [LEG_SPAN + 0.3, height * level, 0]);
            housing.castShadow = false;
            this.group.add(housing);
        }

        const arm = new THREE.Group();
        arm.position.set(LEG_SPAN - 0.2, armY - baseY, 0);
        this.arm = arm;
        this.group.add(arm);

        const truss = this.mesh(new THREE.BoxGeometry(armReach, 0.24, 1.9), grate, [armReach / 2, 0, 0]);
        truss.castShadow = false;
        arm.add(truss);

        for (const dz of [-0.95, 0.95]) {
            const rail = this.mesh(new THREE.BoxGeometry(armReach, 0.1, 0.1), steel, [armReach / 2, 1.05, dz]);
            rail.castShadow = false;
            arm.add(rail);

            for (let i = 0; i <= 4; i++) {
                const post = this.mesh(new THREE.BoxGeometry(0.09, 1.1, 0.09), steel, [(armReach / 4) * i, 0.55, dz]);
                post.castShadow = false;
                arm.add(post);
            }
        }

        for (const dz of [-1.28, 1.28]) {
            const wall = this.mesh(new THREE.BoxGeometry(2.4, 2.9, 0.22), paint, [armReach - 0.9, 1.45, dz]);
            wall.castShadow = false;
            arm.add(wall);
        }

        const roof = this.mesh(new THREE.BoxGeometry(2.6, 0.22, 2.8), paint, [armReach - 0.9, 2.9, 0]);
        roof.castShadow = false;
        arm.add(roof);

        for (const dz of [-1.05, 1.05]) {
            const collar = this.mesh(
                new THREE.BoxGeometry(0.5, 2.3, 0.3),
                this.bin.material(new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.9 })),
                [armReach + 0.3, 1.2, dz]
            );
            collar.castShadow = false;
            arm.add(collar);
        }

        return this.group;
    }

    private buildCage(steel: THREE.Material, grate: THREE.Material) {
        this.cage.position.set(-LEG_SPAN - 0.55, this.options.cageLowY - this.options.baseY, 0);
        this.group.add(this.cage);

        const floor = this.mesh(new THREE.BoxGeometry(1.9, 0.14, 2.2), grate, [0, 0, 0]);
        floor.castShadow = false;
        this.cage.add(floor);

        const roof = this.mesh(new THREE.BoxGeometry(1.9, 0.12, 2.2), steel, [0, 2.5, 0]);
        roof.castShadow = false;
        this.cage.add(roof);

        for (const dx of [-0.9, 0.9]) {
            for (const dz of [-1.05, 1.05]) {
                const post = this.mesh(new THREE.BoxGeometry(0.11, 2.5, 0.11), steel, [dx, 1.25, dz]);
                post.castShadow = false;
                this.cage.add(post);
            }
        }

        for (const dz of [-1.05, 1.05]) {
            for (const y of [0.6, 1.3, 2]) {
                const bar = this.mesh(new THREE.BoxGeometry(1.8, 0.07, 0.07), steel, [0, y, dz]);
                bar.castShadow = false;
                this.cage.add(bar);
            }
        }

        const back = this.mesh(new THREE.BoxGeometry(0.1, 2.5, 2.2), steel, [-0.92, 1.25, 0]);
        back.castShadow = false;
        this.cage.add(back);

        const lamp = new THREE.PointLight(0xffe6c4, 8, 9, 2);
        lamp.position.set(0, 2.2, 0);
        this.cage.add(lamp);
    }

    public setCage(amount: number) {
        const t = THREE.MathUtils.clamp(amount, 0, 1);
        this.cage.position.y = THREE.MathUtils.lerp(
            this.options.cageLowY - this.options.baseY,
            this.options.cageHighY - this.options.baseY,
            t
        );
    }

    public cageY(amount: number): number {
        return THREE.MathUtils.lerp(this.options.cageLowY, this.options.cageHighY, THREE.MathUtils.clamp(amount, 0, 1));
    }

    public setArm(amount: number) {
        if (this.arm) this.arm.rotation.y = THREE.MathUtils.clamp(amount, 0, 1) * 1.55;
    }

    public update(elapsed: number) {
        const pulse = Math.abs(Math.sin(elapsed * 1.6));
        for (let i = 0; i < this.beacons.length; i++) {
            this.beacons[i].opacity = 0.25 + pulse * 0.7;
        }
    }

    public dispose() {
        this.beacons.length = 0;
        this.lamps.length = 0;
        this.arm = null;
    }
}
