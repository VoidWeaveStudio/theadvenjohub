// src/features/game/world/locations/showcase/rooms/NewsRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import type { ShowcaseActor } from "../actors/ShowcaseActor";
import { clearSceneSubtitle, setSceneSubtitle } from "../scene/subtitles";
import { prefersMobileProfile } from "@/features/game/core/graphicsSettings";
// The volumetric shaft lives with the church because that is where it was written, but
// the shader is set-agnostic — a studio lamp is the same problem as a window beam, so it
// is reused rather than copied.
import { ChurchLight, type ShaftSpec } from "./church/ChurchLight";
import {
    bookTexture,
    chartTexture,
    controlRoomTexture,
    lowerThirdTexture,
    plateTexture,
    prompterTexture,
    tickerTexture,
} from "./news/newsTextures";

const ANCHOR_NAME = "Anchor";
const ROOM_RADIUS = 40;
const BACK_Z = -17.6;
const FRONT_Z = 17.8;
const DESK_Z = -4;
const CEILING_Y = 12.4;
const ANCHOR_SEAT = new THREE.Vector3(0, 0, -5.8);
const TICKER_SPEED = 0.055;

interface ScrollingMap {
    map: THREE.Texture;
    axis: "x" | "y";
    speed: number;
}

export class NewsRoom extends ShowcaseRoom {
    private anchor: ShowcaseActor | null = null;
    private light: ChurchLight | null = null;
    private environment: THREE.Texture | null = null;

    private readonly scrolling: ScrollingMap[] = [];
    private readonly screenLights: THREE.PointLight[] = [];
    private readonly cameraProbe = new THREE.Vector3(0, 4, 0);

    private liveLamp: THREE.MeshStandardMaterial | null = null;
    private tally: THREE.MeshBasicMaterial | null = null;
    private lowerThird: THREE.Mesh | null = null;
    private lowerThirdMaterial: THREE.MeshBasicMaterial | null = null;
    private speechRemaining = 0;

    constructor(info: ShowcaseInfo = SHOWCASE_INFO_BY_ID.get("show-news") as ShowcaseInfo) {
        super(info, 0x4e2d17, ROOM_RADIUS);
        this.exitPosition.set(0, 0, 16);
        this.exitFacing = 0;
        this.spawnPosition.set(0, 0, 11);
        this.spawnFacing = Math.PI;
    }

    protected buildAtmosphere(): void {
        // A studio is a closed box: no sky, and the mood is all lamps. The haze is only
        // dense enough to give the lamp shafts something to sit in.
        this.scene.background = new THREE.Color(0x05070c);
        this.scene.fog = new THREE.FogExp2(0x070a11, 0.0125);

        this.scene.add(new THREE.AmbientLight(0x8fa4c8, 0.26));
        this.scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x14171f, 0.3));

        const key = new THREE.DirectionalLight(0xfff4e2, 1.35);
        key.position.set(5, 12, 7);
        key.target.position.set(0, 1.4, DESK_Z);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.left = -24;
        key.shadow.camera.right = 24;
        key.shadow.camera.top = 24;
        key.shadow.camera.bottom = -24;
        key.shadow.bias = -0.0004;
        key.shadow.normalBias = 0.04;
        key.shadow.camera.updateProjectionMatrix();
        this.scene.add(key);
        this.scene.add(key.target);

        const fill = new THREE.DirectionalLight(0xbcd4ff, 0.34);
        fill.position.set(-9, 7, 6);
        this.scene.add(fill);

        const rim = new THREE.PointLight(0xff4fd8, 7, 24, 2);
        rim.position.set(-13, 6, -9);
        this.scene.add(rim);
    }

    protected decorate(rm: ResourceManager): void {
        this.buildShell();
        this.buildScreens();
        this.buildControlRoom();
        this.buildDesk();
        this.buildLightRig();
        this.buildCameras();
        this.buildClutter();
        this.buildCast(rm);

        // Captured before the additive shafts exist, so the reflections pick up the
        // screens and the lamps rather than the glow passes drawn on top of them.
        this.captureEnvironment();
        this.buildShafts();
    }

    private captureEnvironment(): void {
        if (!this.renderer) return;

        const generator = new THREE.PMREMGenerator(this.renderer);
        const target = generator.fromScene(this.scene, 0, 0.5, 120, {
            size: 128,
            position: new THREE.Vector3(0, 4, 0),
        });

        this.environment = target.texture;
        this.scene.environment = target.texture;
        this.scene.environmentIntensity = 0.55;
        generator.dispose();
    }

    private buildShell(): void {
        // Glossy and dark: a studio floor is polished, and with the environment map
        // captured above it carries the screens as reflections instead of needing a
        // second render pass for a mirror.
        const floor = this.mesh(
            new THREE.PlaneGeometry(44, 44),
            this.textured(this.tex.grid([5, 5], 0x0e111a, 0x1b2130), { roughness: 0.16, metalness: 0.62 }),
            [0, 0, 0],
            [-Math.PI / 2, 0, 0]
        );
        floor.castShadow = false;
        this.scene.add(floor);

        const wall = this.textured(this.tex.panel([3, 2], 0x171b24, 0x0e1119), { roughness: 0.74, metalness: 0.12 });

        const back = this.mesh(new THREE.BoxGeometry(44, 16, 0.8), wall, [0, 8, BACK_Z - 0.4]);
        this.scene.add(back);
        this.collisionGrid.insertOrientedBox(0, BACK_Z - 0.4, 44, 1.2, 0, 0, 16);

        for (const side of [-1, 1]) {
            const flank = this.mesh(new THREE.BoxGeometry(0.8, 16, 36), wall, [side * 21.6, 8, 0]);
            this.scene.add(flank);
            this.collisionGrid.insertOrientedBox(side * 21.6, 0, 1.2, 36, 0, 0, 16);
        }

        // The exit gate sits in this wall, so the studio reads as a closed box instead
        // of a floor that stops with the void behind it.
        const front = this.mesh(new THREE.BoxGeometry(44, 16, 0.8), wall, [0, 8, FRONT_Z]);
        this.scene.add(front);
        this.collisionGrid.insertOrientedBox(0, FRONT_Z, 44, 1.2, 0, 0, 16);

        const ceiling = this.mesh(new THREE.BoxGeometry(44, 0.6, 38), this.matte(0x090c12, 0.9, 0.06), [0, CEILING_Y, 0]);
        ceiling.castShadow = false;
        this.scene.add(ceiling);

        // A skirt of dark acoustic panelling breaks the flat wall at eye height.
        const acoustic = this.matte(0x11141b, 0.96, 0.02);
        for (const z of [-12, -4, 4, 12]) {
            for (const side of [-1, 1]) {
                const pad = this.mesh(new THREE.BoxGeometry(0.3, 4.4, 6.4), acoustic, [side * 21, 5.2, z]);
                pad.castShadow = false;
                this.scene.add(pad);
            }
        }
    }

    private scroll(map: THREE.Texture, axis: "x" | "y", speed: number): THREE.Texture {
        this.scrolling.push({ map, axis, speed });
        return map;
    }

    private buildScreens(): void {
        const frame = this.metal(0x22262f, 0.4, 0.72);

        const mainChart = this.scroll(chartTexture(this.bin, this.random, true), "x", 0.028);
        mainChart.repeat.set(1.6, 1);

        const mainShell = this.mesh(new THREE.BoxGeometry(15, 8.2, 0.6), frame, [0, 5.8, BACK_Z + 0.4]);
        this.scene.add(mainShell);

        const main = this.mesh(
            new THREE.PlaneGeometry(14.2, 7.4),
            this.textured(mainChart, { emissive: 0xffffff, emissiveIntensity: 1.05, roughness: 0.42 }),
            [0, 5.8, BACK_Z + 0.75]
        );
        main.castShadow = false;
        this.scene.add(main);

        const glow = new THREE.PointLight(this.info.accent, 26, 40, 2);
        glow.position.set(0, 5.6, BACK_Z + 3.4);
        this.scene.add(glow);
        this.screenLights.push(glow);

        for (const side of [-1, 1]) {
            const book = this.scroll(bookTexture(this.bin, this.random), "y", side * 0.05);
            book.repeat.set(1, 1.4);

            const shell = this.mesh(new THREE.BoxGeometry(4.4, 6.2, 0.5), frame, [side * 10.2, 6.4, BACK_Z + 0.4]);
            this.scene.add(shell);

            const panel = this.mesh(
                new THREE.PlaneGeometry(3.8, 5.6),
                this.textured(book, { emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.45 }),
                [side * 10.2, 6.4, BACK_Z + 0.72]
            );
            panel.castShadow = false;
            this.scene.add(panel);

            const spill = new THREE.PointLight(side < 0 ? 0x2fbf6a : 0xd94f4f, 9, 22, 2);
            spill.position.set(side * 10.2, 6.2, BACK_Z + 2.6);
            this.scene.add(spill);
            this.screenLights.push(spill);
        }

        const ticker = this.scroll(tickerTexture(this.bin, this.random), "x", TICKER_SPEED);
        ticker.repeat.set(3, 1);

        const strip = this.mesh(
            new THREE.PlaneGeometry(30, 1.6),
            this.textured(ticker, { emissive: 0xffffff, emissiveIntensity: 1.15, roughness: 0.5 }),
            [0, 1.5, BACK_Z + 0.75]
        );
        strip.castShadow = false;
        this.scene.add(strip);

        const sign = this.board(plateTexture(this.bin, "TANJO NEWS", 0x0a0d14, this.info.accent), 10, 2.5, [0, 10.8, BACK_Z + 0.75], 0, {
            emissive: 0xffffff,
            emissiveIntensity: 0.85,
            oneSided: true,
        });
        this.scene.add(sign);
    }

    private buildControlRoom(): void {
        const x = -21;
        const glass = this.bin.material(new THREE.MeshPhysicalMaterial({
            color: 0x9fc4dd,
            roughness: 0.06,
            metalness: 0,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide,
        }));

        const interior = this.mesh(
            new THREE.PlaneGeometry(13, 5.2),
            this.textured(controlRoomTexture(this.bin, this.random), { emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.6 }),
            [x - 1.4, 4.8, -2],
            [0, Math.PI / 2, 0]
        );
        interior.castShadow = false;
        this.scene.add(interior);

        const pane = this.mesh(new THREE.PlaneGeometry(13, 5.2), glass, [x + 0.5, 4.8, -2], [0, Math.PI / 2, 0]);
        pane.castShadow = false;
        this.scene.add(pane);

        const trim = this.metal(0x2b3038, 0.42, 0.7);
        for (const y of [2.1, 7.5]) {
            const rail = this.mesh(new THREE.BoxGeometry(0.5, 0.36, 13.4), trim, [x + 0.4, y, -2]);
            this.scene.add(rail);
        }
        for (const z of [-8.6, -2, 4.6]) {
            const mullion = this.mesh(new THREE.BoxGeometry(0.42, 5.4, 0.3), trim, [x + 0.4, 4.8, z]);
            this.scene.add(mullion);
        }

        const spill = new THREE.PointLight(0xffc27a, 12, 26, 2);
        spill.position.set(x + 3.4, 5, -2);
        this.scene.add(spill);
    }

    private buildDesk(): void {
        const shell = this.metal(0x1b2130, 0.3, 0.68);

        const body = this.mesh(new THREE.BoxGeometry(7.4, 1.15, 2.3), shell, [0, 0.58, DESK_Z]);
        this.scene.add(body);
        this.collisionGrid.insertOrientedBox(0, DESK_Z, 7.4, 2.3, 0, 0, 1.15);

        // A curved return on each end, so the desk reads as built for broadcast rather
        // than as a box someone sat behind.
        for (const side of [-1, 1]) {
            const wing = this.mesh(new THREE.CylinderGeometry(1.15, 1.15, 1.15, 18, 1, false, 0, Math.PI), shell, [side * 3.7, 0.58, DESK_Z], [0, side < 0 ? 0 : Math.PI, 0]);
            this.scene.add(wing);
            this.collisionGrid.insertCylinder(new THREE.Vector3(side * 3.7, 0.58, DESK_Z), 1.15, 1.15);
        }

        const top = this.mesh(
            new THREE.BoxGeometry(8.1, 0.14, 2.7),
            this.textured(this.tex.marble(1, 0xdfe5ee, 0x9aa4b4), { roughness: 0.12, metalness: 0.42 }),
            [0, 1.22, DESK_Z]
        );
        this.scene.add(top);

        const front = this.board(plateTexture(this.bin, "$TANJO", 0x10141d, this.info.accent), 4.6, 1.15, [0, 0.62, DESK_Z + 1.19], 0, {
            emissive: 0xffffff,
            emissiveIntensity: 0.6,
            oneSided: true,
        });
        this.scene.add(front);

        this.lowerThirdMaterial = this.bin.material(new THREE.MeshBasicMaterial({
            map: lowerThirdTexture(this.bin, "SOLA VANCE", "TANJO NEWS · CRYPTO DESK", this.info.accent),
            transparent: true,
            depthWrite: false,
            toneMapped: false,
            opacity: 0,
        }));

        this.lowerThird = new THREE.Mesh(this.bin.geometry(new THREE.PlaneGeometry(6.4, 1.6)), this.lowerThirdMaterial);
        this.lowerThird.position.set(0, 1.05, DESK_Z + 2.35);
        this.lowerThird.renderOrder = 7;
        this.lowerThird.visible = false;
        this.scene.add(this.lowerThird);

        const mic = this.mesh(new THREE.CapsuleGeometry(0.07, 0.34, 4, 8), this.matte(0x0e1116, 0.6, 0.3), [0.95, 1.63, DESK_Z + 0.32], [0.38, 0, 0]);
        this.scene.add(mic);

        const stem = this.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), this.metal(0x3a4150, 0.4, 0.8), [0.95, 1.4, DESK_Z + 0.44]);
        this.scene.add(stem);

        const mug = this.mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.22, 12), this.matte(0xe8edf5, 0.66, 0.05), [-1.5, 1.4, DESK_Z + 0.34]);
        this.scene.add(mug);

        for (const offset of [-0.35, -0.1, 0.16]) {
            const sheet = this.mesh(new THREE.BoxGeometry(0.62, 0.012, 0.86), this.matte(0xf2f4f8, 0.9, 0.02), [-0.5 + offset * 0.4, 1.3, DESK_Z + 0.2], [0, offset, 0]);
            sheet.castShadow = false;
            this.scene.add(sheet);
        }

        const chair = new THREE.Group();
        chair.position.set(0, 0, ANCHOR_SEAT.z - 0.55);
        const chairShell = this.matte(0x14171e, 0.66, 0.16);
        chair.add(this.mesh(new THREE.BoxGeometry(1.1, 0.14, 1.05), chairShell, [0, 0.62, 0]));
        chair.add(this.mesh(new THREE.BoxGeometry(1.1, 1.25, 0.16), chairShell, [0, 1.3, -0.48]));
        chair.add(this.mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), this.metal(0x2e3440, 0.4, 0.8), [0, 0.32, 0]));
        chair.add(this.mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.07, 14), this.metal(0x2e3440, 0.4, 0.8), [0, 0.05, 0]));
        this.scene.add(chair);

        this.liveLamp = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xff3b3b,
            emissive: 0xff3b3b,
            emissiveIntensity: 0.28,
            roughness: 0.4,
            metalness: 0.1,
        }));

        const onAir = this.mesh(new THREE.BoxGeometry(2.6, 0.72, 0.22), this.liveLamp, [0, 3.4, FRONT_Z - 0.6]);
        onAir.castShadow = false;
        this.scene.add(onAir);
    }

    private buildLightRig(): void {
        const bar = this.metal(0x20242c, 0.48, 0.76);
        const lampShell = this.matte(0x101319, 0.7, 0.2);

        for (const z of [-11, -2.5, 6]) {
            const truss = this.mesh(new THREE.BoxGeometry(32, 0.26, 0.26), bar, [0, 11.7, z]);
            truss.castShadow = false;
            this.scene.add(truss);

            for (const brace of [-11, -5.5, 0, 5.5, 11]) {
                const drop = this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), bar, [brace, CEILING_Y - 0.4, z]);
                drop.castShadow = false;
                this.scene.add(drop);
            }

            for (const x of [-9, -3, 3, 9]) {
                const housing = this.mesh(new THREE.BoxGeometry(0.78, 0.9, 0.78), lampShell, [x, 11.1, z], [0.4, 0, 0]);
                housing.castShadow = false;
                this.scene.add(housing);

                // Barn doors: four flaps make the lamp read as a studio fresnel instead
                // of a floating cube.
                for (const flap of [[0.52, 0, 0.5], [-0.52, 0, -0.5], [0, 0.52, 0.5], [0, -0.52, -0.5]] as Array<[number, number, number]>) {
                    const door = this.mesh(new THREE.BoxGeometry(flap[0] === 0 ? 0.8 : 0.06, flap[1] === 0 ? 0.06 : 0.8, 0.5), lampShell, [x + flap[0], 10.72 + flap[1], z + 0.3], [0.4, 0, 0]);
                    door.castShadow = false;
                    this.scene.add(door);
                }

                const lens = this.mesh(new THREE.CircleGeometry(0.3, 14), this.glow(0xfff2d4, 0.62), [x, 10.66, z + 0.26], [-Math.PI / 2 + 0.4, 0, 0]);
                lens.castShadow = false;
                this.scene.add(lens);
            }
        }

        const boom = this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 7, 8), bar, [1.6, 8.6, DESK_Z + 1.4], [0, 0, Math.PI / 2 - 0.22]);
        boom.castShadow = false;
        this.scene.add(boom);

        const boomMic = this.mesh(new THREE.CapsuleGeometry(0.12, 0.7, 4, 10), this.matte(0x0b0e13, 0.82, 0.08), [-1.7, 7.8, DESK_Z + 1.4], [0.5, 0, 0.3]);
        this.scene.add(boomMic);
    }

    private buildCameras(): void {
        this.tally = this.glow(0xff3b3b, 0.9, false);

        this.buildCameraRig(-6.6, 4.4, -0.42, true);
        this.buildCameraRig(7.4, 6.2, 0.5, false);
    }

    private buildCameraRig(x: number, z: number, rotation: number, hero: boolean): void {
        const shell = this.matte(0x0f1218, 0.6, 0.28);
        const metal = this.metal(0x323945, 0.42, 0.78);

        const rig = new THREE.Group();
        rig.position.set(x, 0, z);
        rig.rotation.y = rotation;

        for (let leg = 0; leg < 3; leg++) {
            const angle = (leg / 3) * Math.PI * 2;
            const strut = this.mesh(
                new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6),
                metal,
                [Math.cos(angle) * 0.44, 0.88, Math.sin(angle) * 0.44],
                [Math.sin(angle) * 0.24, 0, -Math.cos(angle) * 0.24]
            );
            rig.add(strut);

            const sandbag = this.mesh(new THREE.SphereGeometry(0.22, 8, 6), this.matte(0x2a2b31, 0.95, 0.02), [Math.cos(angle) * 0.78, 0.14, Math.sin(angle) * 0.78]);
            sandbag.scale.y = 0.55;
            rig.add(sandbag);
        }

        rig.add(this.mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.3, 12), metal, [0, 1.76, 0]));

        const head = this.mesh(new THREE.BoxGeometry(0.86, 0.66, 1.4), shell, [0, 2.06, 0]);
        rig.add(head);

        rig.add(this.mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.66, 12), metal, [0, 2.08, 0.92], [Math.PI / 2, 0, 0]));
        rig.add(this.mesh(new THREE.BoxGeometry(0.44, 0.3, 0.36), shell, [-0.62, 2.28, -0.2]));
        rig.add(this.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), metal, [0.3, 1.86, -0.7], [0.5, 0, 0]));

        if (hero && this.tally) {
            const lamp = new THREE.Mesh(this.bin.geometry(new THREE.SphereGeometry(0.08, 8, 6)), this.tally);
            lamp.position.set(0, 2.44, 0.55);
            rig.add(lamp);
        }

        this.scene.add(rig);
        this.collisionGrid.insertCylinder(new THREE.Vector3(x, 1, z), 0.85, 2.3);
    }

    private buildClutter(): void {
        const cable = this.matte(0x0c0e13, 0.92, 0.04);

        // Cable runs taped along the floor between the rigs and the wall.
        const runs: Array<[number, number, number, number]> = [
            [-6.6, 4.4, -14, -12],
            [7.4, 6.2, 16, -12],
            [0, 9, -18, -12],
        ];

        for (const [fromX, fromZ, toX, toZ] of runs) {
            const dx = toX - fromX;
            const dz = toZ - fromZ;
            const length = Math.hypot(dx, dz);
            const run = this.mesh(new THREE.CylinderGeometry(0.06, 0.06, length, 6), cable, [fromX + dx / 2, 0.06, fromZ + dz / 2]);
            run.rotation.set(Math.PI / 2, 0, Math.atan2(dz, dx));
            run.castShadow = false;
            this.scene.add(run);
        }

        // Monitors on stands, angled so the anchor can read them and the camera still
        // catches their glow.
        for (const side of [-1, 1]) {
            const stand = new THREE.Group();
            stand.position.set(side * 5.4, 0, DESK_Z + 3.6);
            stand.rotation.y = side * -0.6;

            stand.add(this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), this.metal(0x2e3440, 0.42, 0.78), [0, 0.6, 0]));
            stand.add(this.mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.06, 12), this.metal(0x2e3440, 0.42, 0.78), [0, 0.03, 0]));
            stand.add(this.mesh(new THREE.BoxGeometry(1.5, 0.94, 0.1), this.matte(0x0d1015, 0.6, 0.22), [0, 1.62, 0]));

            const feed = this.scroll(chartTexture(this.bin, this.random, side > 0), "x", side * 0.045);
            feed.repeat.set(1.2, 1);

            const screen = this.mesh(
                new THREE.PlaneGeometry(1.36, 0.8),
                this.textured(feed, { emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.5 }),
                [0, 1.62, 0.07]
            );
            screen.castShadow = false;
            stand.add(screen);

            this.scene.add(stand);
            this.collisionGrid.insertCylinder(new THREE.Vector3(side * 5.4, 1, DESK_Z + 3.6), 0.6, 2);
        }

        // Teleprompter: the glass faces the anchor, so the player sees it edge-on with
        // the text bouncing off it, which is how one actually looks on a set.
        const prompterMap = this.scroll(prompterTexture(this.bin, this.info.accent), "y", -0.03);
        prompterMap.repeat.set(1, 1.1);

        const prompter = new THREE.Group();
        prompter.position.set(0, 0, DESK_Z + 5.4);

        prompter.add(this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), this.metal(0x2e3440, 0.42, 0.78), [0, 0.75, 0]));
        prompter.add(this.mesh(new THREE.BoxGeometry(1.7, 1.1, 0.08), this.matte(0x080a0f, 0.7, 0.1), [0, 1.78, 0.18], [0.34, 0, 0]));

        const promptGlass = this.mesh(
            new THREE.PlaneGeometry(1.5, 0.98),
            this.bin.material(new THREE.MeshBasicMaterial({
                map: prompterMap,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
                toneMapped: false,
            })),
            [0, 1.82, 0.12],
            [-0.5, Math.PI, 0]
        );
        promptGlass.castShadow = false;
        prompter.add(promptGlass);

        this.scene.add(prompter);
        this.collisionGrid.insertCylinder(new THREE.Vector3(0, 1, DESK_Z + 5.4), 0.7, 2);

        // Apple boxes and a coffee crate left at the edge of frame.
        const crate = this.matte(0x4a3a28, 0.92, 0.04);
        this.scene.add(this.mesh(new THREE.BoxGeometry(1.1, 0.5, 0.8), crate, [-12.4, 0.25, 8.2], [0, 0.4, 0]));
        this.scene.add(this.mesh(new THREE.BoxGeometry(0.9, 0.44, 0.7), crate, [-12.1, 0.72, 8.5], [0, 0.9, 0]));
        this.scene.add(this.mesh(new THREE.BoxGeometry(1.2, 0.56, 0.9), crate, [13.6, 0.28, -9.4], [0, -0.3, 0]));
    }

    private buildShafts(): void {
        if (prefersMobileProfile()) return;

        const specs: ShaftSpec[] = [];
        for (const [x, z, strength] of [[-3, -2.5, 0.16], [3, -2.5, 0.16], [-9, 6, 0.1], [9, 6, 0.1]] as Array<[number, number, number]>) {
            specs.push({
                origin: new THREE.Vector3(x, 10.6, z),
                direction: new THREE.Vector3(-x * 0.06, -1, DESK_Z - z).normalize(),
                width: 0.7,
                height: 0.7,
                length: 11.5,
                tint: 0xfff0d2,
                strength,
            });
        }

        this.light = new ChurchLight(this.scene, this.bin, this.random, 0);
        this.light.create(specs, false);
    }

    private buildCast(rm: ResourceManager): void {
        this.anchor = this.crowd.createActor(rm, {
            position: ANCHOR_SEAT.clone(),
            set: "crowd",
            variantIndex: 1,
            pose: "sit",
            facing: 0,
            phase: this.random() * 8,
            solid: false,
        }, this.collisionGrid);

        // Scripted, so the crowd's own idle wandering never stands the anchor up mid
        // broadcast — this one only moves when a bulletin comes in.
        this.anchor?.setScripted(true);

        const operator = this.crowd.createActor(rm, {
            position: new THREE.Vector3(-6.6, 0, 5.6),
            set: "crowd",
            variantIndex: 5,
            facing: Math.PI,
            phase: this.random() * 8,
            solid: false,
        }, this.collisionGrid);
        operator?.setScripted(true);
    }

    // Called when the server sends back a synthesised bulletin: the caption, the mouth,
    // the nameplate and the on-air lamps all run off the real clip length rather than a
    // guess from the text.
    public speak(text: string, duration: number): void {
        this.speechRemaining = Math.max(0.6, duration);
        this.anchor?.setTalking(true, text);
        setSceneSubtitle({ speaker: ANCHOR_NAME, text });
    }

    protected tick(delta: number): void {
        for (const entry of this.scrolling) {
            if (entry.axis === "x") entry.map.offset.x -= delta * entry.speed;
            else entry.map.offset.y -= delta * entry.speed;
        }

        const camera = this.camera;
        if (camera) camera.getWorldPosition(this.cameraProbe);
        this.light?.update(delta, this.cameraProbe);

        const onAir = this.speechRemaining > 0;

        if (onAir) {
            this.speechRemaining -= delta;
            if (this.speechRemaining <= 0) {
                this.anchor?.setTalking(false);
                clearSceneSubtitle();
            }
        }

        if (this.liveLamp) {
            this.liveLamp.emissiveIntensity = onAir ? 1.5 + Math.sin(this.elapsed * 7) * 0.35 : 0.26;
        }

        if (this.tally) {
            this.tally.opacity = onAir ? 0.85 + Math.sin(this.elapsed * 9) * 0.15 : 0.18;
        }

        // The nameplate slides up while the anchor talks and drops away after, the way a
        // real lower third does.
        if (this.lowerThird && this.lowerThirdMaterial) {
            const target = onAir ? 1 : 0;
            const eased = THREE.MathUtils.damp(this.lowerThirdMaterial.opacity, target, 6, delta);
            this.lowerThirdMaterial.opacity = eased;
            this.lowerThird.visible = eased > 0.01;
            this.lowerThird.position.y = 0.72 + eased * 0.33;
        }

        for (let i = 0; i < this.screenLights.length; i++) {
            const base = i === 0 ? 24 : 8.5;
            this.screenLights[i].intensity = base + Math.sin(this.elapsed * (1.4 + i * 0.3)) * base * 0.12;
        }
    }

    override dispose(): void {
        this.anchor = null;
        this.scrolling.length = 0;
        this.screenLights.length = 0;
        this.liveLamp = null;
        this.tally = null;
        this.lowerThird = null;
        this.lowerThirdMaterial = null;
        this.speechRemaining = 0;
        this.light?.dispose();
        this.light = null;
        this.scene.environment = null;
        this.environment?.dispose();
        this.environment = null;
        clearSceneSubtitle();
        super.dispose();
    }
}
