// src/features/game/world/locations/second-world/SecondWorldHub.ts
import * as THREE from "three";
import { TowerFloor } from "../tower/TowerFloor";
import { ResourceManager } from "../../../core/ResourceManager";
import { GalaxyBackdrop } from "../tower/floors/token-gates/galaxy/GalaxyBackdrop";
import {
    HubPlatform,
    PLATFORM_CENTER,
    PLATFORM_RADIUS,
    PLATFORM_SURFACE_Y,
} from "./HubPlatform";
import { GALAXY, galaxyOrbitTime } from "../tower/floors/token-gates/galaxy/GalaxyLayout";
import { createNpcNameTag } from "../../../entities/npcNameTag";
import { GATE_INTERACT_RANGE, GATE_RING_RADIUS, SHOWCASE_INFO, ShowcaseInfo } from "../showcase/config";
import { THEMED_FACTION_LOCATIONS } from "../showcase/themedFactions";
import type { FlightZone, HeightProvider } from "../../Location";
import { t } from "@/core/i18n";

const SPAWN_POINT = new THREE.Vector3(PLATFORM_CENTER.x, PLATFORM_SURFACE_Y, PLATFORM_CENTER.z - 9);
const GATE_HEIGHT = 13;
const GATE_WIDTH = 9;
const DEBRIS_COUNT = 90;

interface HubGate {
    info: ShowcaseInfo;
    position: THREE.Vector3;
    veil: THREE.MeshBasicMaterial;
    light: THREE.PointLight;
    ring: THREE.Mesh;
    beam: THREE.Mesh;
    phase: number;
}

export class SecondWorldHub extends TowerFloor {
    public readonly backdrop: GalaxyBackdrop;
    public readonly platform: HubPlatform;

    public maxPlayerRadius: number | null = GALAXY.maxRadius;
    public terrain: HeightProvider;
    public flightZone: FlightZone = {
        center: PLATFORM_CENTER.clone(),
        radius: PLATFORM_RADIUS,
        surfaceY: PLATFORM_SURFACE_Y,
        maxRadius: GALAXY.maxRadius,
        minY: -GALAXY.diskThickness * 4,
        maxY: PLATFORM_SURFACE_Y + 400,
    };

    private gates: HubGate[] = [];
    private debris: THREE.InstancedMesh | null = null;
    private debrisSpin: Float32Array = new Float32Array(0);
    private readonly debrisMatrix = new THREE.Matrix4();
    private readonly debrisQuat = new THREE.Quaternion();
    private readonly debrisEuler = new THREE.Euler();
    private readonly debrisPosition = new THREE.Vector3();
    private readonly debrisScale = new THREE.Vector3();

    constructor() {
        super("tower-token-gates", "g.floorReg.tower-token-gates.name");
        this.backdrop = new GalaxyBackdrop(this.scene);
        this.platform = new HubPlatform(this.scene);
        this.terrain = { getHeightAt: (x, z) => this.platform.getHeightAt(x, z) };
    }

    create(_rm: ResourceManager): void {
        this.scene.fog = null;
        this.collisionGrid.clear();

        this.backdrop.create();
        this.platform.create();
        this.buildLiftCrystal();
        this.buildGates();
        this.buildDebris();
    }

    private buildLiftCrystal() {
        this.createCentralCrystal(new THREE.Vector3(PLATFORM_CENTER.x, PLATFORM_SURFACE_Y + 1.4, PLATFORM_CENTER.z));
        this.centralCrystal.userData.interactionRadius = 6;
    }

    private gatePosition(info: ShowcaseInfo): THREE.Vector3 {
        return new THREE.Vector3(
            PLATFORM_CENTER.x + Math.sin(info.ringAngle) * GATE_RING_RADIUS,
            PLATFORM_SURFACE_Y + info.ringHeight,
            PLATFORM_CENTER.z + Math.cos(info.ringAngle) * GATE_RING_RADIUS
        );
    }

    private buildGates() {
        const movedIntoBubbles = new Set(Object.values(THEMED_FACTION_LOCATIONS));

        for (const info of SHOWCASE_INFO) {
            if (movedIntoBubbles.has(info.id)) continue;

            const position = this.gatePosition(info);
            const facing = Math.atan2(PLATFORM_CENTER.x - position.x, PLATFORM_CENTER.z - position.z);

            const group = new THREE.Group();
            group.position.copy(position);
            group.rotation.y = facing;

            const stone = new THREE.MeshStandardMaterial({
                color: info.gateStone,
                roughness: 0.72,
                metalness: 0.22,
                emissive: info.accent,
                emissiveIntensity: 0.12,
            });
            const trim = new THREE.MeshStandardMaterial({
                color: info.accent,
                roughness: 0.3,
                metalness: 0.85,
                emissive: info.accent,
                emissiveIntensity: 0.6,
            });

            const slab = new THREE.Mesh(new THREE.CylinderGeometry(GATE_WIDTH * 0.78, GATE_WIDTH * 0.55, 1.6, 6), stone);
            slab.position.y = -1.4;
            group.add(slab);

            const rim = new THREE.Mesh(new THREE.TorusGeometry(GATE_WIDTH * 0.72, 0.22, 8, 6), trim);
            rim.rotation.x = Math.PI / 2;
            rim.position.y = -0.6;
            group.add(rim);

            for (const side of [-1, 1]) {
                const jamb = new THREE.Mesh(new THREE.BoxGeometry(1.5, GATE_HEIGHT * 0.74, 1.6), stone);
                jamb.position.set(side * GATE_WIDTH * 0.42, GATE_HEIGHT * 0.37, 0);
                group.add(jamb);

                const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, GATE_HEIGHT * 0.5, 0.5), trim);
                fin.position.set(side * (GATE_WIDTH * 0.42 + 0.9), GATE_HEIGHT * 0.42, 0);
                group.add(fin);
            }

            const arch = new THREE.Mesh(new THREE.TorusGeometry(GATE_WIDTH * 0.42, 0.7, 10, 26, Math.PI), stone);
            arch.position.y = GATE_HEIGHT * 0.74;
            group.add(arch);

            const crest = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), trim);
            crest.position.y = GATE_HEIGHT * 0.74 + 4.1;
            group.add(crest);

            const veilMaterial = new THREE.MeshBasicMaterial({
                color: info.accent,
                transparent: true,
                opacity: 0.42,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
                fog: false,
            });

            const veil = new THREE.Mesh(new THREE.PlaneGeometry(GATE_WIDTH * 0.82, GATE_HEIGHT * 0.74), veilMaterial);
            veil.position.set(0, GATE_HEIGHT * 0.37, 0);
            veil.renderOrder = 4;
            group.add(veil);

            const dome = new THREE.Mesh(new THREE.CircleGeometry(GATE_WIDTH * 0.41, 24, 0, Math.PI), veilMaterial);
            dome.position.set(0, GATE_HEIGHT * 0.74, 0);
            group.add(dome);

            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(GATE_WIDTH * 0.5, 0.12, 6, 40),
                new THREE.MeshBasicMaterial({
                    color: info.accent,
                    transparent: true,
                    opacity: 0.55,
                    blending: THREE.AdditiveBlending,
                    toneMapped: false,
                    depthWrite: false,
                })
            );
            ring.position.y = GATE_HEIGHT * 0.37;
            group.add(ring);

            const beam = new THREE.Mesh(
                new THREE.CylinderGeometry(GATE_WIDTH * 0.2, GATE_WIDTH * 0.62, 90, 18, 1, true),
                new THREE.MeshBasicMaterial({
                    color: info.accent,
                    transparent: true,
                    opacity: 0.05,
                    side: THREE.DoubleSide,
                    blending: THREE.AdditiveBlending,
                    toneMapped: false,
                    depthWrite: false,
                })
            );
            beam.position.y = GATE_HEIGHT * 0.74 + 45;
            group.add(beam);

            const light = new THREE.PointLight(info.accent, 40, 70, 2);
            light.position.set(0, GATE_HEIGHT * 0.4, 2);
            group.add(light);

            const tag = createNpcNameTag(info.nameKey, `#${info.accent.toString(16).padStart(6, "0")}`);
            tag.position.set(0, GATE_HEIGHT * 0.74 + 6.4, 0);
            tag.scale.set(9, 2.25, 1);
            group.add(tag);

            this.scene.add(group);

            this.gates.push({
                info,
                position,
                veil: veilMaterial,
                light,
                ring,
                beam,
                phase: this.gates.length * 0.9,
            });
        }
    }

    private buildDebris() {
        const geometry = new THREE.IcosahedronGeometry(1, 0);
        const material = new THREE.MeshStandardMaterial({
            color: 0x3c4658,
            roughness: 0.92,
            metalness: 0.1,
            emissive: 0x121a28,
            emissiveIntensity: 0.6,
        });

        const mesh = new THREE.InstancedMesh(geometry, material, DEBRIS_COUNT);
        mesh.frustumCulled = false;
        this.debrisSpin = new Float32Array(DEBRIS_COUNT * 4);

        for (let i = 0; i < DEBRIS_COUNT; i++) {
            const angle = (i / DEBRIS_COUNT) * Math.PI * 2 + Math.sin(i * 12.9898) * 0.6;
            const radius = GATE_RING_RADIUS * (0.55 + ((i * 37) % 100) / 100 * 1.1);
            const height = ((i * 53) % 100) / 100 * 70 - 35;
            const scale = 0.6 + ((i * 29) % 100) / 100 * 2.6;

            this.debrisSpin[i * 4] = PLATFORM_CENTER.x + Math.sin(angle) * radius;
            this.debrisSpin[i * 4 + 1] = PLATFORM_SURFACE_Y + height;
            this.debrisSpin[i * 4 + 2] = PLATFORM_CENTER.z + Math.cos(angle) * radius;
            this.debrisSpin[i * 4 + 3] = scale;

            this.debrisPosition.set(this.debrisSpin[i * 4], this.debrisSpin[i * 4 + 1], this.debrisSpin[i * 4 + 2]);
            this.debrisScale.setScalar(scale);
            this.debrisEuler.set(i * 0.7, i * 1.3, i * 0.4);
            this.debrisQuat.setFromEuler(this.debrisEuler);
            this.debrisMatrix.compose(this.debrisPosition, this.debrisQuat, this.debrisScale);
            mesh.setMatrixAt(i, this.debrisMatrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(mesh);
        this.debris = mesh;
    }

    private nearestGate(position: THREE.Vector3): HubGate | null {
        let best: HubGate | null = null;
        let bestDistance = GATE_INTERACT_RANGE;

        for (const gate of this.gates) {
            const distance = position.distanceTo(gate.position);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = gate;
            }
        }

        return best;
    }

    public getInteractionPrompt(playerPosition: THREE.Vector3): string | null {
        const gate = this.nearestGate(playerPosition);
        return gate ? t("g.showcase.enter", { name: t(gate.info.nameKey) }) : null;
    }

    override update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        this.time += delta;

        this.backdrop.update(galaxyOrbitTime());
        this.platform.update(delta);

        this.crystal?.update(delta);
        if (this.centralCrystal) {
            this.centralCrystal.rotation.y += delta * 0.5;
            this.centralCrystal.position.y = this.crystalBaseY + Math.sin(this.time * 1.5) * 0.22;
        }

        for (const gate of this.gates) {
            const pulse = Math.sin(this.time * 1.5 + gate.phase);
            gate.veil.opacity = 0.36 + pulse * 0.1;
            gate.light.intensity = 34 + pulse * 8;
            gate.ring.rotation.z += delta * 0.5;
            gate.beam.rotation.y += delta * 0.08;
        }

        if (this.debris) {
            this.debris.rotation.y += delta * 0.004;
        }

        if (isEPressed) {
            const gate = this.nearestGate(playerPosition);
            if (gate) this.pendingTeleport = gate.info.entryId ?? gate.info.id;
        }
    }

    public isOnPlatform(position: THREE.Vector3): boolean {
        return this.platform.containsPoint(position);
    }

    public override getInteractables(): THREE.Object3D[] {
        return this.centralCrystal ? [this.centralCrystal] : [];
    }

    getSpawnPoint(): THREE.Vector3 {
        return SPAWN_POINT.clone();
    }

    dispose() {
        this.gates.length = 0;
        this.debris = null;
        this.platform.dispose();
        this.backdrop.dispose();
        super.dispose();
    }
}
