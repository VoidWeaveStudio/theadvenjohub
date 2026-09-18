// src/features/game/world/locations/showcase/rooms/BazaarRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import type { ShowcaseActor } from "../actors/ShowcaseActor";

const SQUARE_RADIUS = 62;
const FOUNTAIN_CENTER = new THREE.Vector3(0, 0, 22);
const STALL_X = 11.5;
const STALL_FIRST_Z = -26;
const STALL_STEP = 8.5;
const STALL_ROWS = 7;
const DUST_COUNT = 220;

const TICKERS = ["$DOGE", "$PEPE", "$WIF", "$BONK", "$SHIB", "$FLOKI", "$BRETT", "$MOG"];
const AWNING_COLORS = [0xd94f4f, 0x3f8f6b, 0x4f7fd8, 0xf2c53d, 0xa855f7, 0xff8f5a, 0x2fbf9f];
const PRICES = ["0.004", "1.21", "0.00069", "42.0", "0.31", "7.77", "0.0001", "13.5"];
const RUG_STALL = new THREE.Vector3(-21, 0, -8);
const CHANGER_CENTER = new THREE.Vector3(21, 0, 4);
const AUCTION_CENTER = new THREE.Vector3(-25, 0, 18);
const ORACLE_CENTER = new THREE.Vector3(25, 0, -20);
const CART_CENTER = new THREE.Vector3(-7, 0, -33);

interface Bird {
    group: THREE.Group;
    wings: THREE.Mesh[];
    radius: number;
    height: number;
    speed: number;
    phase: number;
}

export class BazaarRoom extends ShowcaseRoom {
    private rugs: THREE.Mesh[] = [];
    private scale: THREE.Object3D | null = null;
    private gavel: THREE.Object3D | null = null;
    private auctionPrize: THREE.Mesh | null = null;
    private oracleOrb: THREE.Mesh | null = null;
    private braziers: THREE.MeshBasicMaterial[] = [];
    private barker: ShowcaseActor | null = null;
    private scammer: ShowcaseActor | null = null;
    private mark: ShowcaseActor | null = null;
    private awnings: THREE.Mesh[] = [];
    private lanterns: THREE.Mesh[] = [];
    private lanternMaterials: THREE.MeshBasicMaterial[] = [];
    private birds: Bird[] = [];
    private dust: THREE.Points | null = null;
    private water: THREE.Mesh | null = null;
    private coinStatue: THREE.Object3D | null = null;
    private bunting: THREE.Object3D[] = [];

    constructor(info: ShowcaseInfo = SHOWCASE_INFO_BY_ID.get("show-bazaar") as ShowcaseInfo) {
        super(info, 0x1f9ac3, 60);
        this.exitPosition.set(0, 0, -38);
        this.exitFacing = 0;
        this.spawnPosition.set(0, 0, -31);
    }

    protected buildAtmosphere(): void {
        this.scene.background = new THREE.Color(0xd9c39a);
        this.scene.fog = new THREE.FogExp2(0xd4bd92, 0.0068);

        this.scene.add(new THREE.AmbientLight(0xfff0d0, 0.42));
        this.scene.add(new THREE.HemisphereLight(0xffe6bd, 0x8a6a42, 0.55));

        const sun = new THREE.DirectionalLight(0xfff2d0, 1.85);
        sun.position.set(44, 58, -30);
        sun.target.position.set(0, 0, 8);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -60;
        sun.shadow.camera.right = 60;
        sun.shadow.camera.top = 60;
        sun.shadow.camera.bottom = -60;
        sun.shadow.camera.near = 5;
        sun.shadow.camera.far = 200;
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.04;
        sun.shadow.camera.updateProjectionMatrix();
        this.scene.add(sun);
        this.scene.add(sun.target);

        const bounce = new THREE.DirectionalLight(0xffd9a0, 0.3);
        bounce.position.set(-40, 16, 40);
        this.scene.add(bounce);

        const skySkin = this.bin.material(new THREE.MeshBasicMaterial({
            map: this.tex.gradient("bazaar", [[0, 0xe8d4a8], [0.42, 0xf2d9a0], [0.72, 0xbcd4e8], [1, 0x7fa8d8]], 0.06),
            side: THREE.BackSide,
            fog: false,
            toneMapped: false,
        }));

        const sky = this.mesh(new THREE.SphereGeometry(280, 32, 20), skySkin, [0, 0, 0]);
        sky.castShadow = false;
        this.scene.add(sky);

        const sunDisc = this.mesh(
            new THREE.CircleGeometry(16, 32),
            this.bin.material(new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false, toneMapped: false })),
            [150, 120, -180]
        );
        sunDisc.castShadow = false;
        sunDisc.lookAt(0, 0, 0);
        this.scene.add(sunDisc);

        const sunHalo = this.mesh(new THREE.CircleGeometry(38, 32), this.glow(0xffe0a0, 0.22), [148, 118, -177]);
        sunHalo.castShadow = false;
        sunHalo.lookAt(0, 0, 0);
        this.scene.add(sunHalo);
    }

    protected decorate(rm: ResourceManager): void {
        this.buildGround();
        this.buildWalls();
        this.buildStalls();
        this.buildRugStall();
        this.buildChanger();
        this.buildAuction();
        this.buildOracle();
        this.buildBraziers();
        this.buildCart();
        this.buildFountain();
        this.buildBunting();
        this.buildBirds();
        this.buildDust();
        this.buildCrowd();
        this.buildHustle(rm);
    }

    private buildHustle(rm: ResourceManager) {
        const barkerSpot = new THREE.Vector3(-9.2, 0, -12);
        const crate = this.mesh(
            new THREE.BoxGeometry(1.7, 1, 1.7),
            this.textured(this.tex.planks([2, 1], 0x8a6136, 0x54351a, 5), { roughness: 0.94, metalness: 0.02, bump: 0.05 }),
            [barkerSpot.x, 0.5, barkerSpot.z],
            [0, 0.3, 0]
        );
        this.scene.add(crate);
        this.collisionGrid.insertOrientedBox(barkerSpot.x, barkerSpot.z, 1.7, 1.7, 0.3, 0, 1);

        const barker = this.crowd.createActor(rm, {
            position: new THREE.Vector3(barkerSpot.x, 1, barkerSpot.z),
            set: "trader",
            variantIndex: 2,
            facing: 1.4,
            pose: "hail",
            held: "sign",
            heldHand: "left",
            accent: 0xf2c53d,
            phase: 0.6,
            solid: false,
        }, this.collisionGrid);

        if (barker) {
            this.barker = barker;
            const lines = [
                this.bubble("1000x GUARANTEED", "#f2c53d", { width: 3.8, tone: "shout", y: 2.8, speaker: barker }),
                this.bubble("PRESALE ENDS TONIGHT", "#ff8f5a", { width: 4.2, y: 2.8, speaker: barker }),
                this.bubble("TRUST ME BRO", "#7ce8a8", { width: 3, y: 2.8, speaker: barker }),
                this.bubble("AUDITED BY MY COUSIN", "#67c9ff", { width: 4.4, y: 2.8, speaker: barker }),
            ];
            for (const line of lines) barker.group.add(line);

            const show = (index: number) => {
                for (let i = 0; i < lines.length; i++) lines[i].visible = i === index;
            };

            this.addStory([
                { duration: 3.2, enter: () => show(0) },
                { duration: 0.5, enter: () => show(-1) },
                { duration: 3.2, enter: () => show(1) },
                { duration: 0.5, enter: () => show(-1) },
                { duration: 3.2, enter: () => show(2) },
                { duration: 0.5, enter: () => show(-1) },
                { duration: 3.2, enter: () => show(3) },
                { duration: 0.5, enter: () => show(-1) },
            ]);
        }

        const dealSpot = new THREE.Vector3(8.4, 0, 8);
        const runSpot = new THREE.Vector3(16, 0, -22);
        const markSpot = new THREE.Vector3(7.2, 0, 9.6);

        const scammer = this.crowd.createActor(rm, {
            position: dealSpot.clone(),
            set: "trader",
            variantIndex: 0,
            facing: 2.6,
            pose: "haggle",
            held: "bag",
            accent: 0xa855f7,
            phase: 2.2,
            solid: false,
        }, this.collisionGrid);

        const mark = this.crowd.createActor(rm, {
            position: markSpot.clone(),
            set: "crowd",
            variantIndex: 1,
            facing: -0.6,
            pose: "haggle",
            held: "cash",
            accent: 0x67c9ff,
            phase: 4.3,
            solid: false,
        }, this.collisionGrid);

        if (!scammer || !mark) return;
        this.scammer = scammer;
        this.mark = mark;

        scammer.setHeldVisible(false);

        const pitch = this.bubble("FLOOR IS RISING", "#a855f7", { width: 3.6, y: 2.9, speaker: scammer });
        const gone = this.bubble("SEE YOU NEVER", "#ff4a4a", { width: 3.4, tone: "shout", y: 2.9, speaker: scammer });
        scammer.group.add(pitch);
        scammer.group.add(gone);

        const doubt = this.bubble("IS IT AUDITED?", "#67c9ff", { width: 3.4, y: 2.9, speaker: mark });
        const loss = this.bubble("MY BAGS...", "#ff8f8f", { width: 2.8, y: 2.9, speaker: mark });
        mark.group.add(doubt);
        mark.group.add(loss);

        this.addStory([
            {
                duration: 5,
                enter: () => {
                    pitch.visible = true;
                    gone.visible = false;
                    doubt.visible = false;
                    loss.visible = false;
                    scammer.setPose("haggle");
                    scammer.setHeldVisible(false);
                    scammer.moveTo(dealSpot.x, 0, dealSpot.z);
                    scammer.setFacing(2.6);
                    mark.setPose("haggle");
                    mark.setHeldVisible(true);
                    mark.moveTo(markSpot.x, 0, markSpot.z);
                    mark.setFacing(-0.6);
                },
            },
            {
                duration: 3,
                enter: () => {
                    pitch.visible = false;
                    doubt.visible = true;
                },
            },
            {
                duration: 2.5,
                enter: () => {
                    doubt.visible = false;
                    mark.setHeldVisible(false);
                    scammer.setHeldVisible(true);
                    scammer.setPose("carry");
                },
            },
            {
                duration: 7,
                enter: () => {
                    gone.visible = true;
                    scammer.setDestination(runSpot, 4.4);
                    mark.setPose("gawk");
                },
                update: (elapsed) => {
                    gone.visible = elapsed < 2.5;
                },
            },
            {
                duration: 6,
                enter: () => {
                    gone.visible = false;
                    mark.setPose("grieve");
                    loss.visible = true;
                },
            },
            {
                duration: 4,
                enter: () => {
                    loss.visible = false;
                },
            },
        ]);
    }

    private buildGround() {
        const sand = this.textured(this.tex.sand(24, 0xc4a473), { roughness: 0.96, metalness: 0.02, bump: 0.05 });
        const cobble = this.textured(this.tex.cobble([4, 16], 0xa98f62, 0x7a6543), { roughness: 0.95, metalness: 0.03, bump: 0.07 });
        const plazaSkin = this.textured(this.tex.cobble(8, 0xb59a6d, 0x826d4a), { roughness: 0.95, metalness: 0.03, bump: 0.07 });
        const carpetColors: Array<[number, number]> = [
            [0x9c3f4a, 0xe8c87a],
            [0x3f6b8f, 0xe8e0c0],
            [0x7a5a9c, 0xffd166],
            [0xb8863f, 0x4a3a2a],
        ];

        const ground = this.mesh(new THREE.CircleGeometry(SQUARE_RADIUS + 18, 56), sand, [0, 0, 0], [-Math.PI / 2, 0, 0]);
        ground.castShadow = false;
        this.scene.add(ground);

        const street = this.mesh(new THREE.PlaneGeometry(20, 84), cobble, [0, 0.03, -4], [-Math.PI / 2, 0, 0]);
        street.castShadow = false;
        this.scene.add(street);

        const plaza = this.mesh(new THREE.CircleGeometry(20, 40), plazaSkin, [FOUNTAIN_CENTER.x, 0.06, FOUNTAIN_CENTER.z], [-Math.PI / 2, 0, 0]);
        plaza.castShadow = false;
        this.scene.add(plaza);

        for (let i = 0; i < 14; i++) {
            const x = (this.random() - 0.5) * 34;
            const z = (this.random() - 0.5) * 60;
            const [cbase, caccent] = carpetColors[Math.floor(this.random() * carpetColors.length)];
            const carpet = this.mesh(
                new THREE.PlaneGeometry(2.6 + this.random() * 2, 3.4 + this.random() * 2),
                this.textured(this.tex.carpet(1, cbase, caccent), { roughness: 0.95, metalness: 0 }),
                [x, 0.1, z],
                [-Math.PI / 2, 0, this.random() * Math.PI]
            );
            carpet.castShadow = false;
            this.scene.add(carpet);
        }

        this.collisionGrid.insertRingWall(SQUARE_RADIUS, 2, 0, 10);
    }

    private buildWalls() {
        const clay = this.textured(this.tex.plaster([2, 2], 0xc9a678, 0x7a5a34), { roughness: 0.95, metalness: 0.02, bump: 0.06 });
        const clayDark = this.textured(this.tex.plaster([2, 2], 0xa8865a, 0x5a4020), { roughness: 0.96, metalness: 0.02, bump: 0.06 });

        for (let i = 0; i < 26; i++) {
            const angle = (i / 26) * Math.PI * 2;
            if (Math.abs(Math.sin(angle)) < 0.18 && Math.cos(angle) < 0) continue;

            const distance = SQUARE_RADIUS - 6 + this.random() * 8;
            const x = Math.sin(angle) * distance;
            const z = Math.cos(angle) * distance;
            const width = 9 + this.random() * 7;
            const height = 6 + this.random() * 9;

            const house = this.mesh(
                new THREE.BoxGeometry(width, height, width * 0.85),
                this.random() < 0.5 ? clay : clayDark,
                [x, height / 2, z],
                [0, -angle, 0]
            );
            this.scene.add(house);
            this.collisionGrid.insertOrientedBox(x, z, width, width * 0.85, -angle, 0, height);

            const parapet = this.mesh(
                new THREE.BoxGeometry(width + 0.6, 0.7, width * 0.85 + 0.6),
                clayDark,
                [x, height + 0.35, z],
                [0, -angle, 0]
            );
            this.scene.add(parapet);

            for (let w = 0; w < 3; w++) {
                const opening = this.mesh(
                    new THREE.BoxGeometry(1.3, 1.9, 0.3),
                    this.matte(0x4a3a2a, 0.95),
                    [x - Math.cos(angle) * 0.2, 2.4 + w * 3, z],
                    [0, -angle, 0]
                );
                opening.position.add(new THREE.Vector3(Math.sin(angle + Math.PI) * (width * 0.44), 0, Math.cos(angle + Math.PI) * (width * 0.44)));
                this.scene.add(opening);
            }
        }
    }

    private buildStalls() {
        const wood = this.textured(this.tex.planks([2, 1], 0x8a6136, 0x54351a, 5), { roughness: 0.94, metalness: 0.02, bump: 0.05 });
        const woodDark = this.textured(this.tex.planks([2, 1], 0x6b4a28, 0x3a2614, 5), { roughness: 0.95, metalness: 0.02, bump: 0.05 });
        const coinGold = this.metal(0xe0b552, 0.32, 0.9);
        const coinSilver = this.metal(0xc8ccd4, 0.3, 0.9);

        for (let row = 0; row < STALL_ROWS; row++) {
            for (const side of [-1, 1]) {
                const x = side * STALL_X;
                const z = STALL_FIRST_Z + row * STALL_STEP + (side > 0 ? 3.5 : 0);
                const color = AWNING_COLORS[(row + (side > 0 ? 3 : 0)) % AWNING_COLORS.length];

                const stall = new THREE.Group();
                stall.position.set(x, 0, z);
                stall.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;

                const counter = this.mesh(new THREE.BoxGeometry(5.2, 0.9, 1.5), wood, [0, 0.95, 1]);
                stall.add(counter);

                const counterTop = this.mesh(new THREE.BoxGeometry(5.6, 0.16, 1.9), woodDark, [0, 1.45, 1]);
                stall.add(counterTop);

                for (const dx of [-2.4, 2.4]) {
                    const post = this.mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.4, 8), woodDark, [dx, 1.7, 0.4]);
                    stall.add(post);

                    const postBack = this.mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.8, 8), woodDark, [dx, 1.9, -1.8]);
                    stall.add(postBack);
                }

                const awningMaterial = this.textured(this.tex.stripes([2, 1], color, 0xf6efe0, 10), { roughness: 0.88, metalness: 0.02 });
                awningMaterial.side = THREE.DoubleSide;

                const awning = this.mesh(new THREE.PlaneGeometry(5.8, 3.4, 6, 3), awningMaterial, [0, 3.5, -0.5], [-1.15, 0, 0]);
                stall.add(awning);
                this.awnings.push(awning);

                const stripe = this.mesh(new THREE.BoxGeometry(5.8, 0.2, 0.14), woodDark, [0, 3.02, 0.92]);
                stall.add(stripe);

                const backWall = this.mesh(new THREE.BoxGeometry(5.4, 2.6, 0.16), woodDark, [0, 1.3, -1.9]);
                stall.add(backWall);

                for (let p = 0; p < 4; p++) {
                    const pile = new THREE.Group();
                    pile.position.set(-1.9 + p * 1.3, 1.53, 0.9);

                    const count = 3 + Math.floor(this.random() * 4);
                    for (let c = 0; c < count; c++) {
                        const coin = this.mesh(
                            new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14),
                            p % 2 === 0 ? coinGold : coinSilver,
                            [(this.random() - 0.5) * 0.1, c * 0.07, (this.random() - 0.5) * 0.1]
                        );
                        pile.add(coin);
                    }

                    stall.add(pile);
                }

                for (let s = 0; s < 3; s++) {
                    const sack = this.mesh(
                        new THREE.SphereGeometry(0.45, 10, 8),
                        this.matte(0xc9a86a, 0.95),
                        [-2 + s * 1.9, 0.45, 2.1]
                    );
                    sack.scale.y = 1.2;
                    stall.add(sack);
                }

                const crate = this.mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), woodDark, [2.4, 0.45, 2.2], [0, 0.4, 0]);
                stall.add(crate);

                const index = (row + (side > 0 ? 4 : 0)) % TICKERS.length;
                const board = this.board(
                    this.tex.sign(`stall${index}`, [TICKERS[index], `$${PRICES[index % PRICES.length]}`], {
                        background: 0x3a2a18,
                        color: 0xffe9c4,
                        accent: color,
                    }),
                    3.8,
                    1.9,
                    [0, 4.4, 0.42],
                    0,
                    { roughness: 0.9, metalness: 0.05 }
                );
                stall.add(board);

                for (const dx of [-1.8, 1.8]) {
                    const bracket = this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), woodDark, [dx, 3.9, 0.42]);
                    stall.add(bracket);
                }

                this.scene.add(stall);
                this.collisionGrid.insertOrientedBox(x, z, 2.4, 5.6, 0, 0, 1.6);
            }
        }
    }

    private buildRugStall() {
        const wood = this.textured(this.tex.planks([2, 1], 0x8a6136, 0x54351a, 5), { roughness: 0.94, metalness: 0.02, bump: 0.05 });
        const rugColors: Array<[number, number]> = [
            [0x9c3f4a, 0xe8c87a],
            [0x3f6b8f, 0xe8e0c0],
            [0x7a5a9c, 0xffd166],
            [0xb8863f, 0x4a3a2a],
        ];

        const group = new THREE.Group();
        group.position.copy(RUG_STALL);
        group.rotation.y = Math.PI / 2;

        const platform = this.mesh(new THREE.BoxGeometry(11, 0.4, 7), wood, [0, 0.2, 0]);
        platform.receiveShadow = true;
        group.add(platform);

        for (const dx of [-5, 5]) {
            const post = this.mesh(new THREE.CylinderGeometry(0.16, 0.2, 6, 8), wood, [dx, 3, -2.8]);
            group.add(post);
        }

        const rail = this.mesh(new THREE.CylinderGeometry(0.12, 0.12, 10.4, 8), wood, [0, 5.6, -2.8], [0, 0, Math.PI / 2]);
        group.add(rail);

        for (let i = 0; i < 4; i++) {
            const [base, accent] = rugColors[i];
            const skin = this.textured(this.tex.carpet(1, base, accent), { roughness: 0.96, metalness: 0 });
            skin.side = THREE.DoubleSide;

            const hanging = this.mesh(new THREE.PlaneGeometry(2.3, 4, 4, 6), skin, [-3.6 + i * 2.4, 3.5, -2.7]);
            hanging.castShadow = false;
            group.add(hanging);
            this.rugs.push(hanging);

            const rolled = this.mesh(new THREE.CylinderGeometry(0.34, 0.34, 3.2, 12), skin, [-3.4 + i * 2.2, 0.75, 1.6], [0, 0, Math.PI / 2]);
            group.add(rolled);
        }

        const sign = this.board(
            this.tex.sign("rugs", ["RUGS", "PULLED FRESH DAILY"], { background: 0x4a2a1a, color: 0xffd9a0, accent: 0xd94f4f }),
            5.4,
            2.7,
            [0, 6.6, -2.7],
            0,
            { roughness: 0.9, metalness: 0.04 }
        );
        group.add(sign);

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(RUG_STALL.x, RUG_STALL.z, 7, 11, 0, 0, 0.6);
    }

    private buildChanger() {
        const stone = this.textured(this.tex.stoneBlock([2, 1], 0xc2b08a, 0x8a7a58, 4), { roughness: 0.93, metalness: 0.04, bump: 0.07 });
        const brass = this.metal(0xd8b46a, 0.3, 0.9);
        const wood = this.textured(this.tex.planks([2, 1], 0x6b4a28, 0x3a2614, 5), { roughness: 0.94, metalness: 0.03, bump: 0.05 });

        const group = new THREE.Group();
        group.position.copy(CHANGER_CENTER);
        group.rotation.y = -Math.PI / 2;

        const booth = this.mesh(new THREE.BoxGeometry(6, 3.4, 4), stone, [0, 1.7, -1]);
        group.add(booth);

        const counter = this.mesh(new THREE.BoxGeometry(6.4, 0.2, 1.6), wood, [0, 1.4, 1.2]);
        group.add(counter);

        const awningSkin = this.textured(this.tex.stripes([2, 1], 0x3f6b8f, 0xe8e0c0, 8), { roughness: 0.9, metalness: 0.02 });
        awningSkin.side = THREE.DoubleSide;
        const awning = this.mesh(new THREE.PlaneGeometry(7, 3, 5, 3), awningSkin, [0, 3.6, 0.8], [-1.1, 0, 0]);
        awning.castShadow = false;
        group.add(awning);
        this.awnings.push(awning);

        for (let i = 0; i < 7; i++) {
            const bar = this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), brass, [-2.4 + i * 0.8, 2.3, 1.1]);
            group.add(bar);
        }

        const scale = new THREE.Group();
        scale.position.set(2.2, 1.5, 1.2);
        const stand = this.mesh(new THREE.CylinderGeometry(0.08, 0.16, 1.1, 8), brass, [0, 0.55, 0]);
        scale.add(stand);
        const beam = this.mesh(new THREE.BoxGeometry(1.8, 0.07, 0.07), brass, [0, 1.12, 0]);
        scale.add(beam);
        for (const side of [-1, 1]) {
            const pan = this.mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.1, 12), brass, [side * 0.85, 0.82, 0]);
            scale.add(pan);
            const wire = this.mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 4), brass, [side * 0.85, 0.98, 0]);
            scale.add(wire);
        }
        group.add(scale);
        this.scale = scale;

        const coinGold = this.metal(0xe0b552, 0.32, 0.9);
        for (let i = 0; i < 5; i++) {
            const coin = this.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14), coinGold, [-2.2 + i * 0.34, 1.53, 1.2]);
            group.add(coin);
        }

        const sign = this.board(
            this.tex.sign("changer", ["EXCHANGE", "1 $BONK = 1 $BONK"], { background: 0x2a2418, color: 0xffe9a8, accent: 0xd8b46a }),
            5,
            2.5,
            [0, 4.6, 1.05],
            0,
            { roughness: 0.9, metalness: 0.05 }
        );
        group.add(sign);

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(CHANGER_CENTER.x, CHANGER_CENTER.z, 4, 6.4, 0, 0, 2);
    }

    private buildAuction() {
        const wood = this.textured(this.tex.planks([3, 1], 0x8a6136, 0x54351a, 6), { roughness: 0.94, metalness: 0.02, bump: 0.05 });
        const cloth = this.textured(this.tex.carpet(1, 0x9c3f4a, 0xe8c87a), { roughness: 0.96, metalness: 0 });

        const group = new THREE.Group();
        group.position.copy(AUCTION_CENTER);
        group.rotation.y = 0.5;

        const dais = this.mesh(new THREE.CylinderGeometry(3.4, 3.8, 1.1, 18), wood, [0, 0.55, 0]);
        dais.receiveShadow = true;
        group.add(dais);
        this.collisionGrid.insertCylinder(new THREE.Vector3(AUCTION_CENTER.x, 0.55, AUCTION_CENTER.z), 3.8, 1.1);

        const drape = this.mesh(new THREE.CylinderGeometry(3.45, 3.45, 0.9, 18, 1, true), cloth, [0, 0.55, 0]);
        (drape.material as THREE.Material).side = THREE.DoubleSide;
        group.add(drape);

        const lectern = this.mesh(new THREE.BoxGeometry(1.4, 1.2, 0.8), wood, [0, 1.7, 1.2]);
        group.add(lectern);

        const gavelBase = this.mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 12), wood, [0, 2.38, 1.2]);
        group.add(gavelBase);

        const gavel = new THREE.Group();
        gavel.position.set(0.7, 2.7, 1.2);
        const head = this.mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 10), wood, [0, 0, 0], [0, 0, Math.PI / 2]);
        gavel.add(head);
        const handle = this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8), wood, [0, -0.35, 0]);
        gavel.add(handle);
        group.add(gavel);
        this.gavel = gavel;

        for (const dx of [-3, 3]) {
            const post = this.mesh(new THREE.CylinderGeometry(0.14, 0.18, 5, 8), wood, [dx, 2.5, -1.4]);
            group.add(post);
        }

        const board = this.board(
            this.tex.sign("auction", ["LOT 404", "1 000 000 $HOPIUM"], { background: 0x3a2a18, color: 0xffe9a8, accent: 0xff8f5a }),
            5.6,
            2.8,
            [0, 4.4, -1.35],
            0,
            { roughness: 0.9, metalness: 0.05 }
        );
        group.add(board);

        const prize = this.mesh(
            new THREE.CylinderGeometry(0.9, 0.9, 0.24, 26),
            this.lit(0xffd166, 0.7),
            [-1.4, 1.5, 0.4],
            [0.4, 0, 0.2]
        );
        group.add(prize);
        this.auctionPrize = prize;

        this.scene.add(group);
    }

    private buildOracle() {
        const canvasSkin = this.textured(this.tex.stripes([2, 2], 0x5a3a7a, 0x2a1a3a, 10), { roughness: 0.94, metalness: 0.02, bump: 0.05 });
        const rope = this.matte(0xc9a86a, 0.92);

        const group = new THREE.Group();
        group.position.copy(ORACLE_CENTER);

        const tent = this.mesh(new THREE.ConeGeometry(5, 6.4, 10), canvasSkin, [0, 3.2, 0]);
        group.add(tent);
        this.collisionGrid.insertCylinder(new THREE.Vector3(ORACLE_CENTER.x, 2, ORACLE_CENTER.z), 4.4, 4);

        const skirt = this.mesh(new THREE.CylinderGeometry(5, 5.2, 0.4, 10), canvasSkin, [0, 0.2, 0]);
        group.add(skirt);

        const doorway = this.mesh(new THREE.BoxGeometry(2.2, 3, 0.2), this.matte(0x140d1c, 0.98, 0), [0, 1.5, 4.2]);
        group.add(doorway);

        for (const side of [-1, 1]) {
            const flap = this.mesh(new THREE.PlaneGeometry(1.2, 3, 2, 4), canvasSkin, [side * 1.6, 1.5, 4.3], [0, side * 0.5, 0]);
            (flap.material as THREE.Material).side = THREE.DoubleSide;
            flap.castShadow = false;
            group.add(flap);
        }

        const finial = this.mesh(new THREE.SphereGeometry(0.4, 12, 10), this.lit(0xa855f7, 1.2), [0, 6.7, 0]);
        finial.castShadow = false;
        group.add(finial);
        this.oracleOrb = finial;

        const table = this.mesh(new THREE.CylinderGeometry(1, 1, 0.16, 14), this.matte(0x3a2a44, 0.9), [0, 1, 3.2]);
        group.add(table);

        const stem = this.mesh(new THREE.CylinderGeometry(0.16, 0.26, 1, 8), this.matte(0x3a2a44, 0.9), [0, 0.5, 3.2]);
        group.add(stem);

        const orb = this.mesh(new THREE.SphereGeometry(0.44, 16, 12), this.glow(0x9f7fff, 0.85), [0, 1.5, 3.2]);
        orb.castShadow = false;
        group.add(orb);

        const light = new THREE.PointLight(0xa855f7, 20, 16, 2);
        light.position.set(0, 1.8, 3.2);
        group.add(light);

        const sign = this.board(
            this.tex.sign("oracle", ["PRICE ORACLE", "TOP IS IN. PROBABLY."], { background: 0x1e142c, color: 0xe0d0ff, accent: 0xa855f7 }),
            4.6,
            2.3,
            [0, 4.6, 3.3],
            0,
            { roughness: 0.88, metalness: 0.06, emissive: 0xa855f7, emissiveIntensity: 0.3 }
        );
        group.add(sign);

        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const peg = this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 5), rope, [Math.cos(angle) * 6.4, 0.3, Math.sin(angle) * 6.4]);
            group.add(peg);

            const guy = this.mesh(new THREE.CylinderGeometry(0.03, 0.03, 6.6, 4), rope, [Math.cos(angle) * 5.5, 2.4, Math.sin(angle) * 5.5]);
            guy.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(-Math.cos(angle) * 1.6, 5.4, -Math.sin(angle) * 1.6).normalize()
            );
            guy.castShadow = false;
            group.add(guy);
        }

        this.scene.add(group);
    }

    private buildBraziers() {
        const iron = this.metal(0x3a3128, 0.62, 0.62);

        for (let i = 0; i < 6; i++) {
            const z = -30 + i * 12;
            for (const side of [-1, 1]) {
                const x = side * 4.6;
                const group = new THREE.Group();
                group.position.set(x, 0, z);

                for (let leg = 0; leg < 3; leg++) {
                    const angle = (leg / 3) * Math.PI * 2;
                    const foot = this.mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.35, 6), iron, [Math.cos(angle) * 0.24, 0.66, Math.sin(angle) * 0.24], [Math.sin(angle) * 0.2, 0, -Math.cos(angle) * 0.2]);
                    group.add(foot);
                }

                const bowl = this.mesh(new THREE.CylinderGeometry(0.44, 0.28, 0.36, 14), iron, [0, 1.42, 0]);
                group.add(bowl);

                const coals = this.mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 14), this.lit(0xff5a2a, 1.6), [0, 1.6, 0]);
                coals.castShadow = false;
                group.add(coals);

                const flameMaterial = this.glow(0xffa845, 0.75);
                this.braziers.push(flameMaterial);
                const flame = this.mesh(new THREE.ConeGeometry(0.3, 0.8, 9), flameMaterial, [0, 1.98, 0]);
                flame.castShadow = false;
                group.add(flame);

                const flameInner = this.mesh(new THREE.ConeGeometry(0.16, 0.44, 8), this.glow(0xfff3c4, 0.85), [0, 1.84, 0]);
                flameInner.castShadow = false;
                group.add(flameInner);

                const light = new THREE.PointLight(0xff9a4a, 16, 14, 2);
                light.position.set(0, 1.9, 0);
                group.add(light);

                this.scene.add(group);
                this.collisionGrid.insertCylinder(new THREE.Vector3(x, 0.8, z), 0.56, 1.7);
            }
        }
    }

    private buildCart() {
        const wood = this.textured(this.tex.planks([2, 1], 0x8a6136, 0x54351a, 5), { roughness: 0.94, metalness: 0.02, bump: 0.05 });
        const iron = this.metal(0x3a3128, 0.6, 0.65);

        const group = new THREE.Group();
        group.position.copy(CART_CENTER);
        group.rotation.y = 0.9;

        const bed = this.mesh(new THREE.BoxGeometry(4.6, 0.3, 2.4), wood, [0, 1.1, 0]);
        group.add(bed);

        for (const dz of [-1.2, 1.2]) {
            const side = this.mesh(new THREE.BoxGeometry(4.6, 0.8, 0.16), wood, [0, 1.5, dz]);
            group.add(side);
        }

        const front = this.mesh(new THREE.BoxGeometry(0.16, 0.8, 2.4), wood, [-2.3, 1.5, 0]);
        group.add(front);

        for (const side of [-1, 1]) {
            const wheel = this.mesh(new THREE.TorusGeometry(0.85, 0.12, 8, 20), wood, [0.6, 0.85, side * 1.35], [0, Math.PI / 2, 0]);
            group.add(wheel);

            for (let s = 0; s < 6; s++) {
                const spoke = this.mesh(new THREE.BoxGeometry(0.1, 1.7, 0.08), wood, [0.6, 0.85, side * 1.35], [0, Math.PI / 2, (s / 6) * Math.PI]);
                group.add(spoke);
            }
        }

        const shaft = this.mesh(new THREE.CylinderGeometry(0.09, 0.09, 3, 8), wood, [-3.6, 1.05, 0], [0, 0, Math.PI / 2 - 0.16]);
        group.add(shaft);

        const brace = this.mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 8), iron, [1.6, 0.6, 0], [0, 0, 0.5]);
        group.add(brace);

        for (let i = 0; i < 5; i++) {
            const crate = this.mesh(
                new THREE.BoxGeometry(0.9, 0.8, 0.9),
                wood,
                [-1.6 + (i % 3) * 1.5, 1.65 + Math.floor(i / 3) * 0.8, (i % 2 === 0 ? -0.5 : 0.5)],
                [0, this.random() * 0.4, 0]
            );
            group.add(crate);

            const lid = this.mesh(new THREE.BoxGeometry(0.75, 0.1, 0.75), this.lit(0xffd166, 0.5), [-1.6 + (i % 3) * 1.5, 2.08 + Math.floor(i / 3) * 0.8, (i % 2 === 0 ? -0.5 : 0.5)]);
            lid.castShadow = false;
            group.add(lid);
        }

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(CART_CENTER.x, CART_CENTER.z, 4.6, 2.8, 0.9, 0, 1.6);
    }

    private buildFountain() {
        const stone = this.matte(0xc2b08a, 0.92, 0.04);
        const stoneDark = this.matte(0x9a8a68, 0.94, 0.03);

        const group = new THREE.Group();
        group.position.copy(FOUNTAIN_CENTER);

        const basin = this.mesh(new THREE.CylinderGeometry(7, 7.5, 1.1, 32), stone, [0, 0.55, 0]);
        group.add(basin);

        const rim = this.mesh(new THREE.TorusGeometry(7, 0.42, 10, 36), stoneDark, [0, 1.1, 0], [-Math.PI / 2, 0, 0]);
        group.add(rim);

        const waterMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x4fc8e8,
            roughness: 0.1,
            metalness: 0.2,
            transparent: true,
            opacity: 0.82,
        }));

        const water = this.mesh(new THREE.CircleGeometry(6.8, 36), waterMaterial, [0, 1.02, 0], [-Math.PI / 2, 0, 0]);
        water.castShadow = false;
        group.add(water);
        this.water = water;

        const column = this.mesh(new THREE.CylinderGeometry(1.1, 1.6, 3.2, 16), stone, [0, 2.6, 0]);
        group.add(column);

        const bowl = this.mesh(new THREE.CylinderGeometry(2.8, 1.2, 0.7, 20), stoneDark, [0, 4.4, 0]);
        group.add(bowl);

        const statue = new THREE.Group();
        statue.position.set(0, 6.6, 0);

        const coin = this.mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.5, 32), this.metal(0xe0b552, 0.3, 0.94), [0, 0, 0], [Math.PI / 2, 0, 0]);
        statue.add(coin);

        const coinRim = this.mesh(new THREE.TorusGeometry(2.4, 0.2, 8, 32), this.metal(0xb8882f, 0.4, 0.85), [0, 0, 0]);
        statue.add(coinRim);

        const symbol = this.mesh(new THREE.BoxGeometry(0.6, 2.4, 0.3), this.metal(0xb8882f, 0.4, 0.85), [0, 0, 0.3]);
        statue.add(symbol);

        const symbolArc = this.mesh(new THREE.TorusGeometry(0.75, 0.22, 8, 16, Math.PI), this.metal(0xb8882f, 0.4, 0.85), [0, 0.5, 0.3], [0, 0, -Math.PI / 2]);
        statue.add(symbolArc);

        const symbolArc2 = this.mesh(new THREE.TorusGeometry(0.75, 0.22, 8, 16, Math.PI), this.metal(0xb8882f, 0.4, 0.85), [0, -0.5, 0.3], [0, 0, Math.PI / 2]);
        statue.add(symbolArc2);

        group.add(statue);
        this.coinStatue = statue;

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const jet = this.mesh(
                new THREE.CylinderGeometry(0.06, 0.14, 2.4, 6),
                this.glow(0x9fe8ff, 0.45),
                [Math.cos(angle) * 2.2, 3.4, Math.sin(angle) * 2.2],
                [Math.cos(angle) * 0.5, 0, -Math.sin(angle) * 0.5]
            );
            jet.castShadow = false;
            group.add(jet);
        }

        this.scene.add(group);
        this.collisionGrid.insertCylinder(new THREE.Vector3(FOUNTAIN_CENTER.x, 0.8, FOUNTAIN_CENTER.z), 7.5, 1.6);
    }

    private buildBunting() {
        const poleMaterial = this.matte(0x6b4a28, 0.95);

        for (let row = 0; row < STALL_ROWS - 1; row++) {
            const z = STALL_FIRST_Z + row * STALL_STEP + 4;
            const group = new THREE.Group();
            group.position.set(0, 0, z);

            for (const side of [-1, 1]) {
                const pole = this.mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.4, 8), poleMaterial, [side * 14, 3.7, 0]);
                group.add(pole);
            }

            const flagCount = 13;
            for (let f = 0; f < flagCount; f++) {
                const t = f / (flagCount - 1);
                const x = -14 + t * 28;
                const sag = Math.sin(t * Math.PI) * 1.4;

                const flag = this.mesh(
                    new THREE.ConeGeometry(0.24, 0.6, 3),
                    this.matte(AWNING_COLORS[f % AWNING_COLORS.length], 0.88),
                    [x, 7 - sag - 0.45, 0],
                    [Math.PI, 0, 0]
                );
                flag.castShadow = false;
                group.add(flag);
            }

            if (row % 2 === 0) {
                for (let l = 0; l < 5; l++) {
                    const t = (l + 0.5) / 5;
                    const x = -13 + t * 26;
                    const sag = Math.sin(t * Math.PI) * 1.4;

                    const material = this.glow(0xffc46a, 0.85);
                    this.lanternMaterials.push(material);

                    const lantern = this.mesh(new THREE.SphereGeometry(0.22, 12, 8), material, [x, 6.4 - sag, 0]);
                    lantern.castShadow = false;
                    group.add(lantern);
                    this.lanterns.push(lantern);
                }
            }

            this.scene.add(group);
            this.bunting.push(group);
        }
    }

    private buildBirds() {
        const bodyMaterial = this.matte(0x5a5148, 0.9);
        const wingGeometry = this.bin.geometry(new THREE.CircleGeometry(0.34, 6, 0, Math.PI));

        for (let i = 0; i < 9; i++) {
            const group = new THREE.Group();

            const body = this.mesh(new THREE.SphereGeometry(0.16, 8, 6), bodyMaterial, [0, 0, 0]);
            body.scale.set(1, 0.8, 1.7);
            body.castShadow = false;
            group.add(body);

            const wings: THREE.Mesh[] = [];
            for (const side of [-1, 1]) {
                const wing = new THREE.Mesh(wingGeometry, bodyMaterial);
                wing.rotation.x = -Math.PI / 2;
                wing.rotation.z = side * 0.3;
                wing.position.x = side * 0.16;
                wing.castShadow = false;
                group.add(wing);
                wings.push(wing);
            }

            this.scene.add(group);
            this.birds.push({
                group,
                wings,
                radius: 14 + this.random() * 26,
                height: 12 + this.random() * 12,
                speed: 0.24 + this.random() * 0.24,
                phase: this.random() * 9,
            });
        }
    }

    private buildDust() {
        const positions = new Float32Array(DUST_COUNT * 3);

        for (let i = 0; i < DUST_COUNT; i++) {
            positions[i * 3] = (this.random() - 0.5) * 90;
            positions[i * 3 + 1] = this.random() * 12;
            positions[i * 3 + 2] = (this.random() - 0.5) * 90;
        }

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = this.bin.material(new THREE.PointsMaterial({
            color: 0xfff0cc,
            size: 0.13,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            toneMapped: false,
            fog: false,
        }));

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        this.scene.add(points);
        this.dust = points;
    }

    private buildCrowd() {
        const specs: CrowdSpec[] = [];

        for (let row = 0; row < STALL_ROWS; row++) {
            for (const side of [-1, 1]) {
                const x = side * STALL_X;
                const z = STALL_FIRST_Z + row * STALL_STEP + (side > 0 ? 3.5 : 0);
                const inward = side > 0 ? -Math.PI / 2 : Math.PI / 2;

                const behind = new THREE.Vector3(x + side * 1.9, 0, z);
                specs.push({
                    position: behind,
                    set: "trader",
                    facing: inward,
                    pose: row % 3 === 0 ? "haggle" : row % 3 === 1 ? "work" : "carry",
                    held: row % 3 === 2 ? "basket" : undefined,
                    accent: AWNING_COLORS[row % AWNING_COLORS.length],
                    phase: this.random() * 9,
                });

                if (this.random() < 0.7) {
                    specs.push({
                        position: new THREE.Vector3(x - side * 2.6, 0, z + (this.random() - 0.5) * 2),
                        set: "crowd",
                        facing: inward + Math.PI,
                        pose: this.random() < 0.5 ? "haggle" : "gawk",
                        held: this.random() < 0.4 ? "bag" : undefined,
                        phase: this.random() * 9,
                    });
                }
            }
        }

        specs.push({
            position: new THREE.Vector3(-6.6, 0.95, 12),
            set: "trader",
            variantIndex: 0,
            facing: 0.4,
            pose: "preach",
            held: "sign",
            heldHand: "left",
            accent: 0xf2c53d,
            phase: 2,
            solid: false,
        });

        const crate = this.mesh(new THREE.BoxGeometry(1.6, 0.95, 1.6), this.matte(0x6b4a28, 0.95), [-6.6, 0.47, 12]);
        this.scene.add(crate);
        this.collisionGrid.insertOrientedBox(-4.5, 12, 1.6, 1.6, 0, 0, 0.95);

        for (let i = 0; i < 5; i++) {
            const angle = -0.6 + i * 0.34;
            specs.push({
                position: new THREE.Vector3(-4.5 + Math.sin(angle) * 4.5, 0, 12 - Math.cos(angle) * 4.5),
                set: "crowd",
                lookAt: new THREE.Vector3(-4.5, 1.5, 12),
                pose: i % 2 === 0 ? "gawk" : "cheer",
                phase: this.random() * 9,
            });
        }

        for (let i = 0; i < 3; i++) {
            const angle = 4.0 + i * 0.7;
            specs.push({
                position: new THREE.Vector3(
                    FOUNTAIN_CENTER.x + Math.cos(angle) * 10.5,
                    0,
                    FOUNTAIN_CENTER.z + Math.sin(angle) * 10.5
                ),
                set: "crowd",
                lookAt: FOUNTAIN_CENTER,
                pose: i === 1 ? "dance" : "toast",
                held: i === 1 ? undefined : "cocktail",
                accent: 0xff8f5a,
                phase: this.random() * 9,
            });
        }

        const walkers: Array<[number, number, number, number, number]> = [
            [-6.5, -28, -6.5, 12, 1],
            [6.5, 12, 6.5, -28, 1],
            [-1.5, -20, -1.5, 10, 1],
            [1.5, 10, 1.5, -26, 1],
            [-16, 36, 16, 36, 1],
            [18, -33.5, -2, -33.5, 1],
            [-7.5, 0, 7.5, 0, 0.72],
            [9, -8, -9, -10, 0.72],
        ];

        for (const [x1, z1, x2, z2, scale] of walkers) {
            specs.push({
                position: new THREE.Vector3(x1, 0, z1),
                set: scale < 1 ? "crowd" : "trader",
                scale,
                walk: {
                    path: [new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x2, 0, z2)],
                    mode: "pingpong",
                    pause: 1.5 + this.random() * 3,
                    speed: scale < 1 ? 2.4 : 1.05 + this.random() * 0.4,
                    run: scale < 1,
                },
                held: this.random() < 0.5 ? "basket" : this.random() < 0.5 ? "bag" : undefined,
                phase: this.random() * 9,
            });
        }

        specs.push({
            position: new THREE.Vector3(RUG_STALL.x + 2.6, 0.4, RUG_STALL.z + 1),
            set: "trader",
            variantIndex: 0,
            facing: Math.PI / 2,
            pose: "haggle",
            phase: 1.4,
            solid: false,
        });

        for (let i = 0; i < 3; i++) {
            specs.push({
                position: new THREE.Vector3(RUG_STALL.x + 5.4, 0, RUG_STALL.z - 2 + i * 2),
                set: "crowd",
                lookAt: new THREE.Vector3(RUG_STALL.x, 2, RUG_STALL.z),
                pose: i === 0 ? "haggle" : "gawk",
                phase: this.random() * 9,
            });
        }

        specs.push({
            position: new THREE.Vector3(CHANGER_CENTER.x - 1.4, 0, CHANGER_CENTER.z),
            set: "trader",
            variantIndex: 1,
            facing: -Math.PI / 2,
            pose: "work",
            phase: 2.8,
            solid: false,
        });

        for (let i = 0; i < 3; i++) {
            specs.push({
                position: new THREE.Vector3(CHANGER_CENTER.x - 4.2 - i * 1.5, 0, CHANGER_CENTER.z - 1 + (i % 2) * 2),
                set: "crowd",
                lookAt: new THREE.Vector3(CHANGER_CENTER.x, 1.6, CHANGER_CENTER.z),
                pose: i === 0 ? "haggle" : "carry",
                held: i === 0 ? "cash" : "bag",
                phase: this.random() * 9,
            });
        }

        specs.push({
            position: new THREE.Vector3(AUCTION_CENTER.x + Math.sin(0.5) * 1.1, 1.1, AUCTION_CENTER.z + Math.cos(0.5) * 1.1),
            set: "trader",
            variantIndex: 2,
            facing: 0.5,
            pose: "preach",
            accent: 0xffd166,
            phase: 0.6,
            solid: false,
        });

        for (let i = 0; i < 8; i++) {
            const angle = 0.5 + (i - 3.5) * 0.3;
            const radius = 5.4 + (i % 2) * 1.8;
            specs.push({
                position: new THREE.Vector3(
                    AUCTION_CENTER.x + Math.sin(angle) * radius,
                    0,
                    AUCTION_CENTER.z + Math.cos(angle) * radius
                ),
                set: "crowd",
                lookAt: new THREE.Vector3(AUCTION_CENTER.x, 2, AUCTION_CENTER.z),
                pose: i % 3 === 0 ? "cheer" : "gawk",
                held: i % 4 === 0 ? "cash" : undefined,
                phase: this.random() * 9,
            });
        }

        specs.push({
            position: new THREE.Vector3(ORACLE_CENTER.x, 0, ORACLE_CENTER.z + 2.2),
            set: "trader",
            variantIndex: 0,
            facing: 0,
            pose: "preach",
            accent: 0xa855f7,
            phase: 3.4,
            solid: false,
        });

        for (let i = 0; i < 3; i++) {
            specs.push({
                position: new THREE.Vector3(ORACLE_CENTER.x - 2 + i * 2, 0, ORACLE_CENTER.z + 6.4),
                set: "crowd",
                lookAt: new THREE.Vector3(ORACLE_CENTER.x, 1.6, ORACLE_CENTER.z + 3),
                pose: "gawk",
                phase: this.random() * 9,
            });
        }

        specs.push({
            position: new THREE.Vector3(CART_CENTER.x - 3, 0, CART_CENTER.z + 1.4),
            set: "trader",
            variantIndex: 1,
            lookAt: new THREE.Vector3(CART_CENTER.x, 1.4, CART_CENTER.z),
            pose: "work",
            phase: 5.2,
        });

        const chase: Array<[number, number, number, number, number, string]> = [
            [-2.6, -30, -2.6, 8, 2.6, "bag"],
            [-3.2, -33, -3.2, 5, 2.4, "wrench"],
        ];

        for (const [x1, z1, x2, z2, speed, held] of chase) {
            specs.push({
                position: new THREE.Vector3(x1, 0, z1),
                set: "trader",
                walk: {
                    path: [new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x2, 0, z2)],
                    mode: "pingpong",
                    pause: 1.2,
                    speed,
                    run: true,
                },
                held: held as never,
                phase: this.random() * 9,
            });
        }

        this.crowd.addMany(specs);
    }

    protected tick(delta: number): void {
        for (let i = 0; i < this.rugs.length; i++) {
            const attribute = (this.rugs[i].geometry as THREE.PlaneGeometry).getAttribute("position") as THREE.BufferAttribute;
            const array = attribute.array as Float32Array;
            for (let v = 0; v < array.length; v += 3) {
                array[v + 2] = Math.sin(this.elapsed * 1.3 + array[v + 1] * 1.4 + i) * 0.09 * (2.2 - array[v + 1]);
            }
            attribute.needsUpdate = true;
        }

        if (this.scale) {
            this.scale.rotation.z = Math.sin(this.elapsed * 0.9) * 0.1;
        }

        if (this.gavel) {
            this.gavel.position.y = 2.7 + Math.abs(Math.sin(this.elapsed * 1.6)) * 0.36;
            this.gavel.rotation.z = -Math.abs(Math.sin(this.elapsed * 1.6)) * 0.5;
        }

        if (this.auctionPrize) {
            this.auctionPrize.rotation.y += delta * 1.1;
        }

        if (this.oracleOrb) {
            const material = this.oracleOrb.material as THREE.MeshStandardMaterial;
            material.emissiveIntensity = 0.9 + Math.sin(this.elapsed * 2.1) * 0.5;
        }

        for (let i = 0; i < this.braziers.length; i++) {
            this.braziers[i].opacity = 0.62 + Math.sin(this.elapsed * 7 + i * 1.7) * 0.22;
        }

        for (let i = 0; i < this.awnings.length; i++) {
            this.awnings[i].rotation.z = Math.sin(this.elapsed * 0.9 + i * 0.7) * 0.022;
        }

        for (let i = 0; i < this.bunting.length; i++) {
            this.bunting[i].rotation.z = Math.sin(this.elapsed * 0.6 + i) * 0.012;
        }

        for (let i = 0; i < this.lanterns.length; i++) {
            this.lanterns[i].position.y += Math.sin(this.elapsed * 1.4 + i) * delta * 0.05;
            this.lanternMaterials[i].opacity = 0.7 + Math.sin(this.elapsed * 2.2 + i * 1.4) * 0.2;
        }

        if (this.water) {
            (this.water.material as THREE.MeshStandardMaterial).opacity = 0.78 + Math.sin(this.elapsed * 1.6) * 0.06;
            this.water.position.y = 1.02 + Math.sin(this.elapsed * 1.1) * 0.015;
        }

        if (this.coinStatue) {
            this.coinStatue.rotation.y += delta * 0.32;
        }

        for (const bird of this.birds) {
            const t = this.elapsed * bird.speed + bird.phase;
            bird.group.position.set(
                Math.cos(t) * bird.radius,
                bird.height + Math.sin(t * 2.3) * 1.6,
                FOUNTAIN_CENTER.z * 0.4 + Math.sin(t) * bird.radius
            );
            bird.group.rotation.y = -t + Math.PI / 2;

            const flap = Math.sin(this.elapsed * 9 + bird.phase) * 0.7;
            bird.wings[0].rotation.z = 0.3 + flap;
            bird.wings[1].rotation.z = -0.3 - flap;
        }

        if (this.dust) {
            const attribute = this.dust.geometry.getAttribute("position") as THREE.BufferAttribute;
            const array = attribute.array as Float32Array;
            for (let i = 0; i < array.length; i += 3) {
                array[i] += delta * 0.45;
                array[i + 1] += Math.sin(this.elapsed * 0.5 + i) * delta * 0.12;
                if (array[i] > 45) array[i] = -45;
            }
            attribute.needsUpdate = true;
        }
    }
}
