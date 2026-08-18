// src/features/game/world/locations/events/EventRoom.ts
import * as THREE from "three";
import { TowerFloor } from "../tower/TowerFloor";
import { ResourceManager } from "../../../core/ResourceManager";
import { AssetBin } from "../../AssetBin";
import { EVENT_EXIT_INTERACTION } from "../../../data/eventDoors";
import { EventRoomTheme } from "./roomThemes";
import { createCliffMaterial, createGroundMaterial, createParticleTexture } from "./roomTextures";
import { makeRandom } from "./lobbyTextures";
import { isLowEndDevice } from "./lobbyLayout";

const EXIT_ANGLE = Math.PI;
const EXIT_INSET = 4.5;
const SHADOW_EXTENT = 56;

interface ParticleField {
    points: THREE.Points;
    velocities: Float32Array;
    material: THREE.PointsMaterial;
    ceiling: number;
    floor: number;
    rising: boolean;
}

export abstract class EventRoom extends TowerFloor {
    protected readonly bin = new AssetBin();
    protected readonly random: () => number;
    protected readonly theme: EventRoomTheme;

    protected groundMaterial!: THREE.MeshStandardMaterial;
    protected cliffMaterial!: THREE.MeshStandardMaterial;
    protected keyLight: THREE.DirectionalLight | null = null;

    private particles: ParticleField | null = null;
    private exitVeil: THREE.MeshBasicMaterial | null = null;
    private exitLight: THREE.PointLight | null = null;
    private elapsed = 0;

    constructor(theme: EventRoomTheme, seed: number) {
        super(theme.locationId, theme.name);
        this.theme = theme;
        this.random = makeRandom(seed);
        this.maxPlayerRadius = theme.radius - 2;
        this.cameraBounds = { radius: theme.radius + 1, minY: -20, maxY: theme.wallHeight + 24 };
    }

    create(rm: ResourceManager): void {
        this.buildAtmosphere();
        this.buildGround();
        this.buildPerimeter();
        this.buildExitGate();
        this.buildParticles();
        this.decorate(rm);
    }

    protected abstract decorate(rm: ResourceManager): void;

    protected buildAtmosphere() {
        const sky = new THREE.Color(this.theme.sky);
        this.scene.background = sky;
        this.scene.fog = new THREE.FogExp2(this.theme.sky, this.theme.fogDensity);

        this.scene.add(new THREE.AmbientLight(this.theme.ambient, this.theme.ambientIntensity));
        this.scene.add(new THREE.HemisphereLight(this.theme.hemiSky, this.theme.hemiGround, this.theme.hemiIntensity));

        const key = new THREE.DirectionalLight(this.theme.keyColor, this.theme.keyIntensity);
        key.position.set(38, this.theme.keyElevation, -30);
        key.target.position.set(0, 0, 0);
        key.castShadow = true;
        key.shadow.mapSize.set(isLowEndDevice() ? 1024 : 2048, isLowEndDevice() ? 1024 : 2048);
        key.shadow.camera.left = -SHADOW_EXTENT;
        key.shadow.camera.right = SHADOW_EXTENT;
        key.shadow.camera.top = SHADOW_EXTENT;
        key.shadow.camera.bottom = -SHADOW_EXTENT;
        key.shadow.camera.near = 5;
        key.shadow.camera.far = 260;
        key.shadow.bias = -0.0003;
        key.shadow.normalBias = 0.04;
        key.shadow.camera.updateProjectionMatrix();
        this.scene.add(key);
        this.scene.add(key.target);
        this.keyLight = key;

        const bounce = new THREE.DirectionalLight(this.theme.accent, 0.3);
        bounce.position.set(-44, 18, 40);
        this.scene.add(bounce);
    }

    protected buildGround() {
        this.groundMaterial = createGroundMaterial(this.bin, this.theme, this.random);

        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(this.theme.radius + 3, 96),
            this.groundMaterial
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.matrixAutoUpdate = false;
        floor.updateMatrix();
        this.scene.add(floor);

        const rim = new THREE.Mesh(
            new THREE.RingGeometry(this.theme.radius - 2.4, this.theme.radius - 1.2, 96),
            this.bin.material(new THREE.MeshBasicMaterial({
                color: this.theme.accent,
                transparent: true,
                opacity: 0.24,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            }))
        );
        rim.rotation.x = -Math.PI / 2;
        rim.position.y = 0.04;
        rim.matrixAutoUpdate = false;
        rim.updateMatrix();
        this.scene.add(rim);
    }

    protected buildPerimeter() {
        this.cliffMaterial = createCliffMaterial(this.bin, this.theme, this.random);

        const wall = new THREE.Mesh(
            new THREE.CylinderGeometry(
                this.theme.radius + 3,
                this.theme.radius + 5,
                this.theme.wallHeight,
                80,
                1,
                true
            ),
            this.cliffMaterial
        );
        wall.position.y = this.theme.wallHeight / 2;
        wall.receiveShadow = true;
        wall.matrixAutoUpdate = false;
        wall.updateMatrix();
        this.scene.add(wall);

        const crown = new THREE.Mesh(
            new THREE.TorusGeometry(this.theme.radius + 3, 0.9, 8, 80),
            this.cliffMaterial
        );
        crown.rotation.x = Math.PI / 2;
        crown.position.y = this.theme.wallHeight;
        crown.matrixAutoUpdate = false;
        crown.updateMatrix();
        this.scene.add(crown);

        this.collisionGrid.insertRingWall(this.theme.radius + 2.4, 1.6, 0, this.theme.wallHeight);

        const buttress = this.bin.geometry(new THREE.BoxGeometry(3.4, this.theme.wallHeight * 0.82, 3.4));
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + Math.PI / 12;
            const pier = new THREE.Mesh(buttress, this.cliffMaterial);
            pier.position.set(
                Math.sin(angle) * (this.theme.radius + 1.4),
                this.theme.wallHeight * 0.41,
                -Math.cos(angle) * (this.theme.radius + 1.4)
            );
            pier.rotation.y = -angle;
            pier.castShadow = true;
            this.scene.add(pier);
        }
    }

    protected buildExitGate() {
        const radius = this.theme.radius - EXIT_INSET;
        const group = new THREE.Group();
        group.position.set(Math.sin(EXIT_ANGLE) * radius, 0, -Math.cos(EXIT_ANGLE) * radius);
        group.rotation.y = -EXIT_ANGLE;

        const stone = this.bin.material(new THREE.MeshStandardMaterial({
            color: this.theme.wallAccent,
            roughness: 0.72,
            metalness: 0.16,
        }));
        const gold = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xd8b46a,
            roughness: 0.26,
            metalness: 0.92,
        }));

        for (const side of [-1, 1]) {
            const jamb = new THREE.Mesh(new THREE.BoxGeometry(1.7, 10.5, 1.9), stone);
            jamb.position.set(side * 3.9, 5.25, 0);
            jamb.castShadow = true;
            group.add(jamb);

            const base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.7, 2.6), gold);
            base.position.set(side * 3.9, 0.35, 0);
            group.add(base);
        }

        const arch = new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.85, 10, 26, Math.PI), stone);
        arch.position.y = 10.5;
        arch.castShadow = true;
        group.add(arch);

        const keystone = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.9, 2.2), gold);
        keystone.position.y = 14.1;
        group.add(keystone);

        this.exitVeil = this.bin.material(new THREE.MeshBasicMaterial({
            color: 0xffe6bc,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));

        const veil = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 10.4), this.exitVeil);
        veil.position.set(0, 5.2, -0.2);
        veil.renderOrder = 4;
        group.add(veil);

        const dome = new THREE.Mesh(new THREE.CircleGeometry(3.85, 26, 0, Math.PI), this.exitVeil);
        dome.position.set(0, 10.5, -0.2);
        group.add(dome);

        const step = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 3.2), gold);
        step.position.set(0, 0.15, 2);
        group.add(step);

        this.exitLight = new THREE.PointLight(0xffdca8, 26, 40, 2);
        this.exitLight.position.set(0, 6, 1.5);
        group.add(this.exitLight);

        group.userData.interactionId = EVENT_EXIT_INTERACTION;
        group.userData.interactionRadius = 6.5;

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(group.position.x, group.position.z, 11, 2.2, group.rotation.y, 0, 12);
    }

    protected buildParticles() {
        if (isLowEndDevice()) return;

        const count = this.theme.particleCount;
        const rising = this.theme.particle === "ember" || this.theme.particle === "bubble" || this.theme.particle === "spark";
        const ceiling = this.theme.wallHeight + 6;

        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            this.seedParticle(positions, velocities, i, rising, ceiling);
            positions[i * 3 + 1] = this.random() * ceiling;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = this.bin.material(new THREE.PointsMaterial({
            color: this.theme.particleColor,
            size: this.theme.particle === "rain" ? 0.14 : this.theme.particle === "bubble" ? 0.34 : 0.24,
            map: createParticleTexture(this.bin, this.theme.particle !== "rain"),
            transparent: true,
            opacity: this.theme.particle === "dust" ? 0.4 : 0.7,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        this.scene.add(points);

        this.particles = { points, velocities, material, ceiling, floor: 0, rising };
    }

    private seedParticle(positions: Float32Array, velocities: Float32Array, index: number, rising: boolean, ceiling: number) {
        const angle = this.random() * Math.PI * 2;
        const distance = Math.sqrt(this.random()) * this.theme.radius;
        const i3 = index * 3;

        positions[i3] = Math.cos(angle) * distance;
        positions[i3 + 1] = rising ? 0.2 : ceiling;
        positions[i3 + 2] = Math.sin(angle) * distance;

        const drift = this.theme.particle === "rain" ? 0.4 : 1.1;
        velocities[i3] = (this.random() - 0.5) * drift;
        velocities[i3 + 2] = (this.random() - 0.5) * drift;

        if (rising) {
            velocities[i3 + 1] = 0.9 + this.random() * 2.2;
        } else if (this.theme.particle === "rain") {
            velocities[i3 + 1] = -(14 + this.random() * 9);
        } else if (this.theme.particle === "snow") {
            velocities[i3 + 1] = -(0.7 + this.random() * 1.1);
        } else {
            velocities[i3 + 1] = -(0.4 + this.random() * 0.9);
        }
    }

    protected updateParticles(delta: number) {
        const field = this.particles;
        if (!field) return;

        const attribute = field.points.geometry.getAttribute("position") as THREE.BufferAttribute;
        const positions = attribute.array as Float32Array;
        const count = positions.length / 3;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            positions[i3] += (field.velocities[i3] + Math.sin(this.elapsed * 0.7 + i) * 0.3) * delta;
            positions[i3 + 1] += field.velocities[i3 + 1] * delta;
            positions[i3 + 2] += (field.velocities[i3 + 2] + Math.cos(this.elapsed * 0.6 + i) * 0.3) * delta;

            const beyond = field.rising
                ? positions[i3 + 1] > field.ceiling
                : positions[i3 + 1] < field.floor;

            if (beyond) this.seedParticle(positions, field.velocities, i, field.rising, field.ceiling);
        }

        attribute.needsUpdate = true;
    }

    override update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);
        this.elapsed += delta;

        this.updateParticles(delta);

        if (this.exitVeil) {
            this.exitVeil.opacity = 0.44 + Math.sin(this.elapsed * 1.6) * 0.1;
        }
        if (this.exitLight) {
            this.exitLight.intensity = 24 + Math.sin(this.elapsed * 2.1) * 4;
        }

        this.trackShadowCamera(playerPosition);
    }

    private trackShadowCamera(playerPosition: THREE.Vector3) {
        const light = this.keyLight;
        if (!light) return;

        const texel = (SHADOW_EXTENT * 2) / light.shadow.mapSize.width;
        const x = Math.round(playerPosition.x / texel) * texel;
        const z = Math.round(playerPosition.z / texel) * texel;

        light.target.position.set(x, 0, z);
        light.position.set(x + 38, this.theme.keyElevation, z - 30);
        light.target.updateMatrixWorld();
    }

    getSpawnPoint(): THREE.Vector3 {
        const radius = this.theme.radius - EXIT_INSET - 9;
        return new THREE.Vector3(Math.sin(EXIT_ANGLE) * radius, 2, -Math.cos(EXIT_ANGLE) * radius);
    }

    dispose() {
        this.particles = null;
        this.exitVeil = null;
        this.exitLight = null;
        this.keyLight = null;
        super.dispose();
        this.bin.dispose();
    }
}
