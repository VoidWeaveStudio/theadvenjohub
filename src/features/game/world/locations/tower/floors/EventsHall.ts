// src/features/game/world/locations/tower/floors/EventsHall.ts
import * as THREE from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";

const ROOM_HALF = 35;
const ROOM_HEIGHT = 13;

interface AccentLight {
    light: THREE.PointLight;
    bulb: THREE.Mesh;
    baseIntensity: number;
    phase: number;
}

interface CabinetScreen {
    mesh: THREE.Mesh;
    baseIntensity: number;
    phase: number;
}

function createCasinoFloorTexture(): THREE.Texture {
    const size = 512;
    const tiles = 8;
    const tileSize = size / tiles;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    for (let y = 0; y < tiles; y++) {
        for (let x = 0; x < tiles; x++) {
            ctx.fillStyle = (x + y) % 2 === 0 ? "#3b0d16" : "#17151a";
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
    }

    ctx.strokeStyle = "rgba(212,175,80,0.35)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= tiles; i++) {
        ctx.beginPath();
        ctx.moveTo(i * tileSize, 0);
        ctx.lineTo(i * tileSize, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * tileSize);
        ctx.lineTo(size, i * tileSize);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(7, 7);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

const ARENA_RADIUS = 30;
const CANDLE_BASE_HEIGHT = 3.2;

export class EventsHall extends TowerFloor {
    private factionId: string | null = null;
    private factionName: string | null = null;

    private floorMaterial!: THREE.MeshStandardMaterial;
    private accentLights: AccentLight[] = [];
    private cabinetScreens: CabinetScreen[] = [];

    private candle: THREE.Group | null = null;
    private candleBody: THREE.Mesh | null = null;
    private candleWick: THREE.Mesh | null = null;
    private candleLight: THREE.PointLight | null = null;
    private candleMaterial: THREE.MeshStandardMaterial | null = null;
    private candleHealthRatio = 1;
    private candleWave = 0;
    private candleFlash = 0;
    private arenaTerminal: THREE.Group | null = null;

    public getInteractables(): THREE.Object3D[] {
        return [...super.getInteractables(), ...(this.arenaTerminal ? [this.arenaTerminal] : [])];
    }

    constructor() {
        super("tower-events", "Events");
        this.maxPlayerRadius = ROOM_HALF + 5;
    }

    public setFactionContext(factionId: string, factionName: string) {
        this.factionId = factionId;
        this.factionName = factionName;
    }

    public getFactionContext(): { factionId: string | null; factionName: string | null } {
        return { factionId: this.factionId, factionName: this.factionName };
    }

    create(_rm: ResourceManager): void {
        const bgColor = 0x1a0d14;
        this.scene.background = new THREE.Color(bgColor);
        this.scene.fog = new THREE.FogExp2(bgColor, 0.006);

        this.scene.add(new THREE.AmbientLight(0x4a2a3a, 0.4));
        this.scene.add(new THREE.HemisphereLight(0xd8a8ff, 0x2a1018, 0.55));

        const key = new THREE.DirectionalLight(0xfff0d8, 1.15);
        key.position.set(30, 40, 20);
        key.target.position.set(0, 0, 0);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.left = -ROOM_HALF;
        key.shadow.camera.right = ROOM_HALF;
        key.shadow.camera.top = ROOM_HALF;
        key.shadow.camera.bottom = -ROOM_HALF;
        key.shadow.camera.near = 5;
        key.shadow.camera.far = 100;
        this.scene.add(key);
        this.scene.add(key.target);

        this.buildFloor();
        this.buildWalls();
        this.buildCeiling();
        this.buildAccentLights();
        this.buildCabinets();
        this.buildTables();
        this.buildCandle();
        this.buildSpawnGates();
        this.buildArenaTerminal();

        this.createCentralCrystal(new THREE.Vector3(-16, 0, -16));
    }

    private buildCandle() {
        this.candle = new THREE.Group();
        this.candle.position.set(0, 0, 0);

        const plinth = new THREE.Mesh(
            new THREE.CylinderGeometry(2.2, 2.6, 0.5, 24),
            new THREE.MeshStandardMaterial({ color: 0x241018, roughness: 0.6, metalness: 0.35 })
        );
        plinth.position.y = 0.25;
        plinth.receiveShadow = true;
        this.candle.add(plinth);

        const rim = new THREE.Mesh(
            new THREE.TorusGeometry(2.25, 0.09, 8, 32),
            new THREE.MeshStandardMaterial({ color: 0xd4af50, roughness: 0.35, metalness: 0.8 })
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.52;
        this.candle.add(rim);

        this.candleMaterial = new THREE.MeshStandardMaterial({
            color: 0x4ade80,
            emissive: 0x22c55e,
            emissiveIntensity: 1.4,
            roughness: 0.4,
            toneMapped: false,
        });

        this.candleBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, CANDLE_BASE_HEIGHT, 1.6), this.candleMaterial);
        this.candleBody.position.y = 0.5 + CANDLE_BASE_HEIGHT / 2;
        this.candleBody.castShadow = true;
        this.candle.add(this.candleBody);

        this.candleWick = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8),
            new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x4ade80, emissiveIntensity: 3, toneMapped: false })
        );
        this.candleWick.position.y = 0.5 + CANDLE_BASE_HEIGHT + 0.6;
        this.candle.add(this.candleWick);

        this.candleLight = new THREE.PointLight(0x4ade80, 8, 34);
        this.candleLight.position.y = 0.5 + CANDLE_BASE_HEIGHT + 1;
        this.candle.add(this.candleLight);

        this.scene.add(this.candle);

        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(-2.3, 0, -2.3),
            new THREE.Vector3(2.3, 0.6, 2.3)
        ));
    }

    private buildSpawnGates() {
        const gates: [number, number][] = [[0, -26], [26, 0], [0, 26], [-26, 0]];
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a1018, roughness: 0.7, metalness: 0.4 });
        const glowMat = new THREE.MeshStandardMaterial({
            color: 0xa855f7,
            emissive: 0x7e22ce,
            emissiveIntensity: 1.6,
            transparent: true,
            opacity: 0.45,
            toneMapped: false,
        });

        for (const [x, z] of gates) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.lookAt(0, 0, 0);

            const arch = new THREE.Mesh(new THREE.TorusGeometry(3, 0.35, 10, 24, Math.PI), frameMat);
            arch.position.y = 0.1;
            arch.castShadow = true;
            group.add(arch);

            const veil = new THREE.Mesh(new THREE.CircleGeometry(2.8, 24, 0, Math.PI), glowMat);
            veil.position.y = 0.1;
            group.add(veil);

            this.scene.add(group);
        }
    }

    private buildArenaTerminal() {
        const group = new THREE.Group();
        group.position.set(6, 0, -6);
        group.lookAt(0, 0, 0);

        const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.55, 1.5, 12),
            new THREE.MeshStandardMaterial({ color: 0x241018, roughness: 0.5, metalness: 0.5 })
        );
        pillar.position.y = 0.75;
        pillar.castShadow = true;
        group.add(pillar);

        const screen = new THREE.Mesh(
            new THREE.PlaneGeometry(0.9, 0.6),
            new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xd4af50, emissiveIntensity: 2, toneMapped: false })
        );
        screen.position.set(0, 1.45, 0.28);
        screen.rotation.x = -0.5;
        group.add(screen);

        const glow = new THREE.PointLight(0xffd166, 2.5, 8);
        glow.position.y = 1.8;
        group.add(glow);

        group.userData.interactionId = "arena-terminal";
        this.scene.add(group);
        this.arenaTerminal = group;

        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(-0.6, 0, -0.6),
            new THREE.Vector3(0.6, 1.6, 0.6)
        ).translate(group.position));
    }

    public setCandleState(healthRatio: number, wave: number) {
        this.candleHealthRatio = Math.max(0, Math.min(1, healthRatio));
        this.candleWave = wave;
    }

    public flashCandle() {
        this.candleFlash = 1;
    }

    private buildFloor() {
        this.floorMaterial = new THREE.MeshStandardMaterial({
            map: createCasinoFloorTexture(),
            roughness: 0.55,
            metalness: 0.1,
        });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_HALF * 2, ROOM_HALF * 2), this.floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
    }

    private buildWalls() {
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a1420, roughness: 0.85, metalness: 0.05 });
        const trimMat = new THREE.MeshStandardMaterial({ color: 0xd4af50, roughness: 0.35, metalness: 0.75 });
        const wallThickness = 1;

        const wallDefs = [
            { w: ROOM_HALF * 2, h: ROOM_HEIGHT, pos: [0, ROOM_HEIGHT / 2, -ROOM_HALF] as const, rotY: 0 },
            { w: ROOM_HALF * 2, h: ROOM_HEIGHT, pos: [0, ROOM_HEIGHT / 2, ROOM_HALF] as const, rotY: 0 },
            { w: ROOM_HALF * 2, h: ROOM_HEIGHT, pos: [-ROOM_HALF, ROOM_HEIGHT / 2, 0] as const, rotY: Math.PI / 2 },
            { w: ROOM_HALF * 2, h: ROOM_HEIGHT, pos: [ROOM_HALF, ROOM_HEIGHT / 2, 0] as const, rotY: Math.PI / 2 },
        ];

        for (const def of wallDefs) {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(def.w, def.h, wallThickness), wallMat);
            wall.position.set(def.pos[0], def.pos[1], def.pos[2]);
            wall.rotation.y = def.rotY;
            wall.receiveShadow = true;
            wall.castShadow = true;
            this.scene.add(wall);

            const trim = new THREE.Mesh(new THREE.BoxGeometry(def.w, 0.6, wallThickness + 0.1), trimMat);
            trim.position.set(def.pos[0], 0.3, def.pos[2]);
            trim.rotation.y = def.rotY;
            this.scene.add(trim);

            const box = new THREE.Box3().setFromObject(wall);
            box.expandByScalar(0.5);
            this.collisionGrid.insert(box);
        }
    }

    private buildCeiling() {
        const ceilMat = new THREE.MeshStandardMaterial({ color: 0x120a10, roughness: 0.9, metalness: 0.0 });
        const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_HALF * 2, ROOM_HALF * 2), ceilMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = ROOM_HEIGHT;
        this.scene.add(ceiling);
    }

    private buildAccentLights() {
        const colors = [0xa855f7, 0xd4af50, 0xa855f7, 0xd4af50];
        const positions: [number, number][] = [[-20, -20], [20, -20], [-20, 20], [20, 20]];

        positions.forEach(([x, z], i) => {
            const color = colors[i % colors.length];
            const light = new THREE.PointLight(color, 3.5, 30, 2);
            light.position.set(x, ROOM_HEIGHT - 1.5, z);
            this.scene.add(light);

            const bulb = new THREE.Mesh(
                new THREE.SphereGeometry(0.25, 12, 12),
                new THREE.MeshBasicMaterial({ color })
            );
            bulb.position.copy(light.position);
            this.scene.add(bulb);

            this.accentLights.push({ light, bulb, baseIntensity: 3.5, phase: Math.random() * Math.PI * 2 });
        });
    }

    private buildCabinets() {
        const count = 6;
        const spacing = 9;
        const startX = -((count - 1) * spacing) / 2;
        const screenColors = [0xff5577, 0x55ffaa, 0x55aaff, 0xffcc55, 0xcc77ff, 0x55ffee];

        for (let i = 0; i < count; i++) {
            const x = startX + i * spacing;
            const z = -ROOM_HALF + 1.1;

            const group = new THREE.Group();
            group.position.set(x, 0, z);

            const body = new THREE.Mesh(
                new THREE.BoxGeometry(1.6, 2.4, 1.0),
                new THREE.MeshStandardMaterial({ color: 0x241018, roughness: 0.5, metalness: 0.4 })
            );
            body.position.y = 1.2;
            body.castShadow = true;
            group.add(body);

            const screenColor = screenColors[i % screenColors.length];
            const screen = new THREE.Mesh(
                new THREE.PlaneGeometry(1.1, 1.3),
                new THREE.MeshStandardMaterial({
                    color: screenColor,
                    emissive: screenColor,
                    emissiveIntensity: 1.4,
                    toneMapped: false,
                })
            );
            screen.position.set(0, 1.5, 0.51);
            group.add(screen);
            this.cabinetScreens.push({ mesh: screen, baseIntensity: 1.4, phase: Math.random() * Math.PI * 2 });

            const trim = new THREE.Mesh(
                new THREE.BoxGeometry(1.7, 0.15, 1.05),
                new THREE.MeshStandardMaterial({ color: 0xd4af50, roughness: 0.35, metalness: 0.75 })
            );
            trim.position.y = 2.42;
            group.add(trim);

            this.scene.add(group);

            const box = new THREE.Box3().setFromObject(body);
            this.collisionGrid.insert(box);
        }
    }

    private buildTables() {
        const feltMat = new THREE.MeshStandardMaterial({ color: 0x0f4d2e, roughness: 0.75, metalness: 0.0 });
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xd4af50, roughness: 0.35, metalness: 0.75 });
        const legMat = new THREE.MeshStandardMaterial({ color: 0x1a1015, roughness: 0.6, metalness: 0.2 });

        const positions: [number, number][] = [[-18, 15], [18, 15]];

        for (const [x, z] of positions) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);

            const top = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.15, 32), feltMat);
            top.position.y = 0.9;
            top.castShadow = true;
            top.receiveShadow = true;
            group.add(top);

            const rim = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.08, 8, 32), rimMat);
            rim.rotation.x = Math.PI / 2;
            rim.position.y = 0.9;
            group.add(rim);

            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.9, 12), legMat);
            leg.position.y = 0.45;
            leg.castShadow = true;
            group.add(leg);

            this.scene.add(group);

            const box = new THREE.Box3(
                new THREE.Vector3(-2.1, 0, -2.1),
                new THREE.Vector3(2.1, 1.0, 2.1)
            ).translate(group.position);
            this.collisionGrid.insert(box);
        }
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        const now = performance.now() * 0.001;
        for (const accent of this.accentLights) {
            accent.light.intensity = accent.baseIntensity + Math.sin(now * 1.2 + accent.phase) * 0.6;
        }
        for (const screen of this.cabinetScreens) {
            const mat = screen.mesh.material as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = screen.baseIntensity + Math.sin(now * 2.4 + screen.phase) * 0.4;
        }

        this.updateCandle(now, delta);
    }

    private updateCandle(now: number, delta: number) {
        if (!this.candleBody || !this.candleMaterial || !this.candleWick || !this.candleLight) return;

        if (this.candleFlash > 0) this.candleFlash = Math.max(0, this.candleFlash - delta * 3);

        const growth = 1 + Math.min(this.candleWave, 20) * 0.06;
        const height = CANDLE_BASE_HEIGHT * growth;
        this.candleBody.scale.set(growth, growth, growth);
        this.candleBody.position.y = 0.5 + height / 2;
        this.candleWick.position.y = 0.5 + height + 0.6;
        this.candleLight.position.y = 0.5 + height + 1;

        const hurt = 1 - this.candleHealthRatio;
        this.candleMaterial.color.setRGB(0.29 + hurt * 0.7, 0.87 - hurt * 0.6, 0.5 - hurt * 0.35);
        this.candleMaterial.emissive.setRGB(0.13 + hurt * 0.8 + this.candleFlash, 0.77 - hurt * 0.55, 0.35 - hurt * 0.25);
        this.candleMaterial.emissiveIntensity = 1.4 + Math.sin(now * 3) * 0.25 + this.candleFlash * 1.5;

        this.candleLight.color.setRGB(0.29 + hurt * 0.7, 0.87 - hurt * 0.6, 0.5 - hurt * 0.35);
        this.candleLight.intensity = 8 * (0.4 + this.candleHealthRatio * 0.6) + this.candleFlash * 4;
    }

    dispose() {
        this.floorMaterial?.map?.dispose();
        this.accentLights = [];
        this.cabinetScreens = [];
        super.dispose();
    }
}
