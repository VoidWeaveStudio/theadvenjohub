// src/features/game/world/locations/tower/floors/TokenGatesFloor.ts
import * as THREE from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";
import { GalaxyBackdrop } from "./token-gates/galaxy/GalaxyBackdrop";
import { PlayerBubbleField } from "./token-gates/galaxy/PlayerBubbleField";
import { FactionBubbleSystem } from "./token-gates/galaxy/FactionBubbleSystem";
import {
    CthulhuPlatform,
    PLATFORM_CENTER,
    PLATFORM_RADIUS,
    PLATFORM_SURFACE_Y,
} from "./token-gates/galaxy/CthulhuPlatform";
import { GALAXY, ORBIT_OMEGA, galaxyOrbitTime, playerBubbleOrbit, orbitPosition } from "./token-gates/galaxy/GalaxyLayout";

const PLAYER_CLEARANCE = 2.2;
const ORBIT_LOCK_BAND = 6;
import type { FlightZone, HeightProvider } from "../../../Location";
import type { FactionGateData } from "../../../../network/NetworkManager";

const SPAWN_POINT = new THREE.Vector3(PLATFORM_CENTER.x, PLATFORM_SURFACE_Y, PLATFORM_CENTER.z - 9);
const CRYSTAL_OFFSET = new THREE.Vector3(0, 0, 13);

export class TokenGatesFloor extends TowerFloor {
    public readonly backdrop: GalaxyBackdrop;
    public readonly platform: CthulhuPlatform;
    public readonly bubbles: PlayerBubbleField;
    public readonly factions: FactionBubbleSystem;

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

    private orbitTime = 0;

    private static readonly _scratch = { x: 0, y: 0, z: 0 };
    private static readonly _push = new THREE.Vector3();

    constructor() {
        super('tower-token-gates', 'Token Gates');
        this.backdrop = new GalaxyBackdrop(this.scene);
        this.platform = new CthulhuPlatform(this.scene);
        this.bubbles = new PlayerBubbleField(this.scene);
        this.factions = new FactionBubbleSystem(this.scene);
        this.terrain = { getHeightAt: (x, z) => this.platform.getHeightAt(x, z) };
    }

    create(_rm: ResourceManager): void {
        this.scene.fog = null;

        this.backdrop.create();
        this.platform.create();

        this.createCentralCrystal();
        this.collisionGrid.clear();
        this.centralCrystal.position.copy(PLATFORM_CENTER).add(CRYSTAL_OFFSET);
        this.centralCrystal.userData.interactionRadius = 5;
        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(this.centralCrystal.position.x - 1.2, PLATFORM_SURFACE_Y, this.centralCrystal.position.z - 1.2),
            new THREE.Vector3(this.centralCrystal.position.x + 1.2, PLATFORM_SURFACE_Y + 3.5, this.centralCrystal.position.z + 1.2)
        ));

        this.factions.start();
    }

    public setAccountCount(count: number) {
        this.bubbles.setCount(count);
    }

    public setOwnBubbleIndex(index: number | null) {
        this.bubbles.setOwnIndex(index);
    }

    public setWaypointIndex(index: number | null) {
        this.bubbles.setWaypointIndex(index);
    }

    public setViewportHeight(height: number) {
        this.bubbles.setViewportHeight(height);
    }

    public getBubbleWorldPosition(index: number, out: THREE.Vector3): THREE.Vector3 {
        orbitPosition(playerBubbleOrbit(index), this.orbitTime, TokenGatesFloor._scratch);
        return out.set(TokenGatesFloor._scratch.x, TokenGatesFloor._scratch.y, TokenGatesFloor._scratch.z);
    }

    public handleFactionGatesState(list: FactionGateData[]) {
        this.factions.handleFactionGatesState(list);
    }

    public addLocalGate(data: FactionGateData) {
        this.factions.addLocalGate(data);
    }

    public getFactionGateInfo(factionId: string): FactionGateData | undefined {
        return this.factions.getFactionGateInfo(factionId);
    }

    public isOnPlatform(position: THREE.Vector3): boolean {
        return this.platform.containsPoint(position);
    }

    update(playerPosition: THREE.Vector3, delta: number, _isEPressed?: boolean) {
        this.time += delta;
        const previousOrbitTime = this.orbitTime;
        this.orbitTime = galaxyOrbitTime();

        this.backdrop.update(this.orbitTime);
        this.bubbles.update(this.orbitTime, playerPosition);
        this.factions.update(delta, this.orbitTime);
        this.platform.update(delta);

        if (!this.platform.containsPoint(playerPosition)) {
            this.resolveBubbleContacts(playerPosition, previousOrbitTime);
        }

        if (this.centralCrystal) {
            this.centralCrystal.rotation.y += delta * 0.6;
            this.centralCrystal.position.y = PLATFORM_SURFACE_Y + Math.sin(this.time * 1.5) * 0.2;
        }
    }

    private resolveBubbleContacts(playerPosition: THREE.Vector3, previousOrbitTime: number) {
        const contacts = this.factions.getContacts();
        const nearBubbles = this.bubbles.getNearContacts();
        const push = TokenGatesFloor._push;

        for (const contact of contacts.concat(nearBubbles)) {
            push.subVectors(playerPosition, contact.position);
            const distance = push.length();
            const clearance = contact.radius + PLAYER_CLEARANCE;
            if (distance >= clearance || distance < 0.0001) continue;

            push.multiplyScalar((clearance - distance) / distance);
            playerPosition.add(push);

            if (contact.orbit && distance < clearance + ORBIT_LOCK_BAND) {
                const angleDelta = ORBIT_OMEGA * (this.orbitTime - previousOrbitTime);
                if (Math.abs(angleDelta) > 1e-6 && Math.abs(angleDelta) < 1) {
                    const cos = Math.cos(angleDelta);
                    const sin = Math.sin(angleDelta);
                    const x = playerPosition.x;
                    const z = playerPosition.z;
                    playerPosition.x = x * cos - z * sin;
                    playerPosition.z = x * sin + z * cos;
                }
            }
        }
    }

    public override getInteractables(): THREE.Object3D[] {
        return [
            this.centralCrystal,
            this.platform.interactionTarget,
            ...this.factions.getInteractables(),
            ...this.bubbles.getInteractables(),
        ];
    }

    getSpawnPoint(): THREE.Vector3 {
        return SPAWN_POINT.clone();
    }

    dispose() {
        this.factions.dispose();
        this.bubbles.dispose();
        this.platform.dispose();
        this.backdrop.dispose();
        super.dispose();
    }
}
