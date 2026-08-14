// src/features/game/entities/Enemy.ts
import * as THREE from "three";
import { SlimeModel } from "./slimeModel";
import { SoundManager } from "../core/SoundManager";

const BOSS_TYPES = new Set(["slime_boss", "husk_boss", "frost_boss", "spore_boss", "void_boss", "cave_warden"]);

const TYPE_BASE_SCALE: Record<string, number> = {
    slime: 1,
    slime_boss: 3,
    husk: 1.15,
    husk_boss: 3.4,
    frostling: 0.9,
    frost_boss: 3.6,
    sporeling: 1.25,
    spore_boss: 4,
    voidling: 1.05,
    void_boss: 4.2,
    cave_warden: 5,
};

const TYPE_COLOR: Record<string, number> = {
    slime: 0x33cc55,
    slime_boss: 0x8b2fc9,
    husk: 0xd4541f,
    husk_boss: 0xff7a2f,
    frostling: 0x7fd8ff,
    frost_boss: 0x3aa0e0,
    sporeling: 0xb072d6,
    spore_boss: 0x7a3fa8,
    voidling: 0x2b2b3d,
    void_boss: 0xff2d78,
    cave_warden: 0x8f3cff,
};

export class Enemy {
    public mesh: THREE.Group;
    public id: string;
    public type: string;
    public health: number = 100;
    public maxHealth: number = 100;

    private targetPosition: THREE.Vector3 = new THREE.Vector3();
    private initialized: boolean = false;

    private aggro: boolean = false;
    private recentlyHitUntil: number = 0;
    private currentScale: number = 1;
    private readonly CALM_SCALE = 1.0;
    private readonly AGGRO_SCALE = 1.35;
    private readonly baseScale: number;
    private readonly baseColor: number;
    private readonly slime: SlimeModel;

    private healthBarBg: THREE.Sprite;
    private healthBarFg: THREE.Sprite;
    private readonly HEALTH_BAR_WIDTH = 1.0;
    private readonly HEALTH_BAR_Y: number;

    constructor(id: string, type: string = "slime") {
        this.id = id;
        this.type = type;
        this.baseScale = TYPE_BASE_SCALE[type] ?? 1;
        this.baseColor = TYPE_COLOR[type] ?? TYPE_COLOR.slime;
        this.mesh = new THREE.Group();

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({
            color: this.baseColor,
            roughness: 0.7,
            metalness: 0.1,
            visible: false,
        });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.y = 0.5 * this.baseScale;
        cube.scale.setScalar(this.baseScale);

        this.mesh.add(cube);

        this.slime = new SlimeModel(this.baseColor, BOSS_TYPES.has(type));
        this.slime.group.scale.setScalar(this.baseScale);
        this.mesh.add(this.slime.group);

        this.HEALTH_BAR_Y = 1.6 * this.baseScale;

        this.healthBarBg = new THREE.Sprite(new THREE.SpriteMaterial({
            color: 0x330000, transparent: true, opacity: 0.85, depthTest: false,
        }));
        this.healthBarBg.scale.set(this.HEALTH_BAR_WIDTH, 0.12, 1);
        this.healthBarBg.position.set(0, this.HEALTH_BAR_Y, 0);
        this.healthBarBg.renderOrder = 999;
        this.healthBarBg.visible = false;
        this.mesh.add(this.healthBarBg);

        this.healthBarFg = new THREE.Sprite(new THREE.SpriteMaterial({
            color: 0x33ff33, transparent: true, depthTest: false,
        }));
        this.healthBarFg.scale.set(this.HEALTH_BAR_WIDTH, 0.09, 1);
        this.healthBarFg.position.set(0, this.HEALTH_BAR_Y, 0);
        this.healthBarFg.renderOrder = 1000;
        this.healthBarFg.visible = false;
        this.mesh.add(this.healthBarFg);
    }

    public getHitbox(): THREE.Mesh {
        return this.mesh.children[0] as THREE.Mesh;
    }

    public flashHit() {
        this.recentlyHitUntil = performance.now() + 2500;
        this.slime.flashHit();
    }

    public triggerAttack() {
        this.slime.triggerAttack();
        SoundManager.getInstance().playAt("slime-attack", {
            x: this.mesh.position.x,
            z: this.mesh.position.z,
            volume: 0.7,
            rate: 1.15 - this.baseScale * 0.12,
        });
    }

    public beginCast(seconds: number) {
        this.slime.beginCast(seconds);
    }

    public updateFromNetwork(data: { position: number[]; health: number; maxHealth?: number; targetId?: string | null }) {
        this.targetPosition.set(data.position[0], data.position[1], data.position[2]);
        this.health = data.health;
        if (data.maxHealth !== undefined) this.maxHealth = data.maxHealth;
        if (data.targetId !== undefined) this.aggro = data.targetId !== null;

        if (!this.initialized) {
            this.mesh.position.copy(this.targetPosition);
            this.initialized = true;
        }
    }

    private readDarkness(): number {
        const scene = this.mesh.parent as THREE.Scene | null;
        const fog = scene?.fog;
        if (!fog) return 0.35;

        const color = fog.color;
        return 1 - THREE.MathUtils.clamp(color.r * 0.299 + color.g * 0.587 + color.b * 0.114, 0, 1);
    }

    public update(delta: number, getGroundHeight: (x: number, z: number) => number) {
        const lerpFactor = Math.min(1, delta * 14);
        this.mesh.position.x = THREE.MathUtils.lerp(this.mesh.position.x, this.targetPosition.x, lerpFactor);
        this.mesh.position.z = THREE.MathUtils.lerp(this.mesh.position.z, this.targetPosition.z, lerpFactor);

        const dx = this.targetPosition.x - this.mesh.position.x;
        const dz = this.targetPosition.z - this.mesh.position.z;
        const isMoving = dx * dx + dz * dz > 0.01;
        if (isMoving) this.mesh.rotation.y = Math.atan2(dx, dz);

        const cube = this.getHitbox();
        this.mesh.position.y = getGroundHeight(this.mesh.position.x, this.mesh.position.z);

        const targetScale = this.aggro ? this.AGGRO_SCALE : this.CALM_SCALE;
        this.currentScale = THREE.MathUtils.lerp(this.currentScale, targetScale, Math.min(1, delta * 5));
        const appliedScale = this.currentScale * this.baseScale;
        cube.scale.setScalar(appliedScale);
        cube.position.y = 0.5 * appliedScale;

        this.slime.group.scale.setScalar(appliedScale);
        const landed = this.slime.update(delta, { moving: isMoving, aggro: this.aggro, darkness: this.readDarkness() });

        if (landed) {
            SoundManager.getInstance().playAt("slime-hop", {
                x: this.mesh.position.x,
                z: this.mesh.position.z,
                volume: 0.32,
                rate: 1.2 - this.baseScale * 0.14,
                maxDistance: 34,
            });
        }

        const showBar = this.aggro || performance.now() < this.recentlyHitUntil;
        this.healthBarBg.visible = showBar;
        this.healthBarFg.visible = showBar;
        if (showBar) {
            const fraction = Math.max(0, Math.min(1, this.health / this.maxHealth));
            this.healthBarFg.scale.x = this.HEALTH_BAR_WIDTH * fraction;
            this.healthBarFg.position.x = -(this.HEALTH_BAR_WIDTH / 2) * (1 - fraction);
            const color = fraction > 0.5 ? 0x33ff33 : fraction > 0.25 ? 0xffcc33 : 0xff3333;
            (this.healthBarFg.material as THREE.SpriteMaterial).color.setHex(color);
        }
    }

    dispose(scene: THREE.Scene) {
        this.slime.dispose();
        (this.healthBarBg.material as THREE.Material).dispose();
        (this.healthBarFg.material as THREE.Material).dispose();
        scene.remove(this.mesh);
    }
}
