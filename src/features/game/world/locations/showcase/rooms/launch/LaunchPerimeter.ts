// src/features/game/world/locations/showcase/rooms/launch/LaunchPerimeter.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import { CollisionGrid } from "../../../../CollisionGrid";
import { ShowcaseTextures, surfaceMaterial } from "../../textures";
import {
    ASSEMBLY_BUILDING,
    COMMS_MASTS,
    GATEHOUSE,
    HANGARS,
    OFFICE,
    WAREHOUSES,
    groundHeightAt,
    type SiteBuilding,
} from "./launchLayout";

export interface LaunchPerimeterDeps {
    scene: THREE.Scene;
    bin: AssetBin;
    tex: ShowcaseTextures;
    random: () => number;
    grid: CollisionGrid;
    lean: boolean;
}

export class LaunchPerimeter {
    private readonly beacons: THREE.MeshBasicMaterial[] = [];
    private readonly windows: THREE.MeshStandardMaterial[] = [];

    constructor(private readonly deps: LaunchPerimeterDeps) { }

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

        const concrete = surfaceMaterial(bin, tex.panel([5, 2], 0x9aa0a0, 0x646a6a, 5), { roughness: 0.93, metalness: 0.04, bump: 0.05 });
        const siding = surfaceMaterial(bin, tex.stripes([1, 14], 0xb9bfc4, 0x8d949a, 14, true), { roughness: 0.66, metalness: 0.24 });
        const roofSkin = surfaceMaterial(bin, tex.panel([6, 3], 0x7c8288, 0x4a5056, 6), { roughness: 0.72, metalness: 0.3, bump: 0.04 });
        const steel = bin.material(new THREE.MeshStandardMaterial({ color: 0x7a818b, roughness: 0.44, metalness: 0.78 }));
        const dark = bin.material(new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.86, metalness: 0.2 }));

        this.buildAssemblyBuilding(concrete, siding, steel, dark);
        for (const hangar of HANGARS) this.buildHangar(hangar, siding, roofSkin, steel, dark);
        for (const store of WAREHOUSES) this.buildWarehouse(store, siding, roofSkin, dark);
        this.buildOffice(concrete, dark);
        this.buildGatehouse(concrete, steel, dark);
        if (!this.deps.lean) {
            for (const mast of COMMS_MASTS) this.buildMast(mast, steel);
            this.buildLightPoles(steel);
        }
    }

    private buildAssemblyBuilding(concrete: THREE.Material, siding: THREE.Material, steel: THREE.Material, dark: THREE.Material) {
        const { scene, bin, tex, grid } = this.deps;

        const { x, z, width, depth, height, facing } = ASSEMBLY_BUILDING;
        const base = groundHeightAt(x, z);

        const group = new THREE.Group();
        group.position.set(x, base - 0.6, z);
        group.rotation.y = facing;
        scene.add(group);

        group.add(this.mesh(new THREE.BoxGeometry(width, height, depth), siding, [0, height / 2, 0]));
        group.add(this.mesh(new THREE.BoxGeometry(width + 2.4, 2.4, depth + 2.4), concrete, [0, 1.2, 0]));
        group.add(this.mesh(new THREE.BoxGeometry(width + 1.6, 1.6, depth + 1.6), dark, [0, height + 0.8, 0]));

        const door = this.mesh(new THREE.BoxGeometry(18, height * 0.72, 0.8), dark, [0, height * 0.36 + 1, -depth / 2 - 0.3]);
        door.castShadow = false;
        group.add(door);

        for (const side of [-1, 1]) {
            const rib = this.mesh(new THREE.BoxGeometry(1.6, height, 1.6), steel, [side * (width / 2 - 1), height / 2, -depth / 2]);
            rib.castShadow = false;
            group.add(rib);
        }

        const logo = surfaceMaterial(bin, tex.emblem("vab", "rocket", 0x1c2028, 0xffd166, "$MOON"), {
            roughness: 0.7,
            metalness: 0.18,
            emissive: 0xffd166,
            emissiveIntensity: 0.28,
        });
        logo.polygonOffset = true;
        logo.polygonOffsetFactor = -4;
        logo.polygonOffsetUnits = -8;

        const badge = this.mesh(new THREE.PlaneGeometry(22, 22), logo, [0, height * 0.66, -depth / 2 - 0.55]);
        badge.castShadow = false;
        group.add(badge);

        const sign = this.mesh(
            new THREE.PlaneGeometry(30, 6),
            surfaceMaterial(bin, tex.sign("vabsign", ["VERTICAL ASSEMBLY"], { background: 0x14181f, color: 0xbfe6ff, accent: 0x4fd1ff, width: 512, height: 128 }), {
                roughness: 0.6,
                metalness: 0.2,
                emissive: 0x4fd1ff,
                emissiveIntensity: 0.5,
            }),
            [0, height * 0.9, -depth / 2 - 0.55]
        );
        sign.castShadow = false;
        group.add(sign);

        for (const dx of [-14, 0, 14]) {
            const material = bin.material(new THREE.MeshBasicMaterial({ color: 0xff4a4a, transparent: true, opacity: 0.9, toneMapped: false }));
            this.beacons.push(material);

            const bulb = this.mesh(new THREE.SphereGeometry(0.5, 10, 8), material, [dx, height + 2.4, 0]);
            bulb.castShadow = false;
            group.add(bulb);
        }

        const glow = new THREE.PointLight(0x9fd8ff, 60, 90, 2);
        glow.position.set(0, height * 0.5, -depth / 2 - 6);
        group.add(glow);

        grid.insertOrientedBox(x, z, width, depth, facing, base, base + height);
    }

    private buildHangar(hangar: SiteBuilding, siding: THREE.Material, roofSkin: THREE.Material, steel: THREE.Material, dark: THREE.Material) {
        const { scene, bin, tex, grid } = this.deps;
        const base = groundHeightAt(hangar.x, hangar.z);

        const group = new THREE.Group();
        group.position.set(hangar.x, base - 0.4, hangar.z);
        group.rotation.y = hangar.facing;
        scene.add(group);

        group.add(this.mesh(new THREE.BoxGeometry(hangar.width, hangar.height, hangar.depth), siding, [0, hangar.height / 2, 0]));

        const roof = this.mesh(
            new THREE.CylinderGeometry(hangar.depth / 2, hangar.depth / 2, hangar.width, 22, 1, false, 0, Math.PI),
            roofSkin,
            [0, hangar.height, 0],
            [0, 0, Math.PI / 2]
        );
        (roof.material as THREE.Material).side = THREE.DoubleSide;
        group.add(roof);

        const doorPanel = this.mesh(new THREE.BoxGeometry(hangar.width * 0.56, hangar.height * 0.78, 0.6), dark, [0, hangar.height * 0.39, hangar.depth / 2 + 0.2]);
        doorPanel.castShadow = false;
        group.add(doorPanel);

        for (let i = 0; i < 5; i++) {
            const rail = this.mesh(new THREE.BoxGeometry(hangar.width * 0.56, 0.2, 0.12), steel, [0, 1.4 + i * (hangar.height * 0.14), hangar.depth / 2 + 0.55]);
            rail.castShadow = false;
            group.add(rail);
        }

        const plate = this.mesh(
            new THREE.PlaneGeometry(10, 3.4),
            surfaceMaterial(bin, tex.sign(`hangar${hangar.id}`, [hangar.ticker ?? ""], { background: 0x14181f, color: hangar.tint ?? 0xbfe6ff, accent: hangar.tint ?? 0xbfe6ff, width: 320, height: 128 }), {
                roughness: 0.6,
                metalness: 0.2,
                emissive: hangar.tint ?? 0xbfe6ff,
                emissiveIntensity: 0.45,
            }),
            [0, hangar.height * 0.9, hangar.depth / 2 + 0.6]
        );
        plate.castShadow = false;
        group.add(plate);

        const lamp = new THREE.PointLight(hangar.tint ?? 0xbfe6ff, 24, 40, 2);
        lamp.position.set(0, hangar.height * 0.8, hangar.depth / 2 + 4);
        group.add(lamp);

        grid.insertOrientedBox(hangar.x, hangar.z, hangar.width, hangar.depth, hangar.facing, base, base + hangar.height + hangar.depth / 2);
    }

    private buildWarehouse(store: SiteBuilding, siding: THREE.Material, roofSkin: THREE.Material, dark: THREE.Material) {
        const { scene, grid } = this.deps;
        const { x, z, facing } = store;
        const base = groundHeightAt(x, z);

        const group = new THREE.Group();
        group.position.set(x, base - 0.4, z);
        group.rotation.y = facing;
        scene.add(group);

        const { width, depth, height } = store;

        group.add(this.mesh(new THREE.BoxGeometry(width, height, depth), siding, [0, height / 2, 0]));
        group.add(this.mesh(new THREE.BoxGeometry(width + 1, 0.6, depth + 1), roofSkin, [0, height + 0.3, 0]));

        for (const dx of [-width * 0.28, 0, width * 0.28]) {
            const door = this.mesh(new THREE.BoxGeometry(width * 0.2, height * 0.56, 0.4), dark, [dx, height * 0.28, depth / 2 + 0.2]);
            door.castShadow = false;
            group.add(door);
        }

        for (let i = 0; i < 4; i++) {
            const crate = this.mesh(
                new THREE.BoxGeometry(2.4, 2, 2.4),
                dark,
                [-width * 0.36 + i * (width * 0.24), 1, depth / 2 + 3.4],
                [0, this.deps.random() * 0.6, 0]
            );
            group.add(crate);
        }

        grid.insertOrientedBox(x, z, width, depth, facing, base, base + height + 0.6);
    }

    private buildOffice(concrete: THREE.Material, dark: THREE.Material) {
        const { scene, bin, tex, grid } = this.deps;

        const { x, z, facing } = OFFICE;
        const base = groundHeightAt(x, z);

        const group = new THREE.Group();
        group.position.set(x, base - 0.4, z);
        group.rotation.y = facing;
        scene.add(group);

        group.add(this.mesh(new THREE.BoxGeometry(26, 15, 14), concrete, [0, 7.5, 0]));
        group.add(this.mesh(new THREE.BoxGeometry(27, 0.8, 15), dark, [0, 15.4, 0]));

        const glass = surfaceMaterial(bin, tex.grid([6, 3], 0x0d1620, 0xffd9a0, 8), {
            roughness: 0.22,
            metalness: 0.36,
            emissive: 0xffd9a0,
            emissiveIntensity: 0.8,
        });
        this.windows.push(glass);

        for (let floor = 0; floor < 3; floor++) {
            const band = this.mesh(new THREE.BoxGeometry(24, 2.4, 0.3), glass, [0, 3.2 + floor * 4.4, 7.1]);
            band.castShadow = false;
            group.add(band);

            const side = this.mesh(new THREE.BoxGeometry(0.3, 2.4, 12), glass, [13.1, 3.2 + floor * 4.4, 0]);
            side.castShadow = false;
            group.add(side);
        }

        const light = new THREE.PointLight(0xffd9a0, 30, 40, 2);
        light.position.set(0, 8, 10);
        group.add(light);

        for (let i = 0; i < 4; i++) {
            const bus = this.mesh(new THREE.BoxGeometry(9, 3, 2.8), concrete, [-14 + i * 6, 1.8, -12], [0, 0.1, 0]);
            group.add(bus);

            const strip = this.mesh(new THREE.BoxGeometry(8, 0.9, 0.2), dark, [-14 + i * 6, 2.5, -10.6]);
            strip.castShadow = false;
            group.add(strip);
        }

        grid.insertOrientedBox(x, z, OFFICE.width, OFFICE.depth, facing, base, base + 15.4);
    }

    private buildGatehouse(concrete: THREE.Material, steel: THREE.Material, dark: THREE.Material) {
        const { scene, bin, tex, grid } = this.deps;

        const { x, z, facing } = GATEHOUSE;
        const base = groundHeightAt(x, z);

        const group = new THREE.Group();
        group.position.set(x, base, z);
        group.rotation.y = facing;
        scene.add(group);

        group.add(this.mesh(new THREE.BoxGeometry(5.4, 3.6, 4.4), concrete, [0, 1.8, 0]));
        group.add(this.mesh(new THREE.BoxGeometry(6.4, 0.4, 5.4), dark, [0, 3.8, 0]));

        const glass = bin.material(new THREE.MeshStandardMaterial({
            color: 0x6fd6ff,
            emissive: 0x4fd1ff,
            emissiveIntensity: 0.7,
            roughness: 0.2,
            metalness: 0.3,
            transparent: true,
            opacity: 0.6,
        }));

        const pane = this.mesh(new THREE.BoxGeometry(4.4, 1.5, 0.2), glass, [0, 2.5, 2.3]);
        pane.castShadow = false;
        group.add(pane);

        const boom = this.mesh(new THREE.BoxGeometry(11, 0.3, 0.3), steel, [-7.5, 1.5, 2.6]);
        boom.castShadow = false;
        group.add(boom);

        for (let i = 0; i < 5; i++) {
            const stripe = this.mesh(new THREE.BoxGeometry(1.1, 0.34, 0.34), i % 2 === 0 ? dark : steel, [-12 + i * 2.2, 1.5, 2.6]);
            stripe.castShadow = false;
            group.add(stripe);
        }

        const sign = this.mesh(
            new THREE.PlaneGeometry(6, 3),
            surfaceMaterial(bin, tex.sign("gate", ["CLOSED", "LAUNCH IN PROGRESS"], { background: 0x14181f, color: 0xff5a4a, accent: 0xffd166, width: 320, height: 180 }), {
                roughness: 0.6,
                metalness: 0.2,
                emissive: 0xff5a4a,
                emissiveIntensity: 0.5,
            }),
            [-7.5, 3.4, 2.6]
        );
        sign.castShadow = false;
        group.add(sign);

        const lamp = new THREE.PointLight(0xffd166, 18, 24, 2);
        lamp.position.set(-6, 4.4, 2.6);
        group.add(lamp);

        grid.insertOrientedBox(x, z, GATEHOUSE.width, GATEHOUSE.depth, facing, base, base + GATEHOUSE.height);
    }

    private buildMast(spot: [number, number], steel: THREE.Material) {
        const { scene, bin } = this.deps;
        const [x, z] = spot;
        const base = groundHeightAt(x, z);
        const height = 32;

        const group = new THREE.Group();
        group.position.set(x, base, z);
        scene.add(group);

        for (const dx of [-1.1, 1.1]) {
            for (const dz of [-1.1, 1.1]) {
                const leg = this.mesh(new THREE.BoxGeometry(0.22, height, 0.22), steel, [dx, height / 2, dz]);
                leg.castShadow = false;
                group.add(leg);
            }
        }

        for (let i = 1; i < 9; i++) {
            const y = (height / 9) * i;
            const brace = this.mesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), steel, [0, y, -1.1]);
            brace.castShadow = false;
            group.add(brace);

            const cross = this.mesh(new THREE.BoxGeometry(0.14, 0.14, 2.4), steel, [1.1, y, 0]);
            cross.castShadow = false;
            group.add(cross);
        }

        const dish = this.mesh(new THREE.SphereGeometry(1.8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), steel, [0, height * 0.72, 1.8], [1.1, 0, 0]);
        (dish.material as THREE.Material).side = THREE.DoubleSide;
        dish.castShadow = false;
        group.add(dish);

        const material = bin.material(new THREE.MeshBasicMaterial({ color: 0xff4a4a, transparent: true, opacity: 0.9, toneMapped: false }));
        this.beacons.push(material);

        const bulb = this.mesh(new THREE.SphereGeometry(0.34, 10, 8), material, [0, height + 0.8, 0]);
        bulb.castShadow = false;
        group.add(bulb);
    }

    private buildLightPoles(steel: THREE.Material) {
        const { scene } = this.deps;

        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + 0.26;
            const x = Math.cos(angle) * 92;
            const z = Math.sin(angle) * 92;
            const base = groundHeightAt(x, z);

            const pole = this.mesh(new THREE.CylinderGeometry(0.16, 0.22, 9, 6), steel, [x, base + 4.5, z]);
            pole.castShadow = false;
            scene.add(pole);

            const head = this.mesh(new THREE.BoxGeometry(1.4, 0.4, 0.7), steel, [x - Math.cos(angle) * 0.7, base + 9, z - Math.sin(angle) * 0.7], [0, -angle, 0]);
            head.castShadow = false;
            scene.add(head);

            const lamp = new THREE.PointLight(0xffe0b0, 9, 26, 2);
            lamp.position.set(x - Math.cos(angle) * 0.7, base + 8.8, z - Math.sin(angle) * 0.7);
            scene.add(lamp);
        }
    }

    public update(elapsed: number) {
        const pulse = Math.abs(Math.sin(elapsed * 1.3));
        for (let i = 0; i < this.beacons.length; i++) {
            this.beacons[i].opacity = 0.2 + (i % 2 === 0 ? pulse : 1 - pulse) * 0.7;
        }

        for (const window of this.windows) {
            window.emissiveIntensity = 0.7 + Math.sin(elapsed * 0.7) * 0.12;
        }
    }

    public dispose() {
        this.beacons.length = 0;
        this.windows.length = 0;
    }
}
