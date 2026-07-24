//src\features\game\entities\Enemy.ts
import * as THREE from "three";

export class Enemy {
    public mesh: THREE.Group;
    public id: string;
    public health: number = 100;
    public maxHealth: number = 100;

    private targetPosition: THREE.Vector3 = new THREE.Vector3();
    private initialized: boolean = false;
    private flashTimeout: ReturnType<typeof setTimeout> | null = null;

    private aggro: boolean = false;
    private recentlyHitUntil: number = 0;
    private moveTime: number = 0;
    private currentScale: number = 1;
    private attackFlashUntil: number = 0;
    private readonly CALM_SCALE = 1.0;
    private readonly AGGRO_SCALE = 1.35;

    private healthBarBg: THREE.Sprite;
    private healthBarFg: THREE.Sprite;
    private readonly HEALTH_BAR_WIDTH = 1.0;
    private readonly HEALTH_BAR_Y = 1.6;

    constructor(id: string) {
        this.id = id;
        this.mesh = new THREE.Group();

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({
            color: 0xff3333,
            roughness: 0.7,
            metalness: 0.1
        });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.y = 0.5;
        cube.castShadow = true;
        cube.receiveShadow = true;

        this.mesh.add(cube);

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
        const cube = this.getHitbox();
        if (cube.material instanceof THREE.MeshStandardMaterial) {
            cube.material.color.setHex(0xffffff);
            if (this.flashTimeout) clearTimeout(this.flashTimeout);
            this.flashTimeout = setTimeout(() => {
                if (cube.material instanceof THREE.MeshStandardMaterial) {
                    cube.material.color.setHex(0xff3333);
                }
            }, 100);
        }
        this.recentlyHitUntil = performance.now() + 2500;
    }

    public triggerAttack() {
        this.attackFlashUntil = performance.now() + 200;
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

    public update(delta: number, getGroundHeight: (x: number, z: number) => number) {
        const lerpFactor = Math.min(1, delta * 14);
        this.mesh.position.x = THREE.MathUtils.lerp(this.mesh.position.x, this.targetPosition.x, lerpFactor);
        this.mesh.position.z = THREE.MathUtils.lerp(this.mesh.position.z, this.targetPosition.z, lerpFactor);

        const dx = this.targetPosition.x - this.mesh.position.x;
        const dz = this.targetPosition.z - this.mesh.position.z;
        const isMoving = dx * dx + dz * dz > 0.01;
        if (isMoving) {
            this.mesh.rotation.y = Math.atan2(dx, dz);
            this.moveTime += delta * 9;
        }

        const cube = this.getHitbox();

        const bob = isMoving ? Math.abs(Math.sin(this.moveTime)) * 0.06 : 0;
        this.mesh.position.y = getGroundHeight(this.mesh.position.x, this.mesh.position.z) + bob;

        const targetScale = this.aggro ? this.AGGRO_SCALE : this.CALM_SCALE;
        this.currentScale = THREE.MathUtils.lerp(this.currentScale, targetScale, Math.min(1, delta * 5));
        cube.scale.setScalar(this.currentScale);
        cube.position.y = 0.5 * this.currentScale;

        if (cube.material instanceof THREE.MeshStandardMaterial) {
            const attacking = performance.now() < this.attackFlashUntil;
            cube.material.emissive.setHex(attacking ? 0xff6600 : 0x000000);
            cube.material.emissiveIntensity = attacking ? 1.5 : 0;
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
        if (this.flashTimeout) clearTimeout(this.flashTimeout);
        (this.healthBarBg.material as THREE.Material).dispose();
        (this.healthBarFg.material as THREE.Material).dispose();
        scene.remove(this.mesh);
    }
}
