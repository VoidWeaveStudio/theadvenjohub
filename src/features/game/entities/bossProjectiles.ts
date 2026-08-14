// src/features/game/entities/bossProjectiles.ts
import * as THREE from "three";

const ACID = 0xa8ff4d;
const ACID_DEEP = 0x4f8f14;

interface Projectile {
    mesh: THREE.Mesh;
    trail: THREE.Mesh;
    origin: THREE.Vector3;
    target: THREE.Vector3;
    arc: number;
    elapsed: number;
    duration: number;
    radius: number;
}

interface Marker {
    mesh: THREE.Mesh;
    elapsed: number;
    duration: number;
    radius: number;
    lingering: boolean;
}

export class BossProjectiles {
    private scene: THREE.Scene | null = null;

    private readonly projectiles: Projectile[] = [];
    private readonly markers: Marker[] = [];

    private readonly globGeometry = new THREE.IcosahedronGeometry(0.42, 2);
    private readonly trailGeometry = new THREE.IcosahedronGeometry(0.42, 1);
    private readonly ringGeometry = new THREE.RingGeometry(0.82, 1, 32);

    private readonly globMaterial = new THREE.MeshBasicMaterial({
        color: ACID,
        toneMapped: false,
    });

    private readonly trailMaterial = new THREE.MeshBasicMaterial({
        color: ACID,
        toneMapped: false,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    private readonly markerMaterial = new THREE.MeshBasicMaterial({
        color: ACID,
        toneMapped: false,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    private readonly poolMaterial = new THREE.MeshBasicMaterial({
        color: ACID_DEEP,
        toneMapped: false,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    public setScene(scene: THREE.Scene | null) {
        if (this.scene === scene) return;

        this.clear();
        this.scene = scene;
    }

    public addTelegraph(x: number, z: number, radius: number, windupMs: number, groundY: number) {
        if (!this.scene) return;

        const mesh = new THREE.Mesh(this.ringGeometry, this.markerMaterial.clone());
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, groundY + 0.06, z);
        mesh.scale.setScalar(radius);
        mesh.renderOrder = 5;

        this.scene.add(mesh);
        this.markers.push({ mesh, elapsed: 0, duration: windupMs / 1000, radius, lingering: false });
    }

    public addProjectile(
        origin: THREE.Vector3,
        target: THREE.Vector3,
        travelMs: number,
        radius: number,
        lobbed: boolean
    ) {
        if (!this.scene) return;

        const mesh = new THREE.Mesh(this.globGeometry, this.globMaterial);
        mesh.position.copy(origin);
        mesh.scale.setScalar(Math.max(0.6, radius * 0.32));
        this.scene.add(mesh);

        const trail = new THREE.Mesh(this.trailGeometry, this.trailMaterial);
        trail.position.copy(origin);
        trail.scale.setScalar(Math.max(1.1, radius * 0.62));
        this.scene.add(trail);

        this.projectiles.push({
            mesh,
            trail,
            origin: origin.clone(),
            target: target.clone(),
            arc: lobbed ? Math.max(6, origin.distanceTo(target) * 0.28) : origin.distanceTo(target) * 0.06,
            elapsed: 0,
            duration: Math.max(0.12, travelMs / 1000),
            radius,
        });
    }

    public addPool(x: number, z: number, radius: number, durationMs: number, groundY: number) {
        if (!this.scene) return;

        const mesh = new THREE.Mesh(this.ringGeometry, this.poolMaterial.clone());
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, groundY + 0.05, z);
        mesh.scale.setScalar(radius);
        mesh.renderOrder = 4;

        this.scene.add(mesh);
        this.markers.push({ mesh, elapsed: 0, duration: durationMs / 1000, radius, lingering: true });
    }

    public update(delta: number) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            projectile.elapsed += delta;

            const t = Math.min(1, projectile.elapsed / projectile.duration);
            const height = Math.sin(t * Math.PI) * projectile.arc;

            projectile.mesh.position.lerpVectors(projectile.origin, projectile.target, t);
            projectile.mesh.position.y += height;
            projectile.mesh.rotation.x += delta * 6;
            projectile.mesh.rotation.z += delta * 4.5;

            projectile.trail.position.copy(projectile.mesh.position);
            (projectile.trail.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - t * 0.4);

            if (t < 1) continue;

            this.scene?.remove(projectile.mesh);
            this.scene?.remove(projectile.trail);
            this.projectiles.splice(i, 1);
        }

        for (let i = this.markers.length - 1; i >= 0; i--) {
            const marker = this.markers[i];
            marker.elapsed += delta;

            const t = Math.min(1, marker.elapsed / marker.duration);
            const material = marker.mesh.material as THREE.MeshBasicMaterial;

            if (marker.lingering) {
                material.opacity = 0.42 * (1 - Math.pow(t, 3));
                marker.mesh.scale.setScalar(marker.radius * (1 + Math.sin(marker.elapsed * 3) * 0.02));
            } else {
                material.opacity = 0.25 + t * 0.55;
                marker.mesh.scale.setScalar(marker.radius * (0.35 + t * 0.65));
            }

            if (t < 1) continue;

            this.scene?.remove(marker.mesh);
            material.dispose();
            this.markers.splice(i, 1);
        }
    }

    public clear() {
        for (const projectile of this.projectiles) {
            this.scene?.remove(projectile.mesh);
            this.scene?.remove(projectile.trail);
        }

        for (const marker of this.markers) {
            this.scene?.remove(marker.mesh);
            (marker.mesh.material as THREE.Material).dispose();
        }

        this.projectiles.length = 0;
        this.markers.length = 0;
    }

    public dispose() {
        this.clear();
        this.globGeometry.dispose();
        this.trailGeometry.dispose();
        this.ringGeometry.dispose();
        this.globMaterial.dispose();
        this.trailMaterial.dispose();
        this.markerMaterial.dispose();
        this.poolMaterial.dispose();
    }
}
