// src/features/game/world/locations/showcase/rooms/WarRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import type { ShowcaseActor } from "../actors/ShowcaseActor";
import { GROUND_SEAT_Y } from "../actors/poses";
import { WarEffects } from "./war/WarEffects";
import { WarProps, TRENCH_GAPS } from "./war/WarProps";
import { WarBattle, TEAM_BLUE, JOHNNY_TEAM, JOHNNY_VARIANT } from "./war/WarBattle";
import { WarVehicles } from "./war/WarVehicles";

const HALF_WIDTH = 95;
const FIELD_DEPTH = 130;
const RED_LINE = -24;
const BLUE_LINE = 24;
const ROOM_RADIUS = 118;
const RAMBO_SPOT = new THREE.Vector3(-12, 0, -22);
const MEDIC_SPOT = new THREE.Vector3(-48, 0, -36);
const MEDIC_FACING = -0.9;
const MATTRESS_SPOT = new THREE.Vector3(-48.6, 0, -35.2);
const MATTRESS_FACING = -0.9;
const EMBER_COUNT = 340;
const STAR_COUNT = 900;
const FIGHTERS_PER_SIDE = 13;
const RAMBO_SHOT_INTERVAL = 0.14;
// How long Johnny stays on his feet under fire before he goes down.
const JOHNNY_LIFETIME = 10;
const JOHNNY_SCREAM_DURATION = 2.4;
// Straight down Rambo's line of fire, on the blue side of the wire.
const JOHNNY_ANCHOR = new THREE.Vector3(RAMBO_SPOT.x + 1, 0, BLUE_LINE);

export class WarRoom extends ShowcaseRoom {
    private effects!: WarEffects;
    private props!: WarProps;
    private battle!: WarBattle;
    private vehicles!: WarVehicles;

    private embers: THREE.Points | null = null;
    private emberVelocity: Float32Array = new Float32Array(0);
    private skyFlash: THREE.PointLight | null = null;
    private flashTimer = 0;
    private searchlights: THREE.Mesh[] = [];
    private artilleryTimer = 6;
    private readonly airProbe = new THREE.Vector3();
    private rambo: ShowcaseActor | null = null;
    private ramboTimer = 0;
    private johnnyTimer = JOHNNY_LIFETIME;
    private medicBubbleA: THREE.Sprite | null = null;
    private medicBubbleB: THREE.Sprite | null = null;
    private readonly ramboMuzzle = new THREE.Vector3();
    private readonly ramboTarget = new THREE.Vector3();

    private johnnyScreamBubble: THREE.Sprite | null = null;
    private johnnyScreamWitness: ShowcaseActor | null = null;
    private johnnyScreamTimer = 0;

    constructor(info: ShowcaseInfo = SHOWCASE_INFO_BY_ID.get("show-war") as ShowcaseInfo) {
        super(info, 0x9d34f1, ROOM_RADIUS);
        this.exitPosition.set(0, 0, -76);
        this.exitFacing = 0;
        this.spawnPosition.set(0, 0, -68);
    }

    protected buildAtmosphere(): void {
        this.scene.background = new THREE.Color(0x07090f);
        this.scene.fog = new THREE.FogExp2(0x241a15, 0.0086);

        // Night reads as night only if the fill light stays out of the way: almost all
        // of the modelling comes from the moon and from the fires, and the flat ambient
        // that used to sit at 0.62 was washing both of them out.
        this.scene.add(new THREE.AmbientLight(0x2a2740, 0.16));
        this.scene.add(new THREE.HemisphereLight(0x3c4670, 0x2a1408, 0.34));

        this.buildSkyDome();

        const moon = new THREE.DirectionalLight(0x9fb0e8, 1.15);
        moon.position.set(-90, 90, -60);
        moon.target.position.set(0, 0, 0);
        moon.castShadow = true;
        moon.shadow.mapSize.set(2048, 2048);
        moon.shadow.camera.left = -110;
        moon.shadow.camera.right = 110;
        moon.shadow.camera.top = 110;
        moon.shadow.camera.bottom = -110;
        moon.shadow.camera.near = 5;
        moon.shadow.camera.far = 320;
        moon.shadow.bias = -0.0005;
        moon.shadow.normalBias = 0.07;
        moon.shadow.camera.updateProjectionMatrix();
        this.scene.add(moon);
        this.scene.add(moon.target);

        // The city burning past the ruins rims everything from one side; the second,
        // dimmer one keeps the opposite flank from going to pure black.
        const horizon = new THREE.DirectionalLight(0xff6a33, 0.8);
        horizon.position.set(60, 12, 80);
        this.scene.add(horizon);

        const backGlow = new THREE.DirectionalLight(0xff4a1e, 0.3);
        backGlow.position.set(-70, 10, -60);
        this.scene.add(backGlow);

        this.skyFlash = new THREE.PointLight(0xffb066, 0, 420, 2);
        this.skyFlash.position.set(0, 110, 60);
        this.scene.add(this.skyFlash);

        this.buildStars();

        const glow = this.mesh(
            new THREE.SphereGeometry(300, 30, 18, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.16),
            this.glow(0xff5a2a, 0.13, false),
            [0, 0, 0]
        );
        glow.castShadow = false;
        glow.receiveShadow = false;
        (glow.material as THREE.Material).side = THREE.BackSide;
        this.scene.add(glow);
    }

    private buildSkyDome() {
        const sky = this.mesh(
            new THREE.SphereGeometry(340, 32, 24),
            this.bin.material(new THREE.MeshBasicMaterial({
                map: this.tex.nightSky("war", 0x090d1a, 0x5a1c0c, 0x3a2418),
                side: THREE.BackSide,
                depthWrite: false,
                toneMapped: false,
                fog: false,
            })),
            [0, 0, 0]
        );
        sky.castShadow = false;
        sky.receiveShadow = false;
        sky.renderOrder = -1;
        this.scene.add(sky);
    }

    private buildStars() {
        const positions = new Float32Array(STAR_COUNT * 3);

        for (let i = 0; i < STAR_COUNT; i++) {
            const theta = this.random() * Math.PI * 2;
            const phi = Math.acos(this.random() * 0.85);
            positions[i * 3] = Math.sin(phi) * Math.cos(theta) * 280;
            positions[i * 3 + 1] = Math.cos(phi) * 280;
            positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * 280;
        }

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = this.bin.material(new THREE.PointsMaterial({
            color: 0xbfc8e0,
            size: 1.3,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
            toneMapped: false,
            fog: false,
        }));

        const stars = new THREE.Points(geometry, material);
        stars.frustumCulled = false;
        this.scene.add(stars);
    }

    protected decorate(rm: ResourceManager): void {
        this.effects = new WarEffects(this.scene, this.bin, this.random);
        this.effects.create();

        this.props = new WarProps(this.scene, this.bin, this.random, {
            halfWidth: HALF_WIDTH,
            redLine: RED_LINE,
            blueLine: BLUE_LINE,
            fieldDepth: FIELD_DEPTH,
        });
        this.props.prepare();
        this.props.buildGround(this.collisionGrid);
        this.props.buildRuins(this.collisionGrid);
        this.props.buildPerimeterRing(this.collisionGrid);
        this.props.buildTrench(RED_LINE, -1, 0, this.collisionGrid);
        this.props.buildTrench(BLUE_LINE, 1, 1, this.collisionGrid);
        this.props.buildBanners(RED_LINE, -1, 5);
        this.props.buildBanners(BLUE_LINE, 1, 5);
        this.props.buildBarriers(this.collisionGrid);
        this.props.buildWrecks(this.collisionGrid);

        this.buildVehicles();
        this.buildFires();
        this.buildSearchlights();
        this.buildEmbers();
        this.buildBattle(rm);
        this.buildCrew();
        this.buildHeroes(rm);
    }

    private buildVehicles() {
        this.vehicles = new WarVehicles(this.scene, this.bin, this.effects, this.random, HALF_WIDTH);
        this.vehicles.prepare(this.props.rustMap);

        this.vehicles.addTank(new THREE.Vector3(-38, 0, RED_LINE - 14), 0.24, 0, this.collisionGrid);
        this.vehicles.addTank(new THREE.Vector3(26, 0, RED_LINE - 18), -0.12, 0, this.collisionGrid);
        this.vehicles.addTank(new THREE.Vector3(34, 0, BLUE_LINE + 15), Math.PI - 0.2, 1, this.collisionGrid);
        this.vehicles.addTank(new THREE.Vector3(-30, 0, BLUE_LINE + 19), Math.PI + 0.18, 1, this.collisionGrid);

        this.vehicles.addLauncher(new THREE.Vector3(-64, 0, RED_LINE - 26), 0.1, 0, this.collisionGrid);
        this.vehicles.addLauncher(new THREE.Vector3(58, 0, BLUE_LINE + 28), Math.PI - 0.1, 1, this.collisionGrid);

        this.vehicles.addHelicopter(new THREE.Vector3(0, 0, -10), 78, 46, 38, 0);
        this.vehicles.addHelicopter(new THREE.Vector3(10, 0, 14), 66, 40, 44, 1);
    }

    private buildFires() {
        let lit = 0;
        for (const point of this.props.firePoints) {
            this.effects.addFire(point, 1 + this.random() * 1.3, lit++ < 7);
        }

        // Roof and barrel plumes sit on something already, so they get no debris ring.
        for (const point of this.props.smokePoints) {
            this.effects.addFire(point, 1.6 + this.random() * 1.6, false, false);
        }

        // The two big ones burn on the wrecks in no man's land rather than on open
        // tarmac — an unexplained fire in the middle of a road reads as a bug.
        this.effects.addFire(new THREE.Vector3(-18, 0.35, 6), 2.4, true, false);
        this.effects.addFire(new THREE.Vector3(24, 0.35, -4), 2.1, true, false);
    }

    private buildSearchlights() {
        for (let i = 0; i < 4; i++) {
            const x = -70 + i * 46;
            const z = i % 2 === 0 ? -62 : 62;

            const base = this.mesh(new THREE.BoxGeometry(2.4, 1.4, 2.4), this.matte(0x3a342c, 0.9), [x, 0.7, z]);
            this.scene.add(base);

            const head = this.mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.4, 12), this.metal(0x6a6a6a, 0.5, 0.7), [x, 2.2, z], [Math.PI / 2, 0, 0]);
            this.scene.add(head);

            const beam = this.mesh(
                new THREE.CylinderGeometry(1.1, 9, 90, 16, 1, true),
                this.glow(0xbfd6ff, 0.055),
                [x, 46, z]
            );
            beam.castShadow = false;
            beam.renderOrder = 2;
            this.scene.add(beam);
            this.searchlights.push(beam);
        }
    }

    private buildEmbers() {
        const positions = new Float32Array(EMBER_COUNT * 3);
        this.emberVelocity = new Float32Array(EMBER_COUNT * 3);

        for (let i = 0; i < EMBER_COUNT; i++) {
            positions[i * 3] = (this.random() - 0.5) * HALF_WIDTH * 2;
            positions[i * 3 + 1] = this.random() * 30;
            positions[i * 3 + 2] = (this.random() - 0.5) * FIELD_DEPTH;
            this.emberVelocity[i * 3] = (this.random() - 0.5) * 1.6;
            this.emberVelocity[i * 3 + 1] = 1 + this.random() * 2.6;
            this.emberVelocity[i * 3 + 2] = (this.random() - 0.5) * 1.6;
        }

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = this.bin.material(new THREE.PointsMaterial({
            color: 0xff9a4a,
            size: 0.18,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        this.scene.add(points);
        this.embers = points;
    }

    private buildBattle(rm: ResourceManager) {
        this.battle = new WarBattle(this.crowd, this.effects, this.random, [
            {
                coverPoints: this.props.redCover,
                // Lined up with the gaps in the sandbag line and clear of the ruin rows,
                // so a runner always has an unobstructed lane to the front.
                rearSpawns: [
                    new THREE.Vector3(TRENCH_GAPS[0], 0, RED_LINE - 14),
                    new THREE.Vector3(TRENCH_GAPS[2], 0, RED_LINE - 16),
                    new THREE.Vector3(TRENCH_GAPS[4], 0, RED_LINE - 14),
                ],
                variantSet: "soldierRed",
                facing: 0,
                wallZ: RED_LINE - 1.9,
                gapsX: TRENCH_GAPS,
            },
            {
                coverPoints: this.props.blueCover,
                rearSpawns: [
                    new THREE.Vector3(TRENCH_GAPS[0], 0, BLUE_LINE + 14),
                    new THREE.Vector3(TRENCH_GAPS[2], 0, BLUE_LINE + 16),
                    new THREE.Vector3(TRENCH_GAPS[4], 0, BLUE_LINE + 14),
                ],
                variantSet: "soldierBlue",
                facing: Math.PI,
                wallZ: BLUE_LINE + 1.9,
                gapsX: TRENCH_GAPS,
            },
        ]);

        this.battle.create(rm, FIGHTERS_PER_SIDE, this.collisionGrid, JOHNNY_ANCHOR);
        this.battle.onJohnnyDied = () => this.reactToJohnnyDeath();
        this.battle.onJohnnyRevived = () => { this.johnnyTimer = JOHNNY_LIFETIME; };
    }

    private buildHeroes(rm: ResourceManager) {
        const sandbag = this.textured(this.tex.dirt(2, 0x6b6151, 0x9a8f78), { roughness: 0.96, metalness: 0.02, bump: 0.06 });
        const mound = this.mesh(new THREE.BoxGeometry(4.4, 1.1, 2.6), sandbag, [RAMBO_SPOT.x, 0.55, RAMBO_SPOT.z]);
        this.scene.add(mound);
        this.collisionGrid.insertOrientedBox(RAMBO_SPOT.x, RAMBO_SPOT.z, 4.4, 2.6, 0, 0, 1.1);

        const crate = this.mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), sandbag, [RAMBO_SPOT.x + 2.6, 0.4, RAMBO_SPOT.z - 0.6], [0, 0.4, 0]);
        this.scene.add(crate);

        const rambo = this.crowd.createActor(rm, {
            position: new THREE.Vector3(RAMBO_SPOT.x, 1.1, RAMBO_SPOT.z),
            set: "soldierRed",
            variantIndex: 2,
            facing: 0,
            pose: "hipFire",
            weapon: "machine-gun",
            accent: 0xff5a4a,
            phase: 0.2,
            solid: false,
        }, this.collisionGrid);

        if (rambo) {
            rambo.setFiring(true);
            rambo.setAim(0.06);
            rambo.scream(true);
            this.rambo = rambo;
        }

        const tarp = this.textured(this.tex.stripes([2, 2], 0x4a4236, 0x6b6151, 6), { roughness: 0.96, metalness: 0.02 });
        const post = this.mesh(new THREE.BoxGeometry(6, 0.24, 5.2), tarp, [MEDIC_SPOT.x, 0.12, MEDIC_SPOT.z]);
        post.receiveShadow = true;
        this.scene.add(post);

        const bagGeometry = this.bin.geometry(new THREE.BoxGeometry(0.92, 0.34, 0.5));
        for (let i = 0; i < 16; i++) {
            const angle = 0.5 + (i % 8) * 0.34;
            const row = Math.floor(i / 8);
            const bag = new THREE.Mesh(bagGeometry, sandbag);
            bag.position.set(
                MEDIC_SPOT.x + Math.cos(angle) * 3.2,
                0.41 + row * 0.33,
                MEDIC_SPOT.z + Math.sin(angle) * 3.2
            );
            bag.rotation.y = -angle + (row === 1 ? 0.18 : 0);
            bag.castShadow = true;
            this.scene.add(bag);
        }

        // The mattress Johnny is laid out on. Its own basis is reused below to place both
        // the body and the friend sitting beside it.
        const mattressForward = new THREE.Vector3(Math.sin(MATTRESS_FACING), 0, Math.cos(MATTRESS_FACING));
        const mattressAcross = new THREE.Vector3(-mattressForward.z, 0, mattressForward.x);

        // The death clip lays a body out along the actor's left, so the mattress runs the
        // same way — `across` is its length and `forward` its width.
        const mattressAngle = MATTRESS_FACING + Math.PI;

        const mattress = this.mesh(
            new THREE.BoxGeometry(2.5, 0.28, 1.2),
            tarp,
            [MATTRESS_SPOT.x, 0.26, MATTRESS_SPOT.z],
            [0, mattressAngle, 0]
        );
        mattress.receiveShadow = true;
        this.scene.add(mattress);

        const pillow = this.mesh(
            new THREE.BoxGeometry(0.5, 0.18, 1),
            tarp,
            [
                MATTRESS_SPOT.x + mattressAcross.x * 0.9,
                0.49,
                MATTRESS_SPOT.z + mattressAcross.z * 0.9,
            ],
            [0, mattressAngle, 0]
        );
        this.scene.add(pillow);

        for (const side of [-1, 1]) {
            const frame = this.mesh(
                new THREE.BoxGeometry(2.6, 0.12, 0.12),
                this.metal(0x3a3128, 0.6, 0.6),
                [
                    MATTRESS_SPOT.x + mattressForward.x * side * 0.62,
                    0.12,
                    MATTRESS_SPOT.z + mattressForward.z * side * 0.62,
                ],
                [0, mattressAngle, 0]
            );
            this.scene.add(frame);
        }

        const lamp = this.mesh(new THREE.SphereGeometry(0.2, 10, 8), this.glow(0xffc46a, 0.9), [MEDIC_SPOT.x - 2.3, 1.5, MEDIC_SPOT.z + 1.9]);
        lamp.castShadow = false;
        this.scene.add(lamp);

        const lampPost = this.mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.5, 6), this.metal(0x3a3128, 0.6, 0.6), [MEDIC_SPOT.x - 2.3, 0.87, MEDIC_SPOT.z + 1.9]);
        this.scene.add(lampPost);

        const lampLight = new THREE.PointLight(0xffb45a, 24, 16, 2);
        lampLight.position.set(MEDIC_SPOT.x - 2.3, 1.7, MEDIC_SPOT.z + 1.9);
        this.scene.add(lampLight);

        // Johnny's own side carries him off the line, so the pair wears blue — the same
        // man Rambo is cutting down out front, seen a beat later. The friend sits on the
        // ground beside the mattress rather than holding him.
        const medic = this.crowd.createActor(rm, {
            position: MATTRESS_SPOT.clone()
                .addScaledVector(mattressForward, -1.55)
                .addScaledVector(mattressAcross, 0.2)
                .setY(GROUND_SEAT_Y),
            set: "soldierBlue",
            variantIndex: 0,
            facing: Math.atan2(mattressForward.x, mattressForward.z),
            pose: "weep",
            accent: 0x9ec6ff,
            phase: 1.1,
            solid: false,
        }, this.collisionGrid);

        // Anchored half a body back down the mattress so the clip lays his head onto the
        // pillow end, resting on the mattress surface rather than sinking through it.
        const johnnyPosition = MATTRESS_SPOT.clone()
            .addScaledVector(mattressAcross, -0.3)
            .setY(0.54);

        // He plays the death clip and holds its last frame, so the body stays still
        // instead of breathing and swaying through a living pose.
        const johnny = this.crowd.createActor(rm, {
            position: johnnyPosition,
            set: "soldierBlue",
            variantIndex: JOHNNY_VARIANT,
            facing: MATTRESS_FACING,
            tilt: 0,
            accent: 0x8a8f98,
            phase: 2.4,
            solid: false,
        }, this.collisionGrid);
        johnny?.die();

        if (medic) {
            const first = this.bubble("STAY WITH ME, JOHNNY", "#ffd166", { width: 4, y: 2.6, speaker: medic });
            const second = this.bubble("HE BOUGHT THE TOP", "#9ec6ff", { width: 3.6, y: 2.6, speaker: medic });
            medic.group.add(first);
            medic.group.add(second);
            this.medicBubbleA = first;
            this.medicBubbleB = second;

            this.addStory([
                { duration: 5, enter: () => { first.visible = true; second.visible = false; } },
                { duration: 2, enter: () => { first.visible = false; } },
                { duration: 5, enter: () => { second.visible = true; } },
                { duration: 4, enter: () => { second.visible = false; } },
            ]);
        }

        if (johnny) {
            const relic = this.mesh(
                new THREE.PlaneGeometry(0.9, 0.45),
                this.decal(this.tex.sign("johnny", ["$JOHNNY", "2021-2026"], { background: 0x2a1418, color: 0xffb8b8, accent: 0x8f3f4f, width: 512, height: 256 }), { roughness: 0.9, metalness: 0.05 }),
                [MEDIC_SPOT.x + 2.2, 0.26, MEDIC_SPOT.z + 1.1],
                [-Math.PI / 2, 0, 0.6]
            );
            relic.castShadow = false;
            this.scene.add(relic);
        }

    }

    private reactToJohnnyDeath() {
        const johnny = this.battle.getJohnnyActor();
        if (!johnny) return;

        const witness = this.battle.nearestLiving(JOHNNY_TEAM, johnny.position, johnny);
        if (!witness) return;

        if (!this.johnnyScreamBubble) {
            this.johnnyScreamBubble = this.bubble("JOHNNNYYYY!!!", "#ff5a4a", { width: 3.4, tone: "shout", y: 2.9 });
        }

        const bubble = this.johnnyScreamBubble;
        witness.group.add(bubble);
        bubble.visible = true;
        witness.setTalking(true, "JOHNNY");

        this.johnnyScreamWitness = witness;
        this.johnnyScreamTimer = JOHNNY_SCREAM_DURATION;
    }

    private buildCrew() {
        const specs: CrowdSpec[] = [];

        const crews: Array<[number, number, number, "work" | "salute" | "carry" | "gawk", 0 | 1]> = [
            [-62, RED_LINE - 30, 0.6, "work", 0],
            [-59, RED_LINE - 31, 1.2, "carry", 0],
            [-67, RED_LINE - 28, 0.2, "work", 0],
            [56, BLUE_LINE + 32, Math.PI - 0.5, "work", 1],
            [60, BLUE_LINE + 31, Math.PI, "salute", 1],
            [53, BLUE_LINE + 33, Math.PI + 0.3, "carry", 1],
            [-40, RED_LINE - 16, 0.4, "gawk", 0],
            [32, BLUE_LINE + 17, Math.PI - 0.3, "gawk", 1],
        ];

        for (const [x, z, facing, pose, team] of crews) {
            specs.push({
                position: new THREE.Vector3(x, 0, z),
                set: team === 0 ? "soldierRed" : "soldierBlue",
                facing,
                pose,
                held: pose === "carry" ? "bag" : pose === "work" ? "wrench" : undefined,
                phase: this.random() * 8,
            });
        }

        const runners: Array<[number, number, number, number, 0 | 1]> = [
            [-78, RED_LINE - 24, -20, RED_LINE - 26, 0],
            [70, BLUE_LINE + 26, 14, BLUE_LINE + 24, 1],
            [-8, RED_LINE - 40, -8, RED_LINE - 18, 0],
            [12, BLUE_LINE + 42, 12, BLUE_LINE + 20, 1],
        ];

        for (const [x1, z1, x2, z2, team] of runners) {
            specs.push({
                position: new THREE.Vector3(x1, 0, z1),
                set: team === 0 ? "soldierRed" : "soldierBlue",
                walk: {
                    path: [new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x2, 0, z2)],
                    mode: "pingpong",
                    run: true,
                    pause: 2 + this.random() * 3,
                },
                held: "bag",
                phase: this.random() * 8,
            });
        }

        this.crowd.addMany(specs);
    }

    private updateRambo(delta: number) {
        const rambo = this.rambo;
        if (!rambo) return;

        // Counted in real time rather than per shot, so Johnny always takes the same ten
        // seconds to go down no matter how fast Rambo is firing.
        const johnnyAlive = this.battle.isJohnnyAlive();
        if (johnnyAlive) {
            this.johnnyTimer -= delta;
            if (this.johnnyTimer <= 0) {
                this.johnnyTimer = JOHNNY_LIFETIME;
                this.battle.killJohnny();
            }
        }

        this.ramboTimer -= delta;
        if (this.ramboTimer > 0) return;
        this.ramboTimer = RAMBO_SHOT_INTERVAL;

        rambo.muzzleWorld(this.ramboMuzzle);

        // Johnny is the man in his sights whenever he is up; anyone else only stands in
        // while Johnny is down and waiting to come back.
        const target = johnnyAlive
            ? this.battle.getJohnnyActor()
            : this.battle.nearestLiving(TEAM_BLUE, RAMBO_SPOT);

        if (target) {
            target.chestWorld(this.ramboTarget);
            this.ramboTarget.x += (this.random() - 0.5) * 1.4;
            this.ramboTarget.y += (this.random() - 0.5) * 0.5;
            this.ramboTarget.z += (this.random() - 0.5) * 1.4;

            if (johnnyAlive && this.random() < 0.5) {
                this.battle.flinchJohnny(0.45 + this.random() * 0.45);
            }
        } else {
            this.ramboTarget.set(
                RAMBO_SPOT.x + (this.random() - 0.5) * 26,
                1 + this.random() * 3,
                RAMBO_SPOT.z + 44 + this.random() * 18
            );
        }

        this.effects.spawnFlash(this.ramboMuzzle, 0.8, 0xffd2a0);
        this.effects.spawnTracer(this.ramboMuzzle, this.ramboTarget, 0xffc46a);
        rambo.kick(0.5);
    }

    protected tick(delta: number): void {
        this.updateRambo(delta);

        if (this.johnnyScreamTimer > 0) {
            this.johnnyScreamTimer -= delta;
            if (this.johnnyScreamTimer <= 0 && this.johnnyScreamBubble) {
                this.johnnyScreamBubble.visible = false;
                this.johnnyScreamWitness?.setTalking(false);
                this.johnnyScreamWitness = null;
            }
        }

        this.effects.update(delta, this.elapsed);
        this.props.update(delta, this.elapsed);
        this.vehicles.update(delta, this.elapsed);

        this.battle.setAirTarget(this.vehicles.helicopterTarget(this.airProbe));

        this.battle.update(delta);

        for (let i = 0; i < this.searchlights.length; i++) {
            const beam = this.searchlights[i];
            beam.rotation.z = Math.sin(this.elapsed * 0.22 + i * 2) * 0.42;
            beam.rotation.x = Math.cos(this.elapsed * 0.17 + i) * 0.3;
        }

        this.artilleryTimer -= delta;
        if (this.artilleryTimer <= 0) {
            this.artilleryTimer = 3 + this.random() * 6;

            const x = (this.random() - 0.5) * HALF_WIDTH * 1.8;
            const z = (this.random() - 0.5) * 90;
            this.effects.spawnExplosion(new THREE.Vector3(x, 0.4, z), 5 + this.random() * 5);
            this.flashTimer = 0.18;
        }

        if (this.skyFlash) {
            if (this.flashTimer > 0) {
                this.flashTimer -= delta;
                this.skyFlash.intensity = 320 * Math.max(0, this.flashTimer / 0.18);
            } else {
                this.skyFlash.intensity = 16 + Math.sin(this.elapsed * 0.7) * 9;
            }
        }

        if (this.embers) {
            const attribute = this.embers.geometry.getAttribute("position") as THREE.BufferAttribute;
            const array = attribute.array as Float32Array;
            for (let i = 0; i < array.length; i += 3) {
                array[i] += this.emberVelocity[i] * delta;
                array[i + 1] += this.emberVelocity[i + 1] * delta;
                array[i + 2] += this.emberVelocity[i + 2] * delta;
                if (array[i + 1] > 34) {
                    array[i] = (this.random() - 0.5) * HALF_WIDTH * 2;
                    array[i + 1] = 0.4;
                    array[i + 2] = (this.random() - 0.5) * FIELD_DEPTH;
                }
            }
            attribute.needsUpdate = true;
        }
    }
}
