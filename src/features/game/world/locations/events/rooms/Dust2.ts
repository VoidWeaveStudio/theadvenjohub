// src/features/game/world/locations/events/rooms/Dust2.ts
import * as THREE from "three";
import { TowerFloor } from "../../tower/TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";
import { AssetBin } from "../../../AssetBin";
import { EditorSky } from "../../../building/EditorSky";
import { EVENT_EXIT_INTERACTION } from "../../../../data/eventDoors";
import { makeRandom } from "../lobbyTextures";
import { isLowEndDevice } from "../lobbyLayout";
import {
    BOMB_SITE_A,
    BOMB_SITE_B,
    CALLOUTS,
    CONTAINERS,
    CRATES,
    DOORWAYS,
    GROUND_PATCHES,
    MAP_HALF_X,
    MAP_HALF_Z,
    PALMS,
    PLATFORMS,
    PLAYER_LIMIT_RADIUS,
    T_SPAWN,
    WALLS,
    WALL_HEIGHT,
} from "../dust2Layout";

const SUN_ELEVATION = THREE.MathUtils.degToRad(56);
const SUN_AZIMUTH = THREE.MathUtils.degToRad(140);
const SHADOW_EXTENT = 60;

function makeCanvas(size: number) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    return { canvas, ctx: canvas.getContext("2d")! };
}

function repeatTexture(bin: AssetBin, canvas: HTMLCanvasElement, repeat: number): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return bin.texture(texture);
}

export class Dust2 extends TowerFloor {
    public override maxPlayerRadius: number | null = PLAYER_LIMIT_RADIUS;
    public override cameraBounds = { radius: PLAYER_LIMIT_RADIUS, minY: -10, maxY: 60 };

    private readonly bin = new AssetBin();
    private readonly random = makeRandom(0xd05721);

    private sky: EditorSky | null = null;
    private keyLight: THREE.DirectionalLight | null = null;
    private siteMaterials: THREE.MeshBasicMaterial[] = [];
    private elapsed = 0;
    private spawnPoint = new THREE.Vector3(T_SPAWN.x, 2, T_SPAWN.z);

    constructor(id: string = "event-dust2", name: string = "Dust II") {
        super(id, name);
    }

    public setSpawnPoint(x: number, z: number) {
        this.spawnPoint.set(x, 2, z);
    }

    create(_rm: ResourceManager): void {
        this.scene.fog = new THREE.FogExp2(0xd9c39a, 0.0038);

        this.scene.add(new THREE.AmbientLight(0xe8d9bb, 0.62));
        this.scene.add(new THREE.HemisphereLight(0xbfd9ff, 0xc2a273, 0.85));

        this.buildSky();
        this.buildKeyLight();
        this.buildGround();
        this.buildWalls();
        this.buildPlatforms();
        this.buildCrates();
        this.buildCrenellations();
        this.buildDoorways();
        this.buildPalms();
        this.buildContainers();
        this.buildSites();
        this.buildExitGate();
        this.buildSkyline();
    }

    private buildSky() {
        const sunDirection = new THREE.Vector3(
            Math.cos(SUN_ELEVATION) * Math.sin(SUN_AZIMUTH),
            Math.sin(SUN_ELEVATION),
            Math.cos(SUN_ELEVATION) * Math.cos(SUN_AZIMUTH)
        );

        const sky = new EditorSky();
        sky.name = "dust2-sky";
        sky.scale.setScalar(12000);
        sky.renderOrder = -1000;
        sky.frustumCulled = false;

        const uniforms = sky.material.uniforms;
        uniforms.turbidity.value = 8;
        uniforms.rayleigh.value = 1.1;
        uniforms.mieCoefficient.value = 0.006;
        uniforms.mieDirectionalG.value = 0.82;
        uniforms.sunPosition.value.copy(sunDirection).multiplyScalar(1000);
        uniforms.cloudScale.value = 0.0018;
        uniforms.cloudSpeed.value = 0.00003;
        uniforms.cloudCoverage.value = 0.22;
        uniforms.cloudDensity.value = 0.5;
        uniforms.cloudElevation.value = 0.65;
        uniforms.showSunDisc.value = 1;

        this.scene.add(sky);
        this.sky = sky;
    }

    private buildKeyLight() {
        const key = new THREE.DirectionalLight(0xfff0d0, 2.6);
        key.position.set(60, 90, 50);
        key.target.position.set(0, 0, 0);
        key.castShadow = true;
        key.shadow.mapSize.set(isLowEndDevice() ? 1024 : 2048, isLowEndDevice() ? 1024 : 2048);
        key.shadow.camera.left = -SHADOW_EXTENT;
        key.shadow.camera.right = SHADOW_EXTENT;
        key.shadow.camera.top = SHADOW_EXTENT;
        key.shadow.camera.bottom = -SHADOW_EXTENT;
        key.shadow.camera.near = 10;
        key.shadow.camera.far = 320;
        key.shadow.bias = -0.0004;
        key.shadow.normalBias = 0.05;
        key.shadow.camera.updateProjectionMatrix();

        this.scene.add(key);
        this.scene.add(key.target);
        this.keyLight = key;

        const bounce = new THREE.DirectionalLight(0xffd9a0, 0.45);
        bounce.position.set(-50, 24, -40);
        this.scene.add(bounce);
    }

    private sandMaterial(): THREE.MeshStandardMaterial {
        const size = 512;
        const { canvas, ctx } = makeCanvas(size);

        ctx.fillStyle = "#c9a978";
        ctx.fillRect(0, 0, size, size);

        for (let i = 0; i < 2600; i++) {
            const shade = 170 + Math.floor(this.random() * 60);
            ctx.fillStyle = `rgba(${shade},${shade - 26},${shade - 62},${0.1 + this.random() * 0.25})`;
            ctx.beginPath();
            ctx.arc(this.random() * size, this.random() * size, 1 + this.random() * 6, 0, Math.PI * 2);
            ctx.fill();
        }

        for (let i = 0; i < 40; i++) {
            ctx.strokeStyle = `rgba(150,124,88,${0.08 + this.random() * 0.12})`;
            ctx.lineWidth = 2 + this.random() * 6;
            ctx.beginPath();
            const y = this.random() * size;
            ctx.moveTo(0, y);
            for (let x = 0; x <= size; x += 48) {
                ctx.lineTo(x, y + Math.sin((x / size) * Math.PI * 3) * (4 + this.random() * 14));
            }
            ctx.stroke();
        }

        return this.bin.material(new THREE.MeshStandardMaterial({
            map: repeatTexture(this.bin, canvas, 26),
            roughness: 0.97,
            metalness: 0.01,
        }));
    }

    private stuccoMaterial(): THREE.MeshStandardMaterial {
        const size = 512;
        const { canvas, ctx } = makeCanvas(size);

        ctx.fillStyle = "#d9bd8e";
        ctx.fillRect(0, 0, size, size);

        for (let i = 0; i < 1500; i++) {
            const shade = 190 + Math.floor(this.random() * 50);
            ctx.fillStyle = `rgba(${shade},${shade - 24},${shade - 60},${0.12 + this.random() * 0.2})`;
            ctx.beginPath();
            ctx.arc(this.random() * size, this.random() * size, 3 + this.random() * 16, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.strokeStyle = "rgba(140,112,74,0.35)";
        ctx.lineWidth = 3;
        for (let i = 1; i < 5; i++) {
            const y = (i / 5) * size;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y);
            ctx.stroke();
        }

        for (let i = 0; i < 22; i++) {
            ctx.strokeStyle = `rgba(120,94,60,${0.1 + this.random() * 0.2})`;
            ctx.lineWidth = 1 + this.random() * 2;
            ctx.beginPath();
            let x = this.random() * size;
            let y = this.random() * size;
            ctx.moveTo(x, y);
            for (let j = 0; j < 4; j++) {
                x += (this.random() - 0.5) * 90;
                y += (this.random() - 0.5) * 90;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        return this.bin.material(new THREE.MeshStandardMaterial({
            map: repeatTexture(this.bin, canvas, 6),
            roughness: 0.92,
            metalness: 0.02,
        }));
    }

    private crateMaterial(): THREE.MeshStandardMaterial {
        const size = 256;
        const { canvas, ctx } = makeCanvas(size);

        ctx.fillStyle = "#8a6134";
        ctx.fillRect(0, 0, size, size);

        for (let i = 0; i < 90; i++) {
            ctx.strokeStyle = `rgba(${120 + this.random() * 60},${84 + this.random() * 40},${44 + this.random() * 30},${0.2 + this.random() * 0.3})`;
            ctx.lineWidth = 1 + this.random() * 3;
            ctx.beginPath();
            const y = this.random() * size;
            ctx.moveTo(0, y);
            ctx.lineTo(size, y + (this.random() - 0.5) * 10);
            ctx.stroke();
        }

        ctx.strokeStyle = "rgba(60,40,20,0.8)";
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, size - 10, size - 10);
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(5, 5);
        ctx.lineTo(size - 5, size - 5);
        ctx.moveTo(size - 5, 5);
        ctx.lineTo(5, size - 5);
        ctx.stroke();

        return this.bin.material(new THREE.MeshStandardMaterial({
            map: repeatTexture(this.bin, canvas, 1),
            roughness: 0.85,
            metalness: 0.03,
        }));
    }

    private buildGround() {
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(MAP_HALF_X * 2 + 24, MAP_HALF_Z * 2 + 24),
            this.sandMaterial()
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        ground.matrixAutoUpdate = false;
        ground.updateMatrix();
        this.scene.add(ground);

        const patchColors: Record<string, number> = {
            sand: 0xc4a271,
            tile: 0xb8a486,
            plaza: 0xcbb492,
            site: 0xa9906a,
        };

        for (const patch of GROUND_PATCHES) {
            const width = patch.x2 - patch.x1;
            const depth = patch.z2 - patch.z1;
            const mesh = new THREE.Mesh(
                new THREE.PlaneGeometry(width, depth),
                this.bin.material(new THREE.MeshStandardMaterial({
                    color: patchColors[patch.style] ?? 0xc4a271,
                    roughness: 0.95,
                    metalness: 0.01,
                }))
            );
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(patch.x1 + width / 2, 0.02, patch.z1 + depth / 2);
            mesh.receiveShadow = true;
            mesh.matrixAutoUpdate = false;
            mesh.updateMatrix();
            this.scene.add(mesh);
        }
    }

    private buildWalls() {
        const stucco = this.stuccoMaterial();
        const trim = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xb08f5f,
            roughness: 0.88,
            metalness: 0.03,
        }));

        for (const wall of WALLS) {
            const width = Math.abs(wall.x2 - wall.x1);
            const depth = Math.abs(wall.z2 - wall.z1);
            const x = (wall.x1 + wall.x2) / 2;
            const z = (wall.z1 + wall.z2) / 2;
            const y = wall.y ?? 0;

            const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, wall.height, depth), stucco);
            mesh.position.set(x, y + wall.height / 2, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.matrixAutoUpdate = false;
            mesh.updateMatrix();
            this.scene.add(mesh);

            const cap = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 0.4, depth + 0.4), trim);
            cap.position.set(x, y + wall.height + 0.2, z);
            cap.castShadow = true;
            cap.matrixAutoUpdate = false;
            cap.updateMatrix();
            this.scene.add(cap);

            this.collisionGrid.insert(new THREE.Box3(
                new THREE.Vector3(Math.min(wall.x1, wall.x2), y, Math.min(wall.z1, wall.z2)),
                new THREE.Vector3(Math.max(wall.x1, wall.x2), y + wall.height, Math.max(wall.z1, wall.z2))
            ));
        }
    }

    private buildPlatforms() {
        const slab = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xc0a473,
            roughness: 0.92,
            metalness: 0.02,
        }));
        const lip = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x9c7f52,
            roughness: 0.86,
            metalness: 0.04,
        }));

        for (const pad of PLATFORMS) {
            const width = Math.abs(pad.x2 - pad.x1);
            const depth = Math.abs(pad.z2 - pad.z1);
            const x = (pad.x1 + pad.x2) / 2;
            const z = (pad.z1 + pad.z2) / 2;

            const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, pad.top, depth), slab);
            mesh.position.set(x, pad.top / 2, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.matrixAutoUpdate = false;
            mesh.updateMatrix();
            this.scene.add(mesh);

            const edge = new THREE.Mesh(new THREE.BoxGeometry(width + 0.14, 0.12, depth + 0.14), lip);
            edge.position.set(x, pad.top, z);
            edge.matrixAutoUpdate = false;
            edge.updateMatrix();
            this.scene.add(edge);

            this.collisionGrid.insert(new THREE.Box3(
                new THREE.Vector3(Math.min(pad.x1, pad.x2), 0, Math.min(pad.z1, pad.z2)),
                new THREE.Vector3(Math.max(pad.x1, pad.x2), pad.top, Math.max(pad.z1, pad.z2))
            ));
        }
    }

    // The toothed parapet is what the eye reads as this map before anything
    // else, so every wall top gets one, plus the roof beams poking out below it.
    private buildCrenellations() {
        const merlonSize = 1.05;
        const merlonGap = 1.75;
        const merlonHeight = 0.9;

        const spots: { x: number; z: number }[] = [];
        const beams: { x: number; z: number; rot: number }[] = [];

        for (const wall of WALLS) {
            if ((wall.y ?? 0) > 0.01) continue;

            const minX = Math.min(wall.x1, wall.x2);
            const maxX = Math.max(wall.x1, wall.x2);
            const minZ = Math.min(wall.z1, wall.z2);
            const maxZ = Math.max(wall.z1, wall.z2);

            const runX = maxX - minX;
            const runZ = maxZ - minZ;

            const alongX = (z: number, facing: number) => {
                const count = Math.max(1, Math.floor(runX / merlonGap));
                const step = runX / count;
                for (let i = 0; i < count; i++) {
                    const x = minX + step * (i + 0.5);
                    spots.push({ x, z });
                    if (i % 3 === 1) beams.push({ x, z: z + facing * 0.5, rot: 0 });
                }
            };

            const alongZ = (x: number, facing: number) => {
                const count = Math.max(1, Math.floor(runZ / merlonGap));
                const step = runZ / count;
                for (let i = 0; i < count; i++) {
                    const z = minZ + step * (i + 0.5);
                    spots.push({ x, z });
                    if (i % 3 === 1) beams.push({ x: x + facing * 0.5, z, rot: Math.PI / 2 });
                }
            };

            if (runX >= merlonGap) {
                alongX(minZ + merlonSize / 2, -1);
                alongX(maxZ - merlonSize / 2, 1);
            }
            if (runZ >= merlonGap) {
                alongZ(minX + merlonSize / 2, -1);
                alongZ(maxX - merlonSize / 2, 1);
            }
        }

        const capMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xcbb083,
            roughness: 0.93,
            metalness: 0.02,
        }));
        const merlons = new THREE.InstancedMesh(
            this.bin.geometry(new THREE.BoxGeometry(merlonSize, merlonHeight, merlonSize)),
            capMaterial,
            spots.length
        );

        const matrix = new THREE.Matrix4();
        spots.forEach((spot, i) => {
            matrix.makeTranslation(spot.x, WALL_HEIGHT + merlonHeight / 2, spot.z);
            merlons.setMatrixAt(i, matrix);
        });
        merlons.instanceMatrix.needsUpdate = true;
        merlons.castShadow = true;
        merlons.receiveShadow = true;
        this.scene.add(merlons);

        const beamMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x6f5231,
            roughness: 0.9,
            metalness: 0.03,
        }));
        const poles = new THREE.InstancedMesh(
            this.bin.geometry(new THREE.CylinderGeometry(0.12, 0.13, 1.1, 6)),
            beamMaterial,
            beams.length
        );

        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3(1, 1, 1);
        const position = new THREE.Vector3();
        beams.forEach((beam, i) => {
            position.set(beam.x, WALL_HEIGHT - 1.1, beam.z);
            quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, beam.rot, 0));
            matrix.compose(position, quaternion, scale);
            poles.setMatrixAt(i, matrix);
        });
        poles.instanceMatrix.needsUpdate = true;
        poles.castShadow = true;
        this.scene.add(poles);
    }

    // A framed arch reads as a doorway where a plain gap in a slab does not.
    private buildDoorways() {
        const frameMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xbfa073,
            roughness: 0.9,
            metalness: 0.02,
        }));
        const doorMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x2f7d78,
            roughness: 0.55,
            metalness: 0.35,
        }));
        const strapMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x1f5450,
            roughness: 0.5,
            metalness: 0.45,
        }));

        for (const door of DOORWAYS) {
            const group = new THREE.Group();
            group.position.set(door.x, 0, door.z);
            if (door.axis === "x") group.rotation.y = Math.PI / 2;

            const half = door.width / 2;
            const spring = door.height - half;
            const thickness = 0.9;

            const shape = new THREE.Shape();
            shape.moveTo(-half - thickness, 0);
            shape.lineTo(half + thickness, 0);
            shape.lineTo(half + thickness, door.height + thickness);
            shape.lineTo(-half - thickness, door.height + thickness);
            shape.closePath();

            const hole = new THREE.Path();
            hole.moveTo(-half, 0);
            hole.lineTo(-half, spring);
            hole.absarc(0, spring, half, Math.PI, 0, true);
            hole.lineTo(half, 0);
            hole.closePath();
            shape.holes.push(hole);

            const frame = new THREE.Mesh(
                new THREE.ExtrudeGeometry(shape, { depth: 1.3, bevelEnabled: false, curveSegments: 10 }),
                frameMaterial
            );
            frame.position.z = -0.65;
            frame.castShadow = true;
            frame.receiveShadow = true;
            group.add(frame);

            const keystone = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 1.5), frameMaterial);
            keystone.position.set(0, door.height + 0.2, 0);
            group.add(keystone);

            if (door.style === "door") {
                for (const side of [-1, 1]) {
                    const leaf = new THREE.Group();
                    leaf.position.set(side * half, 0, 0);
                    leaf.rotation.y = side * 1.9;

                    const panel = new THREE.Mesh(
                        new THREE.BoxGeometry(half * 0.94, door.height * 0.92, 0.12),
                        doorMaterial
                    );
                    panel.position.set(-side * half * 0.47, door.height * 0.46, 0);
                    panel.castShadow = true;
                    leaf.add(panel);

                    for (let i = 0; i < 2; i++) {
                        const strap = new THREE.Mesh(
                            new THREE.BoxGeometry(half * 0.9, 0.16, 0.17),
                            strapMaterial
                        );
                        strap.position.set(-side * half * 0.47, door.height * (0.24 + i * 0.44), 0);
                        leaf.add(strap);
                    }

                    group.add(leaf);
                }
            }

            this.scene.add(group);
        }
    }

    private buildPalms() {
        const bark = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x7a6444,
            roughness: 0.95,
            metalness: 0.02,
        }));
        const frond = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x5c7738,
            roughness: 0.88,
            metalness: 0.02,
            side: THREE.DoubleSide,
        }));

        for (const [x, z] of PALMS) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = this.random() * Math.PI * 2;

            const height = 5.4 + this.random() * 2.4;
            const lean = (this.random() - 0.5) * 0.16;

            const segments = 5;
            for (let i = 0; i < segments; i++) {
                const t = i / segments;
                const piece = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.19 - t * 0.06, 0.23 - t * 0.06, height / segments, 8),
                    bark
                );
                piece.position.set(
                    Math.sin(t * 1.4) * lean * height,
                    height * (t + 0.5 / segments),
                    0
                );
                piece.rotation.z = -lean * (0.4 + t);
                piece.castShadow = true;
                group.add(piece);
            }

            const crown = new THREE.Group();
            crown.position.set(Math.sin(1.4) * lean * height, height, 0);
            group.add(crown);

            for (let i = 0; i < 8; i++) {
                const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.62), frond);
                leaf.position.set(1.25, -0.1, 0);
                leaf.rotation.set(-0.2 + this.random() * 0.2, 0, -0.42 - this.random() * 0.3);

                const arm = new THREE.Group();
                arm.rotation.y = (i / 8) * Math.PI * 2 + this.random() * 0.2;
                arm.add(leaf);
                crown.add(arm);
            }

            const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), bark);
            nuts.position.set(Math.sin(1.4) * lean * height, height - 0.25, 0);
            crown.parent?.add(nuts);

            this.scene.add(group);
            this.collisionGrid.insertCylinder(new THREE.Vector3(x, height / 2, z), 0.34, height);
        }
    }

    private buildContainers() {
        const shell = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x2c5f86,
            roughness: 0.68,
            metalness: 0.45,
        }));
        const rib = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x24506f,
            roughness: 0.62,
            metalness: 0.5,
        }));

        for (const box of CONTAINERS) {
            const group = new THREE.Group();
            group.position.set(box.x, 0, box.z);
            group.rotation.y = box.rotation;

            const width = 2.4;
            const depth = 4.6;
            const height = 2.3;

            const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), shell);
            body.position.y = height / 2;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            for (let i = 0; i < 6; i++) {
                const ridge = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, height * 0.82, 0.14), rib);
                ridge.position.set(0, height / 2, -depth / 2 + 0.5 + i * 0.75);
                group.add(ridge);
            }

            const lid = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 0.22, depth + 0.2), rib);
            lid.position.y = height + 0.1;
            lid.castShadow = true;
            group.add(lid);

            this.scene.add(group);
            this.collisionGrid.insertOrientedBox(box.x, box.z, width, depth, box.rotation, 0, height + 0.2);
        }
    }

    private buildCar(crate: { x: number; z: number; width: number; depth: number; height: number; rotation?: number }) {
        const paint = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x8d3b2c,
            roughness: 0.62,
            metalness: 0.42,
        }));
        const glass = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x2b3a44,
            roughness: 0.2,
            metalness: 0.6,
        }));
        const rubber = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x1a1a1c,
            roughness: 0.95,
            metalness: 0.02,
        }));

        const group = new THREE.Group();
        group.position.set(crate.x, 0, crate.z);
        group.rotation.y = crate.rotation ?? 0;

        const length = Math.max(crate.width, crate.depth);
        const width = Math.min(crate.width, crate.depth);

        const body = new THREE.Mesh(new THREE.BoxGeometry(width, 0.78, length), paint);
        body.position.y = 0.72;
        body.castShadow = true;
        group.add(body);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.86, 0.62, length * 0.44), paint);
        cabin.position.set(0, 1.4, -length * 0.04);
        cabin.castShadow = true;
        group.add(cabin);

        const windows = new THREE.Mesh(new THREE.BoxGeometry(width * 0.88, 0.44, length * 0.42), glass);
        windows.position.set(0, 1.42, -length * 0.04);
        group.add(windows);

        for (const sx of [-1, 1]) {
            for (const sz of [-1, 1]) {
                const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12), rubber);
                wheel.rotation.z = Math.PI / 2;
                wheel.position.set(sx * width * 0.48, 0.36, sz * length * 0.32);
                group.add(wheel);
            }
        }

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(
            crate.x,
            crate.z,
            crate.width,
            crate.depth,
            crate.rotation ?? 0,
            0,
            1.72
        );
    }

    private buildCrates() {
        const wood = this.crateMaterial();
        const concrete = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x9a9184,
            roughness: 0.94,
            metalness: 0.02,
        }));
        const metal = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x6d7a55,
            roughness: 0.6,
            metalness: 0.5,
        }));

        for (const crate of CRATES) {
            if (crate.style === "car") {
                this.buildCar(crate);
                continue;
            }

            const y = crate.y ?? 0;
            const material = crate.style === "concrete" ? concrete : crate.style === "crate" ? wood : metal;

            let mesh: THREE.Mesh;
            if (crate.style === "barrel") {
                mesh = new THREE.Mesh(
                    new THREE.CylinderGeometry(crate.width / 2, crate.width / 2, crate.height, 16),
                    metal
                );
            } else {
                mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(crate.width, crate.height, crate.depth),
                    material
                );
            }

            mesh.position.set(crate.x, y + crate.height / 2, crate.z);
            mesh.rotation.y = crate.rotation ?? 0;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);

            this.collisionGrid.insertOrientedBox(
                crate.x,
                crate.z,
                crate.width,
                crate.depth,
                crate.rotation ?? 0,
                y,
                y + crate.height
            );
        }
    }

    private buildSites() {
        for (const [site, label] of [[BOMB_SITE_A, "A"], [BOMB_SITE_B, "B"]] as const) {
            const paint = this.bin.material(new THREE.MeshBasicMaterial({
                color: 0xff5757,
                transparent: true,
                opacity: 0.22,
                side: THREE.DoubleSide,
                depthWrite: false,
                toneMapped: false,
            }));
            this.siteMaterials.push(paint);

            const disc = new THREE.Mesh(new THREE.CircleGeometry(site.radius, 48), paint);
            disc.rotation.x = -Math.PI / 2;
            disc.position.set(site.x, 0.06, site.z);
            disc.renderOrder = 2;
            this.scene.add(disc);

            const ring = new THREE.Mesh(
                new THREE.RingGeometry(site.radius - 0.4, site.radius, 48),
                this.bin.material(new THREE.MeshBasicMaterial({
                    color: 0xff8a8a,
                    transparent: true,
                    opacity: 0.6,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                    toneMapped: false,
                }))
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(site.x, 0.07, site.z);
            this.scene.add(ring);

            this.buildSiteLetter(site.x, site.z, label);
        }
    }

    private buildSiteLetter(x: number, z: number, label: string) {
        const { canvas, ctx } = makeCanvas(256);
        ctx.clearRect(0, 0, 256, 256);
        ctx.fillStyle = "#ff5757";
        ctx.font = "bold 200px Georgia, serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, 128, 136);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;

        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(6, 6),
            this.bin.material(new THREE.MeshBasicMaterial({
                map: this.bin.texture(texture),
                transparent: true,
                opacity: 0.55,
                depthWrite: false,
                toneMapped: false,
            }))
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.08, z);
        mesh.renderOrder = 3;
        this.scene.add(mesh);
    }

    private buildExitGate() {
        const stone = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x8a6f47,
            roughness: 0.8,
            metalness: 0.1,
        }));

        const group = new THREE.Group();
        group.position.set(T_SPAWN.x - 8, 0, T_SPAWN.z + 3);
        group.rotation.y = Math.PI;

        for (const side of [-1, 1]) {
            const jamb = new THREE.Mesh(new THREE.BoxGeometry(1.4, 8, 1.6), stone);
            jamb.position.set(side * 3.2, 4, 0);
            jamb.castShadow = true;
            group.add(jamb);
        }

        const lintel = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 1.8), stone);
        lintel.position.y = 8.5;
        lintel.castShadow = true;
        group.add(lintel);

        const veil = new THREE.Mesh(
            new THREE.PlaneGeometry(6, 8),
            this.bin.material(new THREE.MeshBasicMaterial({
                color: 0xffe6bc,
                transparent: true,
                opacity: 0.45,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
                fog: false,
            }))
        );
        veil.position.set(0, 4, 0);
        group.add(veil);

        group.userData.interactionId = EVENT_EXIT_INTERACTION;
        group.userData.interactionRadius = 6;

        this.scene.add(group);
    }

    private buildSkyline() {
        const stone = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xc4a87c,
            roughness: 0.95,
            metalness: 0.02,
        }));
        const roof = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xa4694a,
            roughness: 0.92,
            metalness: 0.02,
        }));
        const boxGeometry = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));

        for (let i = 0; i < 54; i++) {
            const angle = (i / 54) * Math.PI * 2;
            const radius = 66 + this.random() * 38;
            const height = 7 + this.random() * 20;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const block = new THREE.Mesh(boxGeometry, stone);
            const footprint = 8 + this.random() * 13;
            block.scale.set(footprint, height, footprint);
            block.position.set(x, height / 2, z);
            block.rotation.y = this.random() * Math.PI;
            block.matrixAutoUpdate = false;
            block.updateMatrix();
            this.scene.add(block);

            const roll = this.random();

            if (roll > 0.72) {
                const dome = new THREE.Mesh(
                    new THREE.SphereGeometry(footprint * 0.42, 14, 9, 0, Math.PI * 2, 0, Math.PI / 2),
                    roof
                );
                dome.position.set(x, height, z);
                dome.matrixAutoUpdate = false;
                dome.updateMatrix();
                this.scene.add(dome);
            } else if (roll > 0.56) {
                const shaft = new THREE.Mesh(boxGeometry, stone);
                const towerHeight = 12 + this.random() * 14;
                shaft.scale.set(3.4, towerHeight, 3.4);
                shaft.position.set(x, height + towerHeight / 2, z);
                shaft.matrixAutoUpdate = false;
                shaft.updateMatrix();
                this.scene.add(shaft);

                const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.4, 8), roof);
                cap.position.set(x, height + towerHeight + 1.7, z);
                cap.matrixAutoUpdate = false;
                cap.updateMatrix();
                this.scene.add(cap);
            }
        }
    }

    public getCallouts() {
        return CALLOUTS;
    }

    override update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);
        this.elapsed += delta;

        const pulse = 0.18 + Math.sin(this.elapsed * 1.6) * 0.06;
        for (const material of this.siteMaterials) material.opacity = pulse;

        if (this.sky) this.sky.material.uniforms.time.value = this.elapsed;
        this.trackShadowCamera(playerPosition);
    }

    private trackShadowCamera(playerPosition: THREE.Vector3) {
        const light = this.keyLight;
        if (!light) return;

        const texel = (SHADOW_EXTENT * 2) / light.shadow.mapSize.width;
        const x = Math.round(playerPosition.x / texel) * texel;
        const z = Math.round(playerPosition.z / texel) * texel;

        light.target.position.set(x, 0, z);
        light.position.set(x + 60, 90, z + 50);
        light.target.updateMatrixWorld();
    }

    getSpawnPoint(): THREE.Vector3 {
        return this.spawnPoint.clone();
    }

    dispose() {
        if (this.sky) {
            this.scene.remove(this.sky);
            this.sky.geometry.dispose();
            this.sky.material.dispose();
            this.sky = null;
        }
        this.siteMaterials = [];
        this.keyLight = null;
        super.dispose();
        this.bin.dispose();
    }
}
