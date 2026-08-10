// src/features/game/world/locations/tower/floors/FactionGateRoom.ts
import * as THREE from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";
import { tokenTextureCache } from "../../../../utils/TokenTextureCache";
import { createRoomConsole, type RoomConsole } from "./roomConsole";
import { BuildPlot } from "../../../building/BuildPlot";
import { FACTION_PLOT_SIZE } from "../../../building/BuildLayout";

const CONSOLE_OFFSET = 6;
const BANNER_DISTANCE = 10;

export class FactionGateRoom extends TowerFloor {
    public readonly factionId: string;
    public readonly plot: BuildPlot;

    private factionName: string = "Faction";
    private factionImage: string | null = null;
    private bannerMesh: THREE.Mesh | null = null;
    private nameSprite: THREE.Sprite | null = null;
    private console: RoomConsole | null = null;

    constructor(factionId: string) {
        super(`faction-gate-${factionId}`, "Faction Lot");
        this.factionId = factionId;
        this.maxPlayerRadius = FACTION_PLOT_SIZE;
        this.plot = new BuildPlot(this.scene, FACTION_PLOT_SIZE);
    }

    public setFactionInfo(name: string, image: string | null, symbol: string | null) {
        this.factionName = symbol ? `${name} ($${symbol})` : name;
        this.factionImage = image;
        this.refreshBanner();
    }

    create(_rm: ResourceManager): void {
        this.plot.create();

        this.collisionGrid = this.plot.collisionGrid;
        this.terrain = { getHeightAt: (x, z) => this.plot.getHeightAt(x, z) };

        this.buildBanner();

        this.console = createRoomConsole(new THREE.Color(0x66ccff));
        this.console.group.position.set(CONSOLE_OFFSET, 0, -CONSOLE_OFFSET);
        this.console.group.rotation.y = -Math.PI / 4;
        this.scene.add(this.console.group);
        this.plot.collisionGrid.insert(new THREE.Box3().setFromObject(this.console.group));
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);
        this.console?.update(delta);
        this.plot.followViewer(playerPosition.x, playerPosition.z);
    }

    public override getInteractables(): THREE.Object3D[] {
        const interactables = super.getInteractables();
        if (this.console) interactables.push(this.console.group);
        return interactables;
    }

    getSpawnPoint(): THREE.Vector3 {
        return new THREE.Vector3(0, this.plot.getHeightAt(0, 4), 4);
    }

    private buildBanner() {
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(4.4, 4.4, 0.15),
            new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.5, metalness: 0.5 })
        );
        frame.position.set(0, 4.2, -BANNER_DISTANCE);
        frame.castShadow = true;
        this.scene.add(frame);

        const banner = new THREE.Mesh(
            new THREE.PlaneGeometry(3.8, 3.8),
            new THREE.MeshStandardMaterial({ color: 0x333844, roughness: 0.6 })
        );
        banner.position.set(0, 4.2, -BANNER_DISTANCE + 0.09);
        this.scene.add(banner);
        this.bannerMesh = banner;

        this.nameSprite = this.createNameSprite(this.factionName);
        this.nameSprite.position.set(0, 1.8, -BANNER_DISTANCE + 0.15);
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
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 12;
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
        sprite.scale.set(4, 0.75, 1);
        return sprite;
    }

    private refreshBanner() {
        if (this.nameSprite) {
            this.scene.remove(this.nameSprite);
            (this.nameSprite.material as THREE.SpriteMaterial).map?.dispose();
            (this.nameSprite.material as THREE.Material).dispose();
            this.nameSprite = this.createNameSprite(this.factionName);
            this.nameSprite.position.set(0, 1.8, -BANNER_DISTANCE + 0.15);
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
            this.nameSprite = null;
        }

        this.plot.dispose();
        super.dispose();
    }
}
