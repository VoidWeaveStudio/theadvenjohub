// src/features/game/systems/GrenadeSystem.ts
import * as THREE from "three";
import { buildGrenadeModel } from "../entities/defusalWeaponModels";

interface FlyingGrenade {
    id: string;
    mesh: THREE.Group;
    target: THREE.Vector3;
    spin: THREE.Vector3;
}

interface Burst {
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    life: number;
    maxLife: number;
    growth: number;
}

interface Cloud {
    mesh: THREE.Points;
    material: THREE.PointsMaterial;
    until: number;
    fadeIn: number;
}

const BURST_TINT: Record<string, number> = {
    "rug-flash": 0xffffff,
    "fud-cloud": 0x9fb6c8,
    liquidation: 0xff8a3c,
};

export class GrenadeSystem {
    private scene: THREE.Scene | null = null;
    private flying = new Map<string, FlyingGrenade>();
    private bursts: Burst[] = [];
    private clouds: Cloud[] = [];
    private cloudTexture: THREE.Texture | null = null;

    setScene(scene: THREE.Scene) {
        this.clear();
        this.scene = scene;
    }

    private softTexture(): THREE.Texture {
        if (this.cloudTexture) return this.cloudTexture;

        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d")!;
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, "rgba(255,255,255,1)");
        gradient.addColorStop(0.45, "rgba(255,255,255,0.85)");
        gradient.addColorStop(0.78, "rgba(255,255,255,0.3)");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        this.cloudTexture = new THREE.CanvasTexture(canvas);
        return this.cloudTexture;
    }

    spawn(id: string, itemId: string, x: number, y: number, z: number) {
        if (!this.scene || this.flying.has(id)) return;

        const mesh = buildGrenadeModel(itemId);
        mesh.position.set(x, y, z);
        this.scene.add(mesh);

        this.flying.set(id, {
            id,
            mesh,
            target: new THREE.Vector3(x, y, z),
            spin: new THREE.Vector3(6 + Math.random() * 4, 3 + Math.random() * 3, 5 + Math.random() * 4),
        });
    }

    // The server owns the trajectory; the client just chases the last position.
    track(updates: { id: string; itemId: string; x: number; y: number; z: number }[]) {
        for (const update of updates) {
            const existing = this.flying.get(update.id);
            if (!existing) {
                this.spawn(update.id, update.itemId, update.x, update.y, update.z);
                continue;
            }
            existing.target.set(update.x, update.y, update.z);
        }
    }

    burst(id: string, itemId: string, x: number, y: number, z: number) {
        const flying = this.flying.get(id);
        if (flying) {
            flying.mesh.removeFromParent();
            this.flying.delete(id);
        }

        if (!this.scene) return;

        const tint = BURST_TINT[itemId] ?? 0xff8a3c;
        const material = new THREE.MeshBasicMaterial({
            color: tint,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        });

        const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), material);
        mesh.position.set(x, y, z);
        this.scene.add(mesh);

        const maxLife = itemId === "rug-flash" ? 0.45 : 0.7;
        this.bursts.push({
            mesh,
            material,
            life: maxLife,
            maxLife,
            growth: itemId === "liquidation" ? 16 : itemId === "rug-flash" ? 26 : 8,
        });
    }

    // Vision only. Bullets pass straight through — the server never sees this.
    // Density comes from packing large overlapping billboards, biased toward the
    // core so the middle is genuinely opaque rather than a haze.
    cloud(x: number, z: number, radius: number, until: number) {
        if (!this.scene) return;

        const count = 900;
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const bias = Math.random() ** 1.7;
            const distance = bias * radius;
            const height = 0.2 + Math.random() * 4.2 * (1 - bias * 0.45);

            positions[i * 3] = x + Math.cos(angle) * distance;
            positions[i * 3 + 1] = height;
            positions[i * 3 + 2] = z + Math.sin(angle) * distance;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0xd2dae1,
            size: 5.6,
            map: this.softTexture(),
            transparent: true,
            opacity: 0,
            depthWrite: false,
            toneMapped: false,
        });

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        points.renderOrder = 12;
        this.scene.add(points);

        this.clouds.push({ mesh: points, material, until, fadeIn: 0 });
    }

    update(delta: number) {
        for (const grenade of this.flying.values()) {
            grenade.mesh.position.lerp(grenade.target, Math.min(1, delta * 18));
            grenade.mesh.rotation.x += grenade.spin.x * delta;
            grenade.mesh.rotation.y += grenade.spin.y * delta;
            grenade.mesh.rotation.z += grenade.spin.z * delta;
        }

        for (let i = this.bursts.length - 1; i >= 0; i--) {
            const burst = this.bursts[i];
            burst.life -= delta;

            const progress = 1 - burst.life / burst.maxLife;
            burst.mesh.scale.setScalar(0.3 + progress * burst.growth * 0.35);
            burst.material.opacity = Math.max(0, 0.85 * (1 - progress));

            if (burst.life <= 0) {
                burst.mesh.removeFromParent();
                burst.mesh.geometry.dispose();
                burst.material.dispose();
                this.bursts.splice(i, 1);
            }
        }

        const now = Date.now();
        for (let i = this.clouds.length - 1; i >= 0; i--) {
            const cloud = this.clouds[i];
            cloud.fadeIn = Math.min(1, cloud.fadeIn + delta * 1.6);

            const remaining = cloud.until - now;
            const fadeOut = Math.max(0, Math.min(1, remaining / 1500));
            cloud.material.opacity = 0.92 * cloud.fadeIn * fadeOut;

            const positions = cloud.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
            const array = positions.array as Float32Array;
            for (let p = 1; p < array.length; p += 3) array[p] += delta * 0.12;
            positions.needsUpdate = true;

            if (remaining <= 0) {
                cloud.mesh.removeFromParent();
                cloud.mesh.geometry.dispose();
                cloud.material.dispose();
                this.clouds.splice(i, 1);
            }
        }
    }

    clear() {
        for (const grenade of this.flying.values()) grenade.mesh.removeFromParent();
        this.flying.clear();

        for (const burst of this.bursts) {
            burst.mesh.removeFromParent();
            burst.mesh.geometry.dispose();
            burst.material.dispose();
        }
        this.bursts = [];

        for (const cloud of this.clouds) {
            cloud.mesh.removeFromParent();
            cloud.mesh.geometry.dispose();
            cloud.material.dispose();
        }
        this.clouds = [];
    }

    dispose() {
        this.clear();
        this.cloudTexture?.dispose();
        this.cloudTexture = null;
        this.scene = null;
    }
}
