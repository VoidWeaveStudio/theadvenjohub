// src/features/game/world/locations/tower/floors/EventsHall.ts
import * as THREE from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";
import { EVENT_DOORS, EVENT_DOOR_PREFIX } from "../../../../data/eventDoors";

const ROOM_HALF = 60;
const ROOM_HEIGHT = 24;
const DOOR_RADIUS = 54;
const GATE_RADIUS = 46;
const ALTAR_RADIUS = 6;
const ALTAR_HEIGHT = 1.1;
const CANDLE_BASE_HEIGHT = 4.2;

interface Brazier {
    flame: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    phase: number;
}

interface DoorHandle {
    id: string;
    group: THREE.Group;
    veil: THREE.MeshBasicMaterial;
    glow: THREE.MeshBasicMaterial;
    live: boolean;
    phase: number;
}

function createTempleFloorTexture(): THREE.Texture {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#2a2622";
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 700; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        ctx.fillStyle = Math.random() > 0.5 ? "rgba(90,82,70,0.18)" : "rgba(18,16,14,0.22)";
        ctx.beginPath();
        ctx.arc(x, y, 2 + Math.random() * 9, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = "rgba(14,12,10,0.75)";
    ctx.lineWidth = 3;
    const tiles = 4;
    const step = size / tiles;
    for (let i = 0; i <= tiles; i++) {
        ctx.beginPath();
        ctx.moveTo(i * step, 0);
        ctx.lineTo(i * step, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * step);
        ctx.lineTo(size, i * step);
        ctx.stroke();
    }

    ctx.strokeStyle = "rgba(10,9,8,0.5)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
        let x = Math.random() * size;
        let y = Math.random() * size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 5; j++) {
            x += (Math.random() - 0.5) * 70;
            y += (Math.random() - 0.5) * 70;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

export class EventsHall extends TowerFloor {
    private static readonly scratchColor = new THREE.Color();

    private factionId: string | null = null;
    private factionName: string | null = null;

    private floorMaterial!: THREE.MeshStandardMaterial;
    private braziers: Brazier[] = [];
    private doors: DoorHandle[] = [];

    private candle: THREE.Group | null = null;
    private candleBody: THREE.Mesh | null = null;
    private candleMaterial: THREE.MeshStandardMaterial | null = null;
    private flameInner: THREE.Mesh | null = null;
    private flameOuter: THREE.Mesh | null = null;
    private flameHalo: THREE.Mesh | null = null;
    private flameLight: THREE.PointLight | null = null;
    private wax: THREE.Mesh[] = [];

    private candleHealthRatio = 1;
    private candleWave = 0;
    private candleFlash = 0;

    constructor() {
        super("tower-events", "Events");
        this.maxPlayerRadius = ROOM_HALF + 2;
    }

    public setFactionContext(factionId: string, factionName: string) {
        this.factionId = factionId;
        this.factionName = factionName;
    }

    public getFactionContext(): { factionId: string | null; factionName: string | null } {
        return { factionId: this.factionId, factionName: this.factionName };
    }

    public getInteractables(): THREE.Object3D[] {
        return [...super.getInteractables(), ...this.doors.map((door) => door.group)];
    }

    create(_rm: ResourceManager): void {
        const bgColor = 0x0d0a10;
        this.scene.background = new THREE.Color(bgColor);
        this.scene.fog = new THREE.FogExp2(bgColor, 0.007);

        this.scene.add(new THREE.AmbientLight(0x33283a, 0.55));
        this.scene.add(new THREE.HemisphereLight(0x6a4a7a, 0x1a1410, 0.5));

        const moon = new THREE.DirectionalLight(0xbfd4ff, 0.75);
        moon.position.set(40, 70, -30);
        moon.target.position.set(0, 0, 0);
        moon.castShadow = true;
        moon.shadow.mapSize.set(1024, 1024);
        moon.shadow.camera.left = -ROOM_HALF;
        moon.shadow.camera.right = ROOM_HALF;
        moon.shadow.camera.top = ROOM_HALF;
        moon.shadow.camera.bottom = -ROOM_HALF;
        moon.shadow.camera.near = 5;
        moon.shadow.camera.far = 180;
        this.scene.add(moon);
        this.scene.add(moon.target);

        this.buildFloor();
        this.buildWalls();
        this.buildColonnade();
        this.buildRubble();
        this.buildAltar();
        this.buildCandle();
        this.buildSpawnGates();
        this.buildBraziers();
        this.buildDoors();

        this.createCentralCrystal(new THREE.Vector3(16, 0, 16));
    }

    private buildFloor() {
        this.floorMaterial = new THREE.MeshStandardMaterial({
            map: createTempleFloorTexture(),
            roughness: 0.95,
            metalness: 0.05,
        });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_HALF * 2, ROOM_HALF * 2), this.floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
    }

    private buildWalls() {
        const mat = new THREE.MeshStandardMaterial({ color: 0x3b3128, roughness: 0.95, metalness: 0.02 });
        const sides: Array<[number, number, number]> = [
            [0, -ROOM_HALF, 0],
            [0, ROOM_HALF, 0],
            [-ROOM_HALF, 0, Math.PI / 2],
            [ROOM_HALF, 0, Math.PI / 2],
        ];

        for (const [x, z, rotY] of sides) {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(ROOM_HALF * 2, ROOM_HEIGHT, 1.6), mat);
            wall.position.set(x, ROOM_HEIGHT / 2, z);
            wall.rotation.y = rotY;
            wall.receiveShadow = true;
            wall.castShadow = true;
            this.scene.add(wall);

            const box = new THREE.Box3().setFromObject(wall);
            box.expandByScalar(0.4);
            this.collisionGrid.insert(box);
        }
    }

    private buildColonnade() {
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4036, roughness: 0.9, metalness: 0.03 });
        const shaftGeo = new THREE.CylinderGeometry(1.5, 1.7, 1, 12);
        const drumGeo = new THREE.CylinderGeometry(1.6, 1.6, 1, 12);
        const count = 16;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.PI / count;
            const radius = ROOM_HALF - 12;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const broken = i % 3 === 1;
            const height = broken ? 5 + Math.random() * 5 : ROOM_HEIGHT - 3;

            const shaft = new THREE.Mesh(shaftGeo, stoneMat);
            shaft.scale.set(1, height, 1);
            shaft.position.set(x, height / 2, z);
            shaft.rotation.y = Math.random() * Math.PI;
            shaft.castShadow = true;
            this.scene.add(shaft);

            this.collisionGrid.insert(new THREE.Box3(
                new THREE.Vector3(x - 1.8, 0, z - 1.8),
                new THREE.Vector3(x + 1.8, height, z + 1.8)
            ));

            if (!broken) {
                const capital = new THREE.Mesh(drumGeo, stoneMat);
                capital.scale.set(1.35, 1.1, 1.35);
                capital.position.set(x, height + 0.55, z);
                capital.castShadow = true;
                this.scene.add(capital);
            } else {
                const fallen = new THREE.Mesh(shaftGeo, stoneMat);
                const fallenLength = 6 + Math.random() * 5;
                fallen.scale.set(0.9, fallenLength, 0.9);
                fallen.position.set(x + Math.cos(angle) * -3.5, 1.4, z + Math.sin(angle) * -3.5);
                fallen.rotation.z = Math.PI / 2;
                fallen.rotation.y = angle;
                fallen.castShadow = true;
                this.scene.add(fallen);
            }
        }
    }

    private buildRubble() {
        const mat = new THREE.MeshStandardMaterial({ color: 0x453b31, roughness: 0.98, metalness: 0.02 });
        const geo = new THREE.DodecahedronGeometry(1, 0);

        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = ALTAR_RADIUS + 6 + Math.random() * (ROOM_HALF - 20);
            const chunk = new THREE.Mesh(geo, mat);
            chunk.scale.setScalar(0.5 + Math.random() * 1.6);
            chunk.position.set(Math.cos(angle) * radius, 0.2 + Math.random() * 0.4, Math.sin(angle) * radius);
            chunk.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
            chunk.castShadow = true;
            this.scene.add(chunk);
        }
    }

    private buildAltar() {
        const stepMat = new THREE.MeshStandardMaterial({ color: 0x554839, roughness: 0.88, metalness: 0.05 });
        const runeMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.5, toneMapped: false });

        const stepHeight = ALTAR_HEIGHT / 3;

        for (let i = 0; i < 3; i++) {
            const half = ALTAR_RADIUS + i * 1.5;
            const top = ALTAR_HEIGHT - i * stepHeight;

            const step = new THREE.Mesh(new THREE.BoxGeometry(half * 2, stepHeight, half * 2), stepMat);
            step.position.y = top - stepHeight / 2;
            step.receiveShadow = true;
            step.castShadow = true;
            this.scene.add(step);

            this.collisionGrid.insert(new THREE.Box3(
                new THREE.Vector3(-half, 0, -half),
                new THREE.Vector3(half, top, half)
            ));
        }

        const runes = new THREE.Mesh(new THREE.RingGeometry(ALTAR_RADIUS - 1.6, ALTAR_RADIUS - 0.6, 48), runeMat);
        runes.rotation.x = -Math.PI / 2;
        runes.position.y = ALTAR_HEIGHT + 0.02;
        this.scene.add(runes);
    }

    private buildCandle() {
        this.candle = new THREE.Group();
        this.candle.position.set(0, ALTAR_HEIGHT, 0);

        this.candleMaterial = new THREE.MeshStandardMaterial({
            color: 0x86efac,
            emissive: 0x22c55e,
            emissiveIntensity: 0.9,
            roughness: 0.35,
            metalness: 0.05,
            toneMapped: false,
        });

        this.candleBody = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, CANDLE_BASE_HEIGHT, 20), this.candleMaterial);
        this.candleBody.position.y = CANDLE_BASE_HEIGHT / 2;
        this.candleBody.castShadow = true;
        this.candle.add(this.candleBody);

        for (let i = 0; i < 7; i++) {
            const angle = (i / 7) * Math.PI * 2 + Math.random();
            const drip = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.7 + Math.random() * 1.1, 4, 8), this.candleMaterial);
            drip.position.set(Math.cos(angle) * 1.18, CANDLE_BASE_HEIGHT - 0.7 - Math.random() * 0.8, Math.sin(angle) * 1.18);
            this.candle.add(drip);
            this.wax.push(drip);
        }

        const wickMat = new THREE.MeshBasicMaterial({ color: 0x2a2018, toneMapped: false });
        const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.6, 6), wickMat);
        wick.position.y = CANDLE_BASE_HEIGHT + 0.3;
        this.candle.add(wick);

        const outerMat = new THREE.MeshBasicMaterial({
            color: 0x4ade80,
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        });
        this.flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.6, 12), outerMat);
        this.flameOuter.position.y = CANDLE_BASE_HEIGHT + 1.7;
        this.candle.add(this.flameOuter);

        const innerMat = new THREE.MeshBasicMaterial({
            color: 0xeafff2,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        });
        this.flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.5, 10), innerMat);
        this.flameInner.position.y = CANDLE_BASE_HEIGHT + 1.25;
        this.candle.add(this.flameInner);

        const haloMat = new THREE.MeshBasicMaterial({
            color: 0x4ade80,
            transparent: true,
            opacity: 0.16,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        });
        this.flameHalo = new THREE.Mesh(new THREE.SphereGeometry(3.4, 16, 12), haloMat);
        this.flameHalo.position.y = CANDLE_BASE_HEIGHT + 1.4;
        this.candle.add(this.flameHalo);

        this.flameLight = new THREE.PointLight(0x4ade80, 26, 60);
        this.flameLight.position.y = CANDLE_BASE_HEIGHT + 1.6;
        this.candle.add(this.flameLight);

        this.scene.add(this.candle);

        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(-1.5, 0, -1.5),
            new THREE.Vector3(1.5, ALTAR_HEIGHT + CANDLE_BASE_HEIGHT, 1.5)
        ));
    }

    private buildSpawnGates() {
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x241a2a, roughness: 0.8, metalness: 0.3 });
        const veilMat = new THREE.MeshBasicMaterial({
            color: 0xa855f7,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        });

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const group = new THREE.Group();
            group.position.set(Math.cos(angle) * GATE_RADIUS, 0, Math.sin(angle) * GATE_RADIUS);
            group.lookAt(0, 0, 0);

            const arch = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.55, 10, 26, Math.PI), frameMat);
            arch.position.y = 0.1;
            arch.castShadow = true;
            group.add(arch);

            const veil = new THREE.Mesh(new THREE.CircleGeometry(4.2, 26, 0, Math.PI), veilMat);
            veil.position.y = 0.1;
            group.add(veil);

            this.scene.add(group);
        }
    }

    private buildBraziers() {
        const bowlMat = new THREE.MeshStandardMaterial({ color: 0x2e2620, roughness: 0.75, metalness: 0.4 });

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const radius = ROOM_HALF - 24;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 3, 10), bowlMat);
            stand.position.set(x, 1.5, z);
            stand.castShadow = true;
            this.scene.add(stand);

            const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.55, 0.7, 12), bowlMat);
            bowl.position.set(x, 3.2, z);
            this.scene.add(bowl);

            const flameMat = new THREE.MeshBasicMaterial({
                color: 0xff9a4a,
                transparent: true,
                opacity: 0.85,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            });
            const flame = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2, 10), flameMat);
            flame.position.set(x, 4.4, z);
            this.scene.add(flame);

            const light = new THREE.PointLight(0xff9a4a, 14, 34);
            light.position.set(x, 4.6, z);
            this.scene.add(light);

            this.braziers.push({ flame, material: flameMat, phase: Math.random() * Math.PI * 2 });

            this.collisionGrid.insert(new THREE.Box3(
                new THREE.Vector3(x - 0.8, 0, z - 0.8),
                new THREE.Vector3(x + 0.8, 3.4, z + 0.8)
            ));
        }
    }

    private buildDoors() {
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x463a2e, roughness: 0.9, metalness: 0.05 });
        const count = EVENT_DOORS.length;

        EVENT_DOORS.forEach((event, i) => {
            const angle = (i / count) * Math.PI * 2 + Math.PI / count;
            const group = new THREE.Group();
            group.position.set(Math.cos(angle) * DOOR_RADIUS, 0, Math.sin(angle) * DOOR_RADIUS);
            group.lookAt(0, 0, 0);

            const frame = new THREE.Mesh(new THREE.BoxGeometry(5.4, 8.4, 1.2), stoneMat);
            frame.position.y = 4.2;
            frame.castShadow = true;
            group.add(frame);

            const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.9, 1.8), stoneMat);
            lintel.position.y = 8.7;
            lintel.castShadow = true;
            group.add(lintel);

            const veilMat = new THREE.MeshBasicMaterial({
                color: event.live ? event.accent : 0x2a2a30,
                transparent: true,
                opacity: event.live ? 0.6 : 0.22,
                depthWrite: false,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            });
            const veil = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 7.2), veilMat);
            veil.position.set(0, 3.9, 0.66);
            group.add(veil);

            const glowMat = new THREE.MeshBasicMaterial({
                color: event.accent,
                transparent: true,
                opacity: event.live ? 0.34 : 0.05,
                depthWrite: false,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            });
            const glow = new THREE.Mesh(new THREE.RingGeometry(3.1, 4.6, 28), glowMat);
            glow.position.set(0, 3.9, 0.9);
            group.add(glow);

            group.userData.interactionId = `${EVENT_DOOR_PREFIX}${event.id}`;
            group.userData.interactionRadius = 5;

            this.scene.add(group);
            this.doors.push({ id: event.id, group, veil: veilMat, glow: glowMat, live: event.live, phase: i * 0.7 });

            group.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(frame);
            box.expandByScalar(0.3);
            this.collisionGrid.insert(box);
        });
    }

    public setCandleState(healthRatio: number, wave: number) {
        this.candleHealthRatio = Math.max(0, Math.min(1, healthRatio));
        this.candleWave = wave;
    }

    public flashCandle() {
        this.candleFlash = 1;
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        const now = performance.now() * 0.001;

        for (const brazier of this.braziers) {
            const flicker = 0.75 + Math.sin(now * 7 + brazier.phase) * 0.15 + Math.random() * 0.06;
            brazier.flame.scale.set(flicker, 0.85 + flicker * 0.35, flicker);
            brazier.material.opacity = 0.7 + Math.sin(now * 9 + brazier.phase) * 0.15;
        }

        for (const door of this.doors) {
            if (!door.live) continue;
            const pulse = 0.5 + Math.sin(now * 2 + door.phase) * 0.18;
            door.veil.opacity = pulse;
            door.glow.opacity = 0.24 + Math.sin(now * 2.4 + door.phase) * 0.12;
        }

        this.updateCandle(now, delta);
    }

    private updateCandle(now: number, delta: number) {
        if (!this.candleBody || !this.candleMaterial || !this.flameInner || !this.flameOuter || !this.flameHalo || !this.flameLight) return;

        if (this.candleFlash > 0) this.candleFlash = Math.max(0, this.candleFlash - delta * 2.5);

        const growth = 1 + Math.min(this.candleWave, 25) * 0.05;
        const height = CANDLE_BASE_HEIGHT * growth;
        this.candleBody.scale.set(1, growth, 1);
        this.candleBody.position.y = height / 2;

        for (const drip of this.wax) drip.position.y = height - 0.7 - (height - CANDLE_BASE_HEIGHT) * 0.1;

        const hurt = 1 - this.candleHealthRatio;
        const flicker = 1 + Math.sin(now * 11) * 0.12 + Math.sin(now * 23) * 0.05;
        const strength = 0.35 + this.candleHealthRatio * 0.65;

        this.flameInner.position.y = height + 1.25;
        this.flameOuter.position.y = height + 1.7;
        this.flameHalo.position.y = height + 1.4;
        this.flameLight.position.y = height + 1.6;

        this.flameInner.scale.set(flicker, strength * flicker, flicker);
        this.flameOuter.scale.set(flicker * 1.05, strength * flicker * 1.1, flicker * 1.05);
        this.flameHalo.scale.setScalar(0.8 + strength * 0.5 + this.candleFlash * 0.3);

        this.candleMaterial.color.setRGB(0.52 + hurt * 0.45, 0.94 - hurt * 0.6, 0.68 - hurt * 0.45);
        this.candleMaterial.emissive.setRGB(0.13 + hurt * 0.75 + this.candleFlash, 0.77 - hurt * 0.55, 0.35 - hurt * 0.25);
        this.candleMaterial.emissiveIntensity = 0.9 + this.candleFlash * 1.6;

        EventsHall.scratchColor.setRGB(0.29 + hurt * 0.7, 0.87 - hurt * 0.62, 0.5 - hurt * 0.38);
        (this.flameOuter.material as THREE.MeshBasicMaterial).color.copy(EventsHall.scratchColor);
        (this.flameHalo.material as THREE.MeshBasicMaterial).color.copy(EventsHall.scratchColor);
        this.flameLight.color.copy(EventsHall.scratchColor);
        this.flameLight.intensity = (14 + strength * 16) + this.candleFlash * 14;
    }

    dispose() {
        this.floorMaterial?.map?.dispose();
        this.braziers = [];
        this.doors = [];
        this.wax = [];
        super.dispose();
    }
}
