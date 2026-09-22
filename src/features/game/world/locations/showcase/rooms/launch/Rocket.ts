// src/features/game/world/locations/showcase/rooms/launch/Rocket.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import { ShowcaseTextures, surfaceMaterial } from "../../textures";
import { CABIN_FLOOR_Y, CABIN_RADIUS, HATCH_Y } from "./launchLayout";
import { ChartTape, plumeNoiseTexture, type ChartMood } from "./launchTextures";

export interface RocketOptions {
    legs?: boolean;
    simple?: boolean;
    ticker?: string;
}

const HULL_BOTTOM = 1.5;
const CABIN_RING_BOTTOM = 22;
const CABIN_RING_TOP = 26.6;
const HULL_TOP = 27.6;
const NOSE_HEIGHT = 7.4;


const DOOR_GAP = 0.78;
const DOOR_CENTER = Math.PI * 1.5;

export class Rocket {
    public readonly group = new THREE.Group();
    public readonly cabin = new THREE.Group();

    private readonly charts: ChartTape[] = [];
    private readonly screens: THREE.Mesh[] = [];
    private readonly portholes: THREE.MeshStandardMaterial[] = [];
    private readonly plumeTime = { value: 0 };
    private plumeMap: THREE.CanvasTexture | null = null;
    private exhaust: THREE.Mesh | null = null;
    private exhaustCore: THREE.Mesh | null = null;
    private exhaustLight: THREE.PointLight | null = null;
    private cabinLight: THREE.PointLight | null = null;
    private hatchHinge: THREE.Group | null = null;
    private legPivots: THREE.Object3D[] = [];
    private ventPuffs: THREE.Mesh[] = [];
    private blast = 0;
    private hatch = 0;
    private elapsed = 0;

    constructor(
        private readonly bin: AssetBin,
        private readonly tex: ShowcaseTextures,
        private readonly random: () => number,
        private readonly options: RocketOptions = {}
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

    private glow(color: number, opacity: number, additive = true): THREE.MeshBasicMaterial {
        return this.bin.material(new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
            toneMapped: false,
        }));
    }

    public create(): THREE.Group {
        const hull = surfaceMaterial(this.bin, this.tex.panel([4, 6], 0xe8edf5, 0x9aa2ae, 3), { roughness: 0.4, metalness: 0.42, bump: 0.03 });
        hull.side = THREE.DoubleSide;

        const trim = surfaceMaterial(this.bin, this.tex.stripes([4, 1], 0xd94f4f, 0xf2f2f2, 8), { roughness: 0.5, metalness: 0.3 });
        const dark = this.bin.material(new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.6, metalness: 0.5 }));
        const steel = this.bin.material(new THREE.MeshStandardMaterial({ color: 0x8a919b, roughness: 0.38, metalness: 0.82 }));

        const lowerHeight = 12.5;
        const lower = this.mesh(
            new THREE.CylinderGeometry(2.55, 2.72, lowerHeight, 28, 1, true),
            hull,
            [0, HULL_BOTTOM + lowerHeight / 2, 0]
        );
        this.group.add(lower);

        const midHeight = CABIN_RING_BOTTOM - (HULL_BOTTOM + lowerHeight);
        const mid = this.mesh(
            new THREE.CylinderGeometry(CABIN_RADIUS, 2.55, midHeight, 28, 1, true),
            hull,
            [0, HULL_BOTTOM + lowerHeight + midHeight / 2, 0]
        );
        this.group.add(mid);

        const ringHeight = CABIN_RING_TOP - CABIN_RING_BOTTOM;
        const ring = this.mesh(
            this.options.simple
                ? new THREE.CylinderGeometry(CABIN_RADIUS, CABIN_RADIUS, ringHeight, 24, 1, true)
                : new THREE.CylinderGeometry(
                    CABIN_RADIUS,
                    CABIN_RADIUS,
                    ringHeight,
                    28,
                    1,
                    true,
                    DOOR_CENTER + DOOR_GAP / 2,
                    Math.PI * 2 - DOOR_GAP
                ),
            hull,
            [0, CABIN_RING_BOTTOM + ringHeight / 2, 0]
        );
        this.group.add(ring);

        const collarHeight = HULL_TOP - CABIN_RING_TOP;
        const collar = this.mesh(
            new THREE.CylinderGeometry(2.4, CABIN_RADIUS, collarHeight, 28, 1, true),
            hull,
            [0, CABIN_RING_TOP + collarHeight / 2, 0]
        );
        this.group.add(collar);

        for (const [y, radius] of [[9.4, 2.66], [20.4, 2.5]] as Array<[number, number]>) {
            this.group.add(this.mesh(new THREE.CylinderGeometry(radius, radius, 1.5, 28), trim, [0, y, 0]));
        }

        const nose = this.mesh(new THREE.ConeGeometry(2.4, NOSE_HEIGHT, 28), hull, [0, HULL_TOP + NOSE_HEIGHT / 2, 0]);
        this.group.add(nose);
        this.group.add(this.mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6), dark, [0, HULL_TOP + NOSE_HEIGHT + 1.2, 0]));

        if (this.options.simple) this.buildBlindPorts(steel);
        else {
            this.buildCabin(steel, dark);
            this.buildDoor(steel, dark);
        }
        this.buildSkirt(dark, steel, trim);
        this.buildDecals();
        if (this.options.legs) this.buildLegs(steel);
        this.buildPlume();
        this.buildVents();

        return this.group;
    }

    private buildCabin(steel: THREE.Material, dark: THREE.Material) {
        this.group.add(this.cabin);

        const floor = this.mesh(new THREE.CylinderGeometry(CABIN_RADIUS, CABIN_RADIUS, 0.2, 26), dark, [0, CABIN_FLOOR_Y - 0.1, 0]);
        floor.castShadow = false;
        this.cabin.add(floor);

        const ceiling = this.mesh(new THREE.CylinderGeometry(CABIN_RADIUS, CABIN_RADIUS, 0.18, 26), dark, [0, CABIN_RING_TOP - 0.2, 0]);
        ceiling.castShadow = false;
        this.cabin.add(ceiling);

        const seatSkin = this.bin.material(new THREE.MeshStandardMaterial({ color: 0x27303c, roughness: 0.82, metalness: 0.08 }));
        const beltSkin = this.bin.material(new THREE.MeshStandardMaterial({ color: 0xffb547, roughness: 0.7, metalness: 0.1 }));

        for (const side of [-1, 1]) {
            const seat = new THREE.Group();
            seat.position.set(side * 0.82, CABIN_FLOOR_Y, 0.1);
            seat.rotation.y = Math.PI;

            const pan = this.mesh(new THREE.BoxGeometry(0.86, 0.14, 0.82), seatSkin, [0, 0.42, 0]);
            pan.castShadow = false;
            seat.add(pan);

            const back = this.mesh(new THREE.BoxGeometry(0.86, 1.24, 0.16), seatSkin, [0, 1.02, 0.4], [0.22, 0, 0]);
            back.castShadow = false;
            seat.add(back);

            const frame = this.mesh(new THREE.BoxGeometry(0.96, 0.1, 0.94), steel, [0, 0.34, 0]);
            frame.castShadow = false;
            seat.add(frame);

            for (const leg of [-0.38, 0.38]) {
                const post = this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 6), steel, [leg, 0.17, 0]);
                post.castShadow = false;
                seat.add(post);
            }

            const belt = this.mesh(new THREE.BoxGeometry(0.08, 1.02, 0.08), beltSkin, [0.2, 0.96, 0.24], [0.2, 0, 0.16]);
            belt.castShadow = false;
            seat.add(belt);

            this.cabin.add(seat);
        }

        const desk = this.mesh(new THREE.BoxGeometry(3.1, 0.8, 0.5), dark, [0, CABIN_FLOOR_Y + 1.16, -1.44], [-0.34, 0, 0]);
        desk.castShadow = false;
        this.cabin.add(desk);

        const deskTop = this.mesh(new THREE.BoxGeometry(3.1, 0.12, 0.74), steel, [0, CABIN_FLOOR_Y + 0.9, -1.1], [0.12, 0, 0]);
        deskTop.castShadow = false;
        this.cabin.add(deskTop);

        const labels = [`$${this.options.ticker ?? "MOON"}`, "ALTITUDE", "FUEL"];
        for (let i = 0; i < 3; i++) {
            const tape = new ChartTape(this.bin, labels[i], 20260922 + i * 977);
            this.charts.push(tape);

            const screenMaterial = this.bin.material(new THREE.MeshStandardMaterial({
                map: tape.map,
                emissive: 0xffffff,
                emissiveMap: tape.map,
                emissiveIntensity: 1.4,
                roughness: 0.34,
                metalness: 0.1,
            }));

            const screen = this.mesh(new THREE.PlaneGeometry(0.9, 0.56), screenMaterial, [(i - 1) * 0.99, CABIN_FLOOR_Y + 1.28, -1.22], [-0.34, 0, 0]);
            screen.castShadow = false;
            screen.receiveShadow = false;
            this.cabin.add(screen);
            this.screens.push(screen);
        }

        for (let i = 0; i < 12; i++) {
            const lit = i % 3 === 0;
            const knob = this.mesh(
                new THREE.CylinderGeometry(0.045, 0.045, 0.07, 6),
                lit
                    ? this.bin.material(new THREE.MeshStandardMaterial({ color: 0xff5a4a, emissive: 0xff5a4a, emissiveIntensity: 0.9, roughness: 0.4 }))
                    : steel,
                [-1.32 + i * 0.24, CABIN_FLOOR_Y + 0.96, -1.04],
                [1.45, 0, 0]
            );
            knob.castShadow = false;
            this.cabin.add(knob);
        }

        const rail = this.mesh(new THREE.TorusGeometry(CABIN_RADIUS - 0.16, 0.06, 6, 24), steel, [0, CABIN_FLOOR_Y + 2.4, 0], [-Math.PI / 2, 0, 0]);
        rail.castShadow = false;
        this.cabin.add(rail);

        this.cabinLight = new THREE.PointLight(0x9fd8ff, 9, 9, 2);
        this.cabinLight.position.set(0, CABIN_FLOOR_Y + 2.2, 0);
        this.cabin.add(this.cabinLight);

        const angles = [0, Math.PI * 0.5, Math.PI];
        for (let i = 0; i < angles.length; i++) {
            const angle = angles[i];
            const x = Math.sin(angle) * (CABIN_RADIUS + 0.04);
            const z = Math.cos(angle) * (CABIN_RADIUS + 0.04);
            const tape = this.charts[i % this.charts.length];

            const glassMaterial = this.bin.material(new THREE.MeshStandardMaterial({
                map: tape.map,
                emissive: 0xffffff,
                emissiveMap: tape.map,
                emissiveIntensity: 1.1,
                color: 0x8ec8ff,
                roughness: 0.2,
                metalness: 0.2,
            }));
            this.portholes.push(glassMaterial);

            const glass = this.mesh(new THREE.CircleGeometry(0.56, 20), glassMaterial, [x, CABIN_FLOOR_Y + 1.45, z], [0, angle, 0]);
            glass.castShadow = false;
            glass.receiveShadow = false;
            this.group.add(glass);

            const ring = this.mesh(new THREE.TorusGeometry(0.6, 0.11, 8, 18), steel, [x, CABIN_FLOOR_Y + 1.45, z], [0, angle, 0]);
            ring.castShadow = false;
            this.group.add(ring);
        }
    }

    private buildBlindPorts(steel: THREE.Material) {
        const glass = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x6fd6ff,
            emissive: 0x2d7fae,
            emissiveIntensity: 0.7,
            roughness: 0.2,
            metalness: 0.3,
        }));

        for (const angle of [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]) {
            const x = Math.sin(angle) * (CABIN_RADIUS + 0.04);
            const z = Math.cos(angle) * (CABIN_RADIUS + 0.04);

            const port = this.mesh(new THREE.CircleGeometry(0.52, 16), glass, [x, CABIN_FLOOR_Y + 1.45, z], [0, angle, 0]);
            port.castShadow = false;
            this.group.add(port);

            const ring = this.mesh(new THREE.TorusGeometry(0.56, 0.1, 6, 14), steel, [x, CABIN_FLOOR_Y + 1.45, z], [0, angle, 0]);
            ring.castShadow = false;
            this.group.add(ring);
        }
    }

    private buildDoor(steel: THREE.Material, dark: THREE.Material) {
        const doorX = Math.sin(DOOR_CENTER) * CABIN_RADIUS;

        const sill = this.mesh(new THREE.BoxGeometry(0.5, 0.16, 1.9), dark, [doorX + 0.2, HATCH_Y - 0.04, 0]);
        sill.castShadow = false;
        this.group.add(sill);

        for (const side of [-1, 1]) {
            const jamb = this.mesh(new THREE.BoxGeometry(0.32, 2.5, 0.22), steel, [doorX + 0.1, HATCH_Y + 1.2, side * 0.95]);
            jamb.castShadow = false;
            this.group.add(jamb);
        }

        const lintel = this.mesh(new THREE.BoxGeometry(0.34, 0.24, 2.1), steel, [doorX + 0.1, HATCH_Y + 2.4, 0]);
        lintel.castShadow = false;
        this.group.add(lintel);

        const hinge = new THREE.Group();
        hinge.position.set(doorX - 0.06, HATCH_Y, -0.98);
        this.hatchHinge = hinge;
        this.group.add(hinge);

        const door = this.mesh(new THREE.BoxGeometry(0.18, 2.3, 1.94), steel, [0, 1.16, 0.97]);
        door.castShadow = false;
        hinge.add(door);

        const handle = this.mesh(
            new THREE.TorusGeometry(0.24, 0.05, 6, 14),
            this.bin.material(new THREE.MeshStandardMaterial({ color: 0xffb547, roughness: 0.4, metalness: 0.7 })),
            [-0.14, 1.16, 1.62],
            [0, Math.PI / 2, 0]
        );
        handle.castShadow = false;
        hinge.add(handle);
    }

    private buildSkirt(dark: THREE.Material, steel: THREE.Material, trim: THREE.Material) {
        this.group.add(this.mesh(new THREE.CylinderGeometry(2.72, 3.3, 2.6, 28), dark, [0, 1.3, 0]));

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const fin = this.mesh(
                new THREE.BoxGeometry(0.5, 6.6, 3.4),
                trim,
                [Math.cos(angle) * 3, 4.2, Math.sin(angle) * 3],
                [0, -angle, 0]
            );
            this.group.add(fin);
        }

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const grid = this.mesh(
                new THREE.BoxGeometry(0.16, 1.9, 1.5),
                steel,
                [Math.cos(angle) * 2.6, 19, Math.sin(angle) * 2.6],
                [0, -angle, 0]
            );
            this.group.add(grid);
        }

        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const nozzle = this.mesh(
                new THREE.CylinderGeometry(0.5, 1.05, 2.4, 14, 1, true),
                dark,
                [Math.cos(angle) * 1.35, 0.2, Math.sin(angle) * 1.35]
            );
            (nozzle.material as THREE.Material).side = THREE.DoubleSide;
            this.group.add(nozzle);
        }
    }

    private buildDecals() {
        const ticker = this.options.ticker ?? "MOON";
        const decal = surfaceMaterial(this.bin, this.tex.emblem(`rocket${ticker}`, "rocket", 0xf2f4f8, 0x1c2028, `$${ticker}`), {
            roughness: 0.6,
            metalness: 0.2,
        });
        decal.polygonOffset = true;
        decal.polygonOffsetFactor = -4;
        decal.polygonOffsetUnits = -8;

        for (const angle of [0, Math.PI]) {
            const badge = this.mesh(
                new THREE.PlaneGeometry(2.6, 2.6),
                decal,
                [Math.sin(angle) * 2.56, 14.5, Math.cos(angle) * 2.56],
                [0, angle, 0]
            );
            badge.castShadow = false;
            this.group.add(badge);
        }

        const flag = surfaceMaterial(this.bin, this.tex.stripes([1, 1], 0x3ddc84, 0xf2f2f2, 3), { roughness: 0.7, metalness: 0.1 });
        flag.polygonOffset = true;
        flag.polygonOffsetFactor = -4;
        flag.polygonOffsetUnits = -8;

        for (const angle of [Math.PI * 0.5, Math.PI * 1.5]) {
            const patch = this.mesh(
                new THREE.PlaneGeometry(1.5, 1),
                flag,
                [Math.sin(angle) * 2.6, 17.4, Math.cos(angle) * 2.6],
                [0, angle, 0]
            );
            patch.castShadow = false;
            this.group.add(patch);
        }
    }

    private buildLegs(steel: THREE.Material) {
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const pivot = new THREE.Group();
            pivot.position.set(Math.cos(angle) * 2.5, 2.4, Math.sin(angle) * 2.5);
            pivot.rotation.y = -angle + Math.PI / 2;

            const strut = this.mesh(new THREE.CylinderGeometry(0.2, 0.26, 5.6, 8), steel, [0, -2.3, 1.2], [-0.44, 0, 0]);
            pivot.add(strut);

            const pad = this.mesh(new THREE.CylinderGeometry(0.74, 0.6, 0.26, 12), steel, [0, -4.42, 2.44]);
            pivot.add(pad);

            const brace = this.mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.8, 6), steel, [0, -1.2, 0.76], [-1.02, 0, 0]);
            brace.castShadow = false;
            pivot.add(brace);

            this.group.add(pivot);
            this.legPivots.push(pivot);
        }

        this.setLegs(1);
    }

    private plumeMaterial(color: number, opacity: number, streaks: number): THREE.MeshBasicMaterial {
        if (!this.plumeMap) this.plumeMap = plumeNoiseTexture(this.bin, this.random);

        const material = this.glow(color, opacity);
        const uniforms = {
            uPlume: { value: this.plumeMap },
            uPlumeTime: this.plumeTime,
            uPlumeStreaks: { value: streaks },
        };

        material.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, uniforms);

            shader.vertexShader = shader.vertexShader
                .replace("#include <common>", ["#include <common>", "varying vec2 vPlumeUv;"].join("\n"))
                .replace("#include <begin_vertex>", ["#include <begin_vertex>", "vPlumeUv = uv;"].join("\n"));

            shader.fragmentShader = shader.fragmentShader
                .replace(
                    "#include <common>",
                    [
                        "#include <common>",
                        "uniform sampler2D uPlume;",
                        "uniform float uPlumeTime;",
                        "uniform float uPlumeStreaks;",
                        "varying vec2 vPlumeUv;",
                    ].join("\n")
                )
                .replace(
                    "#include <opaque_fragment>",
                    /* glsl */`
                    float pnA = texture2D(uPlume, vec2(vPlumeUv.x * 2.0, vPlumeUv.y * 1.5 - uPlumeTime)).r;
                    float pnB = texture2D(uPlume, vec2(vPlumeUv.x * 3.7 + 0.31, vPlumeUv.y * 2.8 - uPlumeTime * 1.9)).r;
                    float shock = 0.7 + 0.46 * sin(vPlumeUv.y * uPlumeStreaks - uPlumeTime * 7.0);
                    float taper = 1.0 - smoothstep(0.5, 1.0, vPlumeUv.y);
                    diffuseColor.a *= clamp((0.3 + 2.1 * pnA * pnB) * mix(1.0, shock, 0.4) * taper, 0.0, 1.0);
                    #include <opaque_fragment>
                    `
                );
        };

        material.customProgramCacheKey = () => `rocket-plume-${streaks}`;
        return material;
    }

    private buildPlume() {
        const flame = new THREE.ConeGeometry(2.6, 12, 22, 1, true);
        flame.rotateX(Math.PI);
        flame.translate(0, -6, 0);

        this.exhaust = this.mesh(flame, this.plumeMaterial(0xffb45a, 0.5, 26), [0, -0.6, 0]);
        this.exhaust.castShadow = false;
        this.exhaust.receiveShadow = false;
        this.group.add(this.exhaust);

        const core = new THREE.ConeGeometry(1.35, 7.4, 18, 1, true);
        core.rotateX(Math.PI);
        core.translate(0, -3.7, 0);

        this.exhaustCore = this.mesh(core, this.plumeMaterial(0xfff3c4, 0.85, 44), [0, -0.6, 0]);
        this.exhaustCore.castShadow = false;
        this.exhaustCore.receiveShadow = false;
        this.group.add(this.exhaustCore);

        this.exhaustLight = new THREE.PointLight(0xffa14a, 0, 70, 2);
        this.exhaustLight.position.set(0, -1.2, 0);
        this.group.add(this.exhaustLight);

        this.setBlast(0);
    }

    private buildVents() {
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 + 0.5;
            const puff = this.mesh(
                new THREE.SphereGeometry(0.8 + this.random() * 0.5, 10, 8),
                this.glow(0xdfe9f5, 0.2, false),
                [Math.cos(angle) * 3, 6 + i * 3.4, Math.sin(angle) * 3]
            );
            puff.castShadow = false;
            puff.receiveShadow = false;
            this.group.add(puff);
            this.ventPuffs.push(puff);
        }
    }

    public setBlast(amount: number) {
        this.blast = THREE.MathUtils.clamp(amount, 0, 1);
    }

    public setHatch(amount: number) {
        this.hatch = THREE.MathUtils.clamp(amount, 0, 1);
        if (this.hatchHinge) this.hatchHinge.rotation.y = -this.hatch * 2.2;
    }

    public setLegs(amount: number) {
        const value = THREE.MathUtils.clamp(amount, 0, 1);
        for (const pivot of this.legPivots) pivot.rotation.x = 0.62 * (1 - value);
    }

    public setVents(visible: boolean) {
        for (const puff of this.ventPuffs) puff.visible = visible;
    }

    public setChartMood(mood: ChartMood) {
        for (const chart of this.charts) chart.setMood(mood);
    }

    public setCabinLit(lit: boolean) {
        if (this.cabinLight) this.cabinLight.intensity = lit ? 9 : 0;
        for (const material of this.portholes) material.emissiveIntensity = lit ? 1.1 : 0.14;
        for (const screen of this.screens) (screen.material as THREE.MeshStandardMaterial).emissiveIntensity = lit ? 1.4 : 0.2;
    }

    public update(delta: number) {
        this.elapsed += delta;
        this.plumeTime.value += delta * (0.35 + this.blast * 1.6);

        for (const chart of this.charts) chart.update(delta);

        const flicker = 1 + Math.sin(this.elapsed * 13) * 0.12;
        const heat = (0.08 + this.blast * 1.05) * flicker;

        if (this.exhaust) {
            const material = this.exhaust.material as THREE.MeshBasicMaterial;
            material.opacity = 0.18 + this.blast * 0.46;
            this.exhaust.scale.set(0.5 + this.blast * 0.55, heat, 0.5 + this.blast * 0.55);
            this.exhaust.visible = this.blast > 0.02;
        }

        if (this.exhaustCore) {
            const material = this.exhaustCore.material as THREE.MeshBasicMaterial;
            material.opacity = 0.4 + this.blast * 0.5;
            this.exhaustCore.scale.set(0.45 + this.blast * 0.5, heat * 1.1, 0.45 + this.blast * 0.5);
            this.exhaustCore.visible = this.blast > 0.02;
        }

        if (this.exhaustLight) {
            this.exhaustLight.intensity = this.blast * (200 + Math.sin(this.elapsed * 11) * 60);
        }

        for (let i = 0; i < this.ventPuffs.length; i++) {
            const puff = this.ventPuffs[i];
            const t = (this.elapsed * 0.4 + i * 0.19) % 1;
            puff.scale.setScalar(0.5 + t * 2.2);
            (puff.material as THREE.MeshBasicMaterial).opacity = 0.22 * (1 - t) * (1 - this.blast);
        }
    }

    public dispose() {
        this.charts.length = 0;
        this.screens.length = 0;
        this.portholes.length = 0;
        this.legPivots.length = 0;
        this.ventPuffs.length = 0;
        this.plumeMap = null;
    }
}
