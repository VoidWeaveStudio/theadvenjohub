// src/features/game/world/locations/tower/floors/PersonalRoom.ts
import * as THREE from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";
import { hashString } from "./token-gates/galaxy/GalaxyLayout";
import { createRoomConsole, type RoomConsole } from "./roomConsole";

const ROOM_HALF = 11;
const ROOM_HEIGHT = 7.5;

export const PERSONAL_ROOM_PREFIX = "player-room-";

export class PersonalRoom extends TowerFloor {
    public readonly ownerUserId: string;
    private hue: number;
    private nameSprite: THREE.Sprite | null = null;
    private ownerName = "Your Room";
    private console: RoomConsole | null = null;

    constructor(ownerUserId: string) {
        super(`${PERSONAL_ROOM_PREFIX}${ownerUserId}`, "Personal Room");
        this.ownerUserId = ownerUserId;
        this.maxPlayerRadius = ROOM_HALF + 4;
        this.hue = (hashString(ownerUserId) % 360) / 360;
    }

    public setOwnerName(name: string) {
        this.ownerName = name;
        this.refreshNameplate();
    }

    create(_rm: ResourceManager): void {
        const accent = new THREE.Color().setHSL(this.hue, 0.62, 0.55);
        const bg = new THREE.Color().setHSL(this.hue, 0.35, 0.06);

        this.scene.background = bg;
        this.scene.fog = new THREE.FogExp2(bg, 0.014);

        this.scene.add(new THREE.AmbientLight(0x556074, 0.5));
        this.scene.add(new THREE.HemisphereLight(accent.getHex(), 0x191d26, 0.55));

        const key = new THREE.DirectionalLight(0xfff2d8, 1.0);
        key.position.set(8, 15, 7);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.left = -ROOM_HALF;
        key.shadow.camera.right = ROOM_HALF;
        key.shadow.camera.top = ROOM_HALF;
        key.shadow.camera.bottom = -ROOM_HALF;
        key.shadow.camera.near = 2;
        key.shadow.camera.far = 48;
        this.scene.add(key);
        this.scene.add(key.target);

        this.buildShell(accent);
        this.buildNameplate();
        this.createCentralCrystal();
        this.centralCrystal.userData.interactionId = "room-portal";

        this.console = createRoomConsole(accent);
        this.console.group.position.set(ROOM_HALF - 3, 0, -ROOM_HALF + 3);
        this.console.group.rotation.y = -Math.PI / 4;
        this.scene.add(this.console.group);
        this.collisionGrid.insert(new THREE.Box3().setFromObject(this.console.group));
    }

    private buildShell(accent: THREE.Color) {
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(ROOM_HALF * 2, ROOM_HALF * 2),
            new THREE.MeshStandardMaterial({ color: 0x1e222b, roughness: 0.85, metalness: 0.08 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x2a303c, roughness: 0.88, metalness: 0.05 });
        const trimMaterial = new THREE.MeshStandardMaterial({
            color: accent.getHex(),
            emissive: accent.getHex(),
            emissiveIntensity: 0.9,
            roughness: 0.4,
            metalness: 0.5,
        });

        const walls: Array<{ x: number; z: number; rotY: number }> = [
            { x: 0, z: -ROOM_HALF, rotY: 0 },
            { x: 0, z: ROOM_HALF, rotY: 0 },
            { x: -ROOM_HALF, z: 0, rotY: Math.PI / 2 },
            { x: ROOM_HALF, z: 0, rotY: Math.PI / 2 },
        ];

        for (const def of walls) {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(ROOM_HALF * 2, ROOM_HEIGHT, 0.9), wallMaterial);
            wall.position.set(def.x, ROOM_HEIGHT / 2, def.z);
            wall.rotation.y = def.rotY;
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.scene.add(wall);

            const trim = new THREE.Mesh(new THREE.BoxGeometry(ROOM_HALF * 2, 0.1, 1.0), trimMaterial);
            trim.position.set(def.x, ROOM_HEIGHT - 0.4, def.z);
            trim.rotation.y = def.rotY;
            this.scene.add(trim);

            const box = new THREE.Box3().setFromObject(wall);
            box.expandByScalar(0.4);
            this.collisionGrid.insert(box);
        }

        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(ROOM_HALF * 2, ROOM_HALF * 2),
            new THREE.MeshStandardMaterial({ color: 0x0d0f14, roughness: 0.92 })
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = ROOM_HEIGHT;
        this.scene.add(ceiling);

        const lantern = new THREE.PointLight(accent.getHex(), 4, 26, 1.6);
        lantern.position.set(0, ROOM_HEIGHT - 1.2, 0);
        this.scene.add(lantern);
    }

    private buildNameplate() {
        this.nameSprite = this.createNameSprite(this.ownerName);
        this.nameSprite.position.set(0, 3.4, -ROOM_HALF + 0.7);
        this.scene.add(this.nameSprite);
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
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
        sprite.scale.set(5, 0.94, 1);
        return sprite;
    }

    private refreshNameplate() {
        if (!this.nameSprite) return;
        this.scene.remove(this.nameSprite);
        (this.nameSprite.material.map as THREE.Texture | null)?.dispose();
        this.nameSprite.material.dispose();
        this.buildNameplate();
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

    dispose() {
        this.console?.dispose();
        this.console = null;
        if (this.nameSprite) {
            (this.nameSprite.material.map as THREE.Texture | null)?.dispose();
            this.nameSprite.material.dispose();
        }
        super.dispose();
    }
}
