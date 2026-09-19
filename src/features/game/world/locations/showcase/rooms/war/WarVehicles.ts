// src/features/game/world/locations/showcase/rooms/war/WarVehicles.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import { CollisionGrid } from "../../../../CollisionGrid";
import { WarEffects } from "./WarEffects";

interface Tank {
    group: THREE.Group;
    turret: THREE.Group;
    barrel: THREE.Object3D;
    muzzle: THREE.Object3D;
    team: number;
    cooldown: number;
    recoil: number;
    aim: number;
    aimTarget: number;
}

interface Launcher {
    group: THREE.Group;
    rack: THREE.Group;
    tubes: THREE.Object3D[];
    team: number;
    cooldown: number;
    salvo: number;
    salvoTimer: number;
    target: THREE.Vector3;
}

interface Helicopter {
    group: THREE.Group;
    body: THREE.Group;
    mainRotor: THREE.Object3D;
    tailRotor: THREE.Object3D;
    guns: THREE.Object3D[];
    team: number;
    center: THREE.Vector3;
    radiusX: number;
    radiusZ: number;
    height: number;
    speed: number;
    phase: number;
    fireTimer: number;
    burst: number;
    burstTimer: number;
    rocketTimer: number;
}

const TEAM_COLORS = [0x5c3226, 0x2b3950];
const TEAM_TRIM = [0xa8392c, 0x4f7fd8];
const TRACER_COLORS = [0xffb060, 0x8fd0ff];

export class WarVehicles {
    private tanks: Tank[] = [];
    private launchers: Launcher[] = [];
    private helicopters: Helicopter[] = [];

    private readonly muzzlePoint = new THREE.Vector3();
    private readonly targetPoint = new THREE.Vector3();
    private readonly scratch = new THREE.Vector3();

    private hull!: THREE.MeshStandardMaterial;
    private hullBlue!: THREE.MeshStandardMaterial;
    private track!: THREE.MeshStandardMaterial;
    private metal!: THREE.MeshStandardMaterial;
    private glass!: THREE.MeshStandardMaterial;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly bin: AssetBin,
        private readonly effects: WarEffects,
        private readonly random: () => number,
        private readonly frontHalfWidth: number
    ) { }

    public prepare(metalMap: THREE.Texture | null) {
        this.hull = this.bin.material(new THREE.MeshStandardMaterial({ color: TEAM_COLORS[0], roughness: 0.72, metalness: 0.38, map: metalMap }));
        this.hullBlue = this.bin.material(new THREE.MeshStandardMaterial({ color: TEAM_COLORS[1], roughness: 0.72, metalness: 0.38, map: metalMap }));
        this.track = this.bin.material(new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.88, metalness: 0.22 }));
        this.metal = this.bin.material(new THREE.MeshStandardMaterial({ color: 0x4a4d53, roughness: 0.5, metalness: 0.72, map: metalMap }));
        this.glass = this.bin.material(new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.12, metalness: 0.5, emissive: 0x0c1620, emissiveIntensity: 0.8 }));
    }

    private hullFor(team: number): THREE.Material {
        return team === 0 ? this.hull : this.hullBlue;
    }

    private box(width: number, height: number, depth: number, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
        const mesh = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(width, height, depth)), material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    public addTank(position: THREE.Vector3, facing: number, team: number, grid?: CollisionGrid) {
        const group = new THREE.Group();
        group.position.copy(position);
        group.rotation.y = facing;

        const body = this.hullFor(team);

        const lowerHull = this.box(7.6, 1.1, 3.9, body, 0, 1.15, 0);
        group.add(lowerHull);

        const upperHull = this.box(6.4, 0.85, 3.5, body, -0.2, 2.05, 0);
        group.add(upperHull);

        const glacis = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(2.6, 1.15, 3.6)), body);
        glacis.position.set(3.3, 1.55, 0);
        glacis.rotation.z = -0.62;
        glacis.castShadow = true;
        group.add(glacis);

        // Rear plate and engine deck louvres.
        const rearPlate = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(1.1, 1.3, 3.5)), body);
        rearPlate.position.set(-3.7, 1.5, 0);
        rearPlate.rotation.z = 0.24;
        rearPlate.castShadow = true;
        group.add(rearPlate);

        for (let i = 0; i < 5; i++) {
            const louvre = this.box(0.18, 0.1, 2.4, this.track, -2.1 - i * 0.34, 2.5, 0);
            louvre.castShadow = false;
            group.add(louvre);
        }

        const exhaust = new THREE.Mesh(this.bin.geometry(new THREE.CylinderGeometry(0.2, 0.22, 1.1, 10)), this.metal);
        exhaust.rotation.z = Math.PI / 2;
        exhaust.position.set(-3.2, 2.3, 1.35);
        exhaust.castShadow = true;
        group.add(exhaust);

        // Fenders with stowage boxes and spare track links on the hull side.
        for (const side of [-1, 1]) {
            const fender = this.box(7.6, 0.14, 0.7, this.metal, 0, 2.02, side * 2.2);
            group.add(fender);

            for (let b = 0; b < 2; b++) {
                const stow = this.box(1.3, 0.5, 0.6, this.metal, -2.4 + b * 1.6, 2.33, side * 2.2);
                group.add(stow);
            }

            for (let l = 0; l < 6; l++) {
                const link = this.box(0.34, 0.26, 0.1, this.track, 1.1 + l * 0.38, 2.34, side * 1.82);
                link.castShadow = false;
                group.add(link);
            }

            const skirt = this.box(7.2, 0.62, 0.22, this.metal, 0, 1.55, side * 2.05);
            group.add(skirt);
        }

        for (const side of [-1, 1]) {
            const belt = this.box(8, 1.25, 1.05, this.track, 0, 0.65, side * 1.75);
            group.add(belt);

            // Track links around the belt, so the running gear is not one smooth slab.
            for (let l = 0; l < 14; l++) {
                const top = this.box(0.46, 0.16, 1.12, this.track, -3.6 + l * 0.56, 1.2, side * 1.75);
                top.castShadow = false;
                group.add(top);

                const bottom = this.box(0.46, 0.16, 1.12, this.track, -3.6 + l * 0.56, 0.1, side * 1.75);
                bottom.castShadow = false;
                group.add(bottom);
            }

            for (let w = 0; w < 6; w++) {
                const wheel = new THREE.Mesh(
                    this.bin.geometry(new THREE.CylinderGeometry(0.62, 0.62, 0.55, 16)),
                    this.metal
                );
                wheel.position.set(-3 + w * 1.2, 0.65, side * 1.75);
                wheel.rotation.x = Math.PI / 2;
                wheel.castShadow = true;
                group.add(wheel);

                const hub = new THREE.Mesh(
                    this.bin.geometry(new THREE.CylinderGeometry(0.24, 0.24, 0.62, 10)),
                    this.track
                );
                hub.position.set(-3 + w * 1.2, 0.65, side * 1.75);
                hub.rotation.x = Math.PI / 2;
                hub.castShadow = false;
                group.add(hub);
            }

            for (let r = 0; r < 3; r++) {
                const roller = new THREE.Mesh(
                    this.bin.geometry(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 10)),
                    this.metal
                );
                roller.position.set(-2.2 + r * 2.1, 1.32, side * 1.75);
                roller.rotation.x = Math.PI / 2;
                roller.castShadow = false;
                group.add(roller);
            }

            const drive = new THREE.Mesh(
                this.bin.geometry(new THREE.CylinderGeometry(0.82, 0.82, 0.62, 14)),
                this.metal
            );
            drive.position.set(3.7, 0.95, side * 1.75);
            drive.rotation.x = Math.PI / 2;
            group.add(drive);

            const idler = new THREE.Mesh(
                this.bin.geometry(new THREE.CylinderGeometry(0.66, 0.66, 0.6, 12)),
                this.metal
            );
            idler.position.set(-3.8, 0.78, side * 1.75);
            idler.rotation.x = Math.PI / 2;
            group.add(idler);
        }

        const turret = new THREE.Group();
        turret.position.set(-0.4, 2.65, 0);

        const turretBody = new THREE.Mesh(
            this.bin.geometry(new THREE.CylinderGeometry(1.55, 1.95, 1.15, 8)),
            body
        );
        turretBody.castShadow = true;
        turret.add(turretBody);

        const turretRoof = new THREE.Mesh(
            this.bin.geometry(new THREE.CylinderGeometry(1.25, 1.55, 0.3, 8)),
            body
        );
        turretRoof.position.y = 0.7;
        turret.add(turretRoof);

        const mantlet = this.box(1.1, 0.9, 1.5, this.metal, 1.5, 0.05, 0);
        turret.add(mantlet);

        const barrel = new THREE.Group();
        barrel.position.set(1.9, 0.05, 0);
        turret.add(barrel);

        const tube = new THREE.Mesh(
            this.bin.geometry(new THREE.CylinderGeometry(0.22, 0.26, 5.2, 12)),
            this.metal
        );
        tube.rotation.z = Math.PI / 2;
        tube.position.x = 2.6;
        tube.castShadow = true;
        barrel.add(tube);

        const brake = new THREE.Mesh(
            this.bin.geometry(new THREE.CylinderGeometry(0.34, 0.34, 0.72, 12)),
            this.metal
        );
        brake.rotation.z = Math.PI / 2;
        brake.position.x = 5.3;
        barrel.add(brake);

        const muzzle = new THREE.Object3D();
        muzzle.position.set(5.75, 0, 0);
        barrel.add(muzzle);

        const hatch = new THREE.Mesh(
            this.bin.geometry(new THREE.CylinderGeometry(0.52, 0.52, 0.2, 12)),
            this.metal
        );
        hatch.position.set(-0.7, 0.82, 0.35);
        turret.add(hatch);

        const hatchRim = new THREE.Mesh(
            this.bin.geometry(new THREE.TorusGeometry(0.54, 0.06, 6, 14)),
            this.metal
        );
        hatchRim.rotation.x = -Math.PI / 2;
        hatchRim.position.set(-0.7, 0.74, 0.35);
        turret.add(hatchRim);

        // Bustle rack at the back of the turret with a tarp roll on it.
        const bustle = this.box(1.3, 0.7, 2.2, body, -1.85, 0.1, 0);
        turret.add(bustle);

        const tarp = new THREE.Mesh(
            this.bin.geometry(new THREE.CylinderGeometry(0.28, 0.28, 1.8, 10)),
            this.track
        );
        tarp.rotation.x = Math.PI / 2;
        tarp.position.set(-1.9, 0.6, 0);
        turret.add(tarp);

        const mg = this.box(0.9, 0.16, 0.16, this.metal, -0.2, 1.0, 0.35);
        turret.add(mg);

        const mgMount = new THREE.Mesh(
            this.bin.geometry(new THREE.CylinderGeometry(0.1, 0.13, 0.3, 8)),
            this.metal
        );
        mgMount.position.set(-0.2, 0.85, 0.35);
        turret.add(mgMount);

        for (let i = 0; i < 4; i++) {
            const launcher = new THREE.Mesh(
                this.bin.geometry(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 8)),
                this.track
            );
            launcher.rotation.z = Math.PI / 2;
            launcher.rotation.y = 0.3;
            launcher.position.set(0.5, 0.3, (i < 2 ? 1 : -1) * 1.25 + (i % 2) * 0.05);
            launcher.position.z += (i % 2) * 0.26 * (i < 2 ? 1 : -1);
            turret.add(launcher);
        }

        const antenna = new THREE.Mesh(
            this.bin.geometry(new THREE.CylinderGeometry(0.03, 0.04, 2.6, 5)),
            this.metal
        );
        antenna.position.set(-1.2, 1.9, -0.6);
        antenna.rotation.z = 0.12;
        turret.add(antenna);

        group.add(turret);
        this.scene.add(group);

        grid?.insertOrientedBox(position.x, position.z, 8.2, 4.4, facing, 0, 3.4);

        this.tanks.push({
            group,
            turret,
            barrel,
            muzzle,
            team,
            cooldown: 3 + this.random() * 7,
            recoil: 0,
            aim: 0,
            aimTarget: 0,
        });
    }

    public addLauncher(position: THREE.Vector3, facing: number, team: number, grid?: CollisionGrid) {
        const group = new THREE.Group();
        group.position.copy(position);
        group.rotation.y = facing;

        const body = this.hullFor(team);

        const chassis = this.box(7.4, 0.8, 2.9, body, 0, 1.05, 0);
        group.add(chassis);

        const cab = this.box(2.3, 1.6, 2.7, body, 2.4, 2.2, 0);
        group.add(cab);

        const windshield = this.box(0.14, 0.9, 2.3, this.glass, 3.55, 2.45, 0);
        group.add(windshield);

        for (const side of [-1, 1]) {
            for (let w = 0; w < 3; w++) {
                const wheel = new THREE.Mesh(
                    this.bin.geometry(new THREE.CylinderGeometry(0.78, 0.78, 0.6, 14)),
                    this.track
                );
                wheel.position.set(-2.6 + w * 2.4, 0.78, side * 1.6);
                wheel.rotation.x = Math.PI / 2;
                wheel.castShadow = true;
                group.add(wheel);
            }
        }

        const rack = new THREE.Group();
        rack.position.set(-1.4, 2.1, 0);
        rack.rotation.z = 0.34;

        const frame = this.box(2.4, 1.5, 2.4, this.metal, 0, 0, 0);
        rack.add(frame);

        const tubes: THREE.Object3D[] = [];
        const tubeGeometry = this.bin.geometry(new THREE.CylinderGeometry(0.22, 0.22, 2.6, 10, 1, true));

        for (let row = 0; row < 2; row++) {
            for (let column = 0; column < 4; column++) {
                const tube = new THREE.Mesh(tubeGeometry, this.metal);
                tube.rotation.z = Math.PI / 2;
                tube.position.set(0, -0.45 + row * 0.9, -0.9 + column * 0.6);
                rack.add(tube);

                const tip = new THREE.Object3D();
                tip.position.set(1.4, -0.45 + row * 0.9, -0.9 + column * 0.6);
                rack.add(tip);
                tubes.push(tip);
            }
        }

        group.add(rack);
        this.scene.add(group);

        grid?.insertOrientedBox(position.x, position.z, 7.6, 3.4, facing, 0, 3.2);

        this.launchers.push({
            group,
            rack,
            tubes,
            team,
            cooldown: 6 + this.random() * 12,
            salvo: 0,
            salvoTimer: 0,
            target: new THREE.Vector3(),
        });
    }

    public addHelicopter(center: THREE.Vector3, radiusX: number, radiusZ: number, height: number, team: number) {
        const group = new THREE.Group();
        const body = new THREE.Group();
        group.add(body);

        const shell = this.hullFor(team);

        const fuselage = new THREE.Mesh(
            this.bin.geometry(new THREE.CapsuleGeometry(1.15, 3.4, 6, 12)),
            shell
        );
        fuselage.rotation.z = Math.PI / 2;
        fuselage.castShadow = true;
        body.add(fuselage);

        const nose = new THREE.Mesh(this.bin.geometry(new THREE.SphereGeometry(1.05, 14, 10)), this.glass);
        nose.position.x = 2.5;
        nose.scale.set(1.3, 0.85, 0.9);
        body.add(nose);

        const boom = new THREE.Mesh(
            this.bin.geometry(new THREE.CylinderGeometry(0.32, 0.5, 4.6, 10)),
            shell
        );
        boom.rotation.z = Math.PI / 2;
        boom.position.x = -3.7;
        boom.castShadow = true;
        body.add(boom);

        const tailFin = this.box(1.1, 1.5, 0.16, shell, -5.6, 0.75, 0);
        body.add(tailFin);

        const stabilizer = this.box(0.9, 0.12, 2.2, shell, -5, 0.2, 0);
        body.add(stabilizer);

        const mast = new THREE.Mesh(
            this.bin.geometry(new THREE.CylinderGeometry(0.18, 0.24, 0.7, 8)),
            this.metal
        );
        mast.position.y = 1.3;
        body.add(mast);

        const mainRotor = new THREE.Group();
        mainRotor.position.y = 1.65;

        const hub = new THREE.Mesh(this.bin.geometry(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8)), this.metal);
        mainRotor.add(hub);

        for (let i = 0; i < 4; i++) {
            const blade = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(8.2, 0.07, 0.46)), this.track);
            blade.rotation.y = (i / 4) * Math.PI * 2;
            blade.position.set(Math.cos((i / 4) * Math.PI * 2) * 4.1, 0, Math.sin((i / 4) * Math.PI * 2) * 4.1);
            mainRotor.add(blade);
        }

        body.add(mainRotor);

        const tailRotor = new THREE.Group();
        tailRotor.position.set(-5.9, 0.75, 0.22);

        for (let i = 0; i < 3; i++) {
            const blade = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(0.06, 1.7, 0.22)), this.track);
            blade.rotation.x = (i / 3) * Math.PI * 2;
            tailRotor.add(blade);
        }

        body.add(tailRotor);

        const guns: THREE.Object3D[] = [];
        for (const side of [-1, 1]) {
            const wing = this.box(0.9, 0.2, 1.5, shell, 0.2, -0.55, side * 1.3);
            body.add(wing);

            const pod = new THREE.Mesh(
                this.bin.geometry(new THREE.CylinderGeometry(0.32, 0.32, 1.5, 10)),
                this.metal
            );
            pod.rotation.z = Math.PI / 2;
            pod.position.set(0.4, -0.75, side * 1.9);
            body.add(pod);

            const tip = new THREE.Object3D();
            tip.position.set(1.3, -0.75, side * 1.9);
            body.add(tip);
            guns.push(tip);
        }

        for (const side of [-1, 1]) {
            const skid = this.box(3.6, 0.12, 0.12, this.metal, 0, -1.5, side * 1.1);
            body.add(skid);

            for (const dx of [-1, 1]) {
                const strut = this.box(0.12, 0.8, 0.12, this.metal, dx * 1.2, -1.1, side * 1.1);
                body.add(strut);
            }
        }

        const beacon = new THREE.Mesh(
            this.bin.geometry(new THREE.SphereGeometry(0.16, 8, 6)),
            this.bin.material(new THREE.MeshBasicMaterial({ color: TEAM_TRIM[team], toneMapped: false }))
        );
        beacon.position.set(-5.6, 1.6, 0);
        body.add(beacon);

        this.scene.add(group);

        this.helicopters.push({
            group,
            body,
            mainRotor,
            tailRotor,
            guns,
            team,
            center: center.clone(),
            radiusX,
            radiusZ,
            height,
            speed: 0.09 + this.random() * 0.05,
            phase: this.random() * Math.PI * 2,
            fireTimer: 2 + this.random() * 4,
            burst: 0,
            burstTimer: 0,
            rocketTimer: 8 + this.random() * 10,
        });
    }

    public helicopterTarget(out: THREE.Vector3, team?: number): THREE.Vector3 | null {
        if (this.helicopters.length === 0) return null;

        const heli = team === undefined
            ? this.helicopters[0]
            : this.helicopters.find((entry) => entry.team !== team) ?? this.helicopters[0];

        return out.copy(heli.group.position);
    }

    private frontTarget(team: number, out: THREE.Vector3): THREE.Vector3 {
        const enemyZ = team === 0 ? 1 : -1;
        return out.set(
            (this.random() - 0.5) * this.frontHalfWidth * 2,
            0.4,
            enemyZ * (16 + this.random() * 30)
        );
    }

    private updateTanks(delta: number) {
        for (const tank of this.tanks) {
            if (tank.recoil > 0) {
                tank.recoil = Math.max(0, tank.recoil - delta * 3.4);
                tank.barrel.position.x = 1.9 - tank.recoil * 1.1;
            }

            tank.cooldown -= delta;

            const sweep = Math.sin(tank.aim) * 0.0;
            tank.aim += (tank.aimTarget - tank.aim) * Math.min(1, delta * 0.9) + sweep;
            tank.turret.rotation.y = tank.aim;

            if (tank.cooldown > 0) continue;

            tank.cooldown = 7 + this.random() * 9;
            this.frontTarget(tank.team, this.targetPoint);

            const local = this.scratch.copy(this.targetPoint).sub(tank.group.position);
            tank.aimTarget = Math.atan2(local.x, local.z) - tank.group.rotation.y - Math.PI / 2;

            tank.muzzle.updateWorldMatrix(true, false);
            tank.muzzle.getWorldPosition(this.muzzlePoint);

            this.effects.spawnShell(this.muzzlePoint, this.targetPoint, 6.5);
            this.effects.spawnDebris(this.muzzlePoint, 6, 6);
            tank.recoil = 1;
        }
    }

    private updateLaunchers(delta: number) {
        for (const launcher of this.launchers) {
            if (launcher.salvo > 0) {
                launcher.salvoTimer -= delta;
                if (launcher.salvoTimer <= 0) {
                    launcher.salvoTimer = 0.28;
                    launcher.salvo--;

                    const tube = launcher.tubes[launcher.salvo % launcher.tubes.length];
                    tube.updateWorldMatrix(true, false);
                    tube.getWorldPosition(this.muzzlePoint);

                    this.targetPoint.copy(launcher.target);
                    this.targetPoint.x += (this.random() - 0.5) * 26;
                    this.targetPoint.z += (this.random() - 0.5) * 18;

                    this.effects.spawnRocket(this.muzzlePoint, this.targetPoint, 22 + this.random() * 10, 7);
                }
                continue;
            }

            launcher.cooldown -= delta;
            if (launcher.cooldown > 0) continue;

            launcher.cooldown = 22 + this.random() * 16;
            launcher.salvo = 4 + Math.floor(this.random() * 3);
            launcher.salvoTimer = 0;
            this.frontTarget(launcher.team, launcher.target);
            launcher.rack.rotation.y = (this.random() - 0.5) * 0.3;
        }
    }

    private updateHelicopters(delta: number, elapsed: number) {
        for (const heli of this.helicopters) {
            const t = elapsed * heli.speed + heli.phase;

            const x = heli.center.x + Math.cos(t) * heli.radiusX;
            const z = heli.center.z + Math.sin(t) * heli.radiusZ;
            const y = heli.center.y + heli.height + Math.sin(t * 2.3) * 1.8;

            const nextX = heli.center.x + Math.cos(t + 0.05) * heli.radiusX;
            const nextZ = heli.center.z + Math.sin(t + 0.05) * heli.radiusZ;

            heli.group.position.set(x, y, z);
            heli.group.rotation.y = Math.atan2(nextX - x, nextZ - z) - Math.PI / 2;

            const turn = Math.atan2(nextZ - z, nextX - x);
            heli.body.rotation.x = Math.sin(turn) * 0.12;
            heli.body.rotation.z = -0.22 + Math.sin(t * 1.7) * 0.05;

            heli.mainRotor.rotation.y += delta * 34;
            heli.tailRotor.rotation.x += delta * 42;

            if (heli.burst > 0) {
                heli.burstTimer -= delta;
                if (heli.burstTimer <= 0) {
                    heli.burstTimer = 0.07;
                    heli.burst--;

                    const gun = heli.guns[heli.burst % heli.guns.length];
                    gun.updateWorldMatrix(true, false);
                    gun.getWorldPosition(this.muzzlePoint);

                    this.frontTarget(heli.team, this.targetPoint);
                    this.targetPoint.x += (this.random() - 0.5) * 6;
                    this.targetPoint.z += (this.random() - 0.5) * 6;

                    this.effects.spawnTracer(this.muzzlePoint, this.targetPoint, TRACER_COLORS[heli.team]);
                    this.effects.spawnFlash(this.muzzlePoint, 0.9, 0xffd9a0);
                }
                continue;
            }

            heli.fireTimer -= delta;
            if (heli.fireTimer <= 0) {
                heli.fireTimer = 3.5 + this.random() * 5;
                heli.burst = 8 + Math.floor(this.random() * 8);
                heli.burstTimer = 0;
            }

            heli.rocketTimer -= delta;
            if (heli.rocketTimer <= 0) {
                heli.rocketTimer = 12 + this.random() * 14;

                const gun = heli.guns[Math.floor(this.random() * heli.guns.length)];
                gun.updateWorldMatrix(true, false);
                gun.getWorldPosition(this.muzzlePoint);

                this.frontTarget(heli.team, this.targetPoint);
                this.effects.spawnRocket(this.muzzlePoint, this.targetPoint, 6, 7);
            }
        }
    }

    public update(delta: number, elapsed: number) {
        this.updateTanks(delta);
        this.updateLaunchers(delta);
        this.updateHelicopters(delta, elapsed);
    }
}
