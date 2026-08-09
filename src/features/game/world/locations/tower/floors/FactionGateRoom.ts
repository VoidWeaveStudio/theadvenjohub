// src/features/game/world/locations/tower/floors/FactionGateRoom.ts
import * as THREE from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";
import { tokenTextureCache } from "../../../../utils/TokenTextureCache";
import { createRoomConsole, type RoomConsole } from "./roomConsole";

const ROOM_HALF = 12;
const ROOM_HEIGHT = 8;

export class FactionGateRoom extends TowerFloor {
    public readonly factionId: string;
    private factionName: string = "Faction";
    private factionImage: string | null = null;
    private bannerMesh: THREE.Mesh | null = null;
    private nameSprite: THREE.Sprite | null = null;
    private console: RoomConsole | null = null;

    constructor(factionId: string) {
        super(`faction-gate-${factionId}`, "Faction Gate");
        this.factionId = factionId;
        this.maxPlayerRadius = ROOM_HALF + 4;
    }

    public setFactionInfo(name: string, image: string | null, symbol: string | null) {
        this.factionName = symbol ? `${name} ($${symbol})` : name;
        this.factionImage = image;
        this.refreshBanner();
    }

    public getWallSnap(x: number, z: number): { x: number; y: number; z: number; rotation: number } {
        const inset = 0.12;
        const margin = 1.2;
        const clampRange = ROOM_HALF - margin;
        const mountY = 2.1;

        const distToNorth = Math.abs(z - -ROOM_HALF);
        const distToSouth = Math.abs(z - ROOM_HALF);
        const distToWest = Math.abs(x - -ROOM_HALF);
        const distToEast = Math.abs(x - ROOM_HALF);
        const minDist = Math.min(distToNorth, distToSouth, distToWest, distToEast);

        if (minDist === distToNorth) {
            return { x: THREE.MathUtils.clamp(x, -clampRange, clampRange), y: mountY, z: -ROOM_HALF + inset, rotation: 0 };
        }
        if (minDist === distToSouth) {
            return { x: THREE.MathUtils.clamp(x, -clampRange, clampRange), y: mountY, z: ROOM_HALF - inset, rotation: Math.PI };
        }
        if (minDist === distToWest) {
            return { x: -ROOM_HALF + inset, y: mountY, z: THREE.MathUtils.clamp(z, -clampRange, clampRange), rotation: Math.PI / 2 };
        }
        return { x: ROOM_HALF - inset, y: mountY, z: THREE.MathUtils.clamp(z, -clampRange, clampRange), rotation: -Math.PI / 2 };
    }

    create(_rm: ResourceManager): void {
        const bgColor = 0x14161c;
        this.scene.background = new THREE.Color(bgColor);
        this.scene.fog = new THREE.FogExp2(bgColor, 0.012);

        this.scene.add(new THREE.AmbientLight(0x4a5568, 0.45));
        this.scene.add(new THREE.HemisphereLight(0xc9d8ff, 0x2a2f3a, 0.5));

        const key = new THREE.DirectionalLight(0xfff2d8, 1.1);
        key.position.set(10, 16, 8);
        key.target.position.set(0, 0, 0);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.left = -ROOM_HALF;
        key.shadow.camera.right = ROOM_HALF;
        key.shadow.camera.top = ROOM_HALF;
        key.shadow.camera.bottom = -ROOM_HALF;
        key.shadow.camera.near = 2;
        key.shadow.camera.far = 50;
        this.scene.add(key);
        this.scene.add(key.target);

        this.buildFloor();
        this.buildWalls();
        this.buildCeiling();
        this.buildBanner();

        this.createCentralCrystal();
        this.centralCrystal.userData.interactionId = "room-portal";

        this.console = createRoomConsole(new THREE.Color(0x66ccff));
        this.console.group.position.set(ROOM_HALF - 3, 0, -ROOM_HALF + 3);
        this.console.group.rotation.y = -Math.PI / 4;
        this.scene.add(this.console.group);
        this.collisionGrid.insert(new THREE.Box3().setFromObject(this.console.group));
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);
        this.console?.update(delta);
    }

    public override getInteractables(): THREE.Object3D[] {
        const interactables = super.getInteractables();
        if (this.console) interactables.push(this.console.group);
        return interactables;
    }

    private buildFloor() {
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x22262f, roughness: 0.8, metalness: 0.1 });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_HALF * 2, ROOM_HALF * 2), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
    }

    private buildWalls() {
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.85, metalness: 0.05 });
        const trimMat = new THREE.MeshStandardMaterial({ color: 0x66ccff, roughness: 0.4, metalness: 0.6, emissive: 0x113344, emissiveIntensity: 0.4 });
        const wallThickness = 1;

        const wallDefs = [
            { pos: [0, ROOM_HEIGHT / 2, -ROOM_HALF] as const, rotY: 0 },
            { pos: [0, ROOM_HEIGHT / 2, ROOM_HALF] as const, rotY: 0 },
            { pos: [-ROOM_HALF, ROOM_HEIGHT / 2, 0] as const, rotY: Math.PI / 2 },
            { pos: [ROOM_HALF, ROOM_HEIGHT / 2, 0] as const, rotY: Math.PI / 2 },
        ];

        for (const def of wallDefs) {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(ROOM_HALF * 2, ROOM_HEIGHT, wallThickness), wallMat);
            wall.position.set(def.pos[0], def.pos[1], def.pos[2]);
            wall.rotation.y = def.rotY;
            wall.receiveShadow = true;
            wall.castShadow = true;
            this.scene.add(wall);

            const trim = new THREE.Mesh(new THREE.BoxGeometry(ROOM_HALF * 2, 0.12, wallThickness + 0.1), trimMat);
            trim.position.set(def.pos[0], ROOM_HEIGHT - 0.3, def.pos[2]);
            trim.rotation.y = def.rotY;
            this.scene.add(trim);

            const box = new THREE.Box3().setFromObject(wall);
            box.expandByScalar(0.5);
            this.collisionGrid.insert(box);
        }
    }

    private buildCeiling() {
        const ceilMat = new THREE.MeshStandardMaterial({ color: 0x0e0f13, roughness: 0.9 });
        const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_HALF * 2, ROOM_HALF * 2), ceilMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = ROOM_HEIGHT;
        this.scene.add(ceiling);
    }

    private buildBanner() {
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(4.4, 4.4, 0.15),
            new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.5, metalness: 0.5 })
        );
        frame.position.set(0, 4.2, -ROOM_HALF + 0.55);
        this.scene.add(frame);

        const bannerMat = new THREE.MeshStandardMaterial({ color: 0x333844, roughness: 0.6 });
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), bannerMat);
        banner.position.set(0, 4.2, -ROOM_HALF + 0.63);
        this.scene.add(banner);
        this.bannerMesh = banner;

        this.nameSprite = this.createNameSprite(this.factionName);
        this.nameSprite.position.set(0, 1.8, -ROOM_HALF + 0.7);
        this.scene.add(this.nameSprite);

        this.refreshBanner();
    }

    private createNameSprite(text: string): THREE.Sprite {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 96;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#e5e7eb";
        ctx.font = "bold 42px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(4, 0.75, 1);
        return sprite;
    }

    private refreshBanner() {
        if (this.nameSprite) {
            this.scene.remove(this.nameSprite);
            (this.nameSprite.material as THREE.SpriteMaterial).map?.dispose();
            (this.nameSprite.material as THREE.Material).dispose();
            this.nameSprite = this.createNameSprite(this.factionName);
            this.nameSprite.position.set(0, 1.8, -ROOM_HALF + 0.7);
            this.scene.add(this.nameSprite);
        }

        if (this.bannerMesh && this.factionImage) {
            const url = this.factionImage.startsWith("data:")
                ? this.factionImage
                : `/api/image-proxy?url=${encodeURIComponent(this.factionImage)}`;
            tokenTextureCache.load(url, (tex) => {
                const mat = this.bannerMesh?.material as THREE.MeshStandardMaterial | undefined;
                if (!mat) return;
                mat.map = tex;
                mat.color.set(0xffffff);
                mat.needsUpdate = true;
            });
        }
    }

    dispose() {
        this.console?.dispose();
        this.console = null;
        if (this.nameSprite) {
            (this.nameSprite.material as THREE.SpriteMaterial).map?.dispose();
            (this.nameSprite.material as THREE.Material).dispose();
        }
        super.dispose();
    }
}
