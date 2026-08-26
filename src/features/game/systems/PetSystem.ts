// src/features/game/systems/PetSystem.ts
import * as THREE from "three";
import { System } from "./System";
import { Player } from "../entities/Player";
import { NetworkManager } from "../network/NetworkManager";
import { createCompanion, type CompanionInstance } from "../entities/companionModels";
import { DEFAULT_COMPANION_ID, isCompanionId, type CompanionId } from "../data/companions";

export const PET_ITEM_ID = DEFAULT_COMPANION_ID;

const FETCH_RADIUS = 28;
const RUN_SPEED = 9;
const WALK_SPEED = 5.5;
const FOLLOW_DISTANCE = 2.2;
const FOLLOW_SIDE = 0.8;
const PET_SCALE = 1;
const FOLLOW_TELEPORT_DISTANCE = 35;
const PICKUP_REACH = 1.1;
const PICKUP_RETRY_MS = 600;
const BLOCKED_LOCATION_PREFIX = "event-";
const REST_DELAY = 3.2;
const OWNER_STILL_SPEED = 0.4;
const REST_FACE_RATE = 2.5;
const ATTACK_RANGE = 18;
const ATTACK_STANDOFF = 3.2;
const ATTACK_MIN_GAP = 2;
const ATTACK_FLANK = 1.1;
const ATTACK_LEASH = 9;
const ATTACK_FACE_RATE = 9;

type PetMode = "follow" | "fetch" | "return" | "attack";

export interface FetchableDrop {
    id: string;
    position: THREE.Vector3;
}

export interface PetThreat {
    id: string;
    position: THREE.Vector3;
}

export interface PetTuning {
    followDistance: number;
    followSide: number;
    scale: number;
    runSpeed: number;
    walkSpeed: number;
}

export class PetSystem extends System {
    private scene: THREE.Scene | null = null;
    private network!: NetworkManager;
    private player!: Player;
    private getGroundHeight: (x: number, z: number) => number = () => 0;
    private getFetchableDrops: () => FetchableDrop[] = () => [];

    private instance: CompanionInstance | null = null;
    private activeId: CompanionId | null = null;
    private equippedId: CompanionId | null = null;
    private companionStateKnown = false;
    private legacyDogOwned = false;
    private locationId = "";
    private elapsed = 0;

    private mode: PetMode = "follow";
    private targetId: string | null = null;
    private target = new THREE.Vector3();
    private lastPickupAt = new Map<string, number>();

    private readonly desired = new THREE.Vector3();
    private readonly toTarget = new THREE.Vector3();
    private readonly ownerLast = new THREE.Vector3();
    private readonly threatSpot = new THREE.Vector3();
    private readonly muzzle = new THREE.Vector3();
    private ownerTracked = false;
    private restTimer = 0;
    private combatUntil = 0;
    private isInCombat: () => boolean = () => false;
    private getThreat: (from: THREE.Vector3, range: number) => PetThreat | null = () => null;

    private tuning: PetTuning = {
        followDistance: FOLLOW_DISTANCE,
        followSide: FOLLOW_SIDE,
        scale: PET_SCALE,
        runSpeed: RUN_SPEED,
        walkSpeed: WALK_SPEED,
    };

    public getTuning(): PetTuning {
        return { ...this.tuning };
    }

    public setTuning(next: PetTuning) {
        this.tuning = {
            followDistance: Math.max(0.5, Math.min(8, next.followDistance)),
            followSide: Math.max(-4, Math.min(4, next.followSide)),
            scale: Math.max(0.3, Math.min(3, next.scale)),
            runSpeed: Math.max(1, Math.min(RUN_SPEED, next.runSpeed)),
            walkSpeed: Math.max(0.5, Math.min(RUN_SPEED, next.walkSpeed)),
        };
        if (this.instance) this.instance.root.scale.setScalar(this.tuning.scale);
    }

    init(
        network: NetworkManager,
        player: Player,
        getGroundHeight: (x: number, z: number) => number,
        getFetchableDrops: () => FetchableDrop[],
        isInCombat?: () => boolean,
        getThreat?: (from: THREE.Vector3, range: number) => PetThreat | null
    ) {
        this.network = network;
        this.player = player;
        this.getGroundHeight = getGroundHeight;
        this.getFetchableDrops = getFetchableDrops;
        if (isInCombat) this.isInCombat = isInCombat;
        if (getThreat) this.getThreat = getThreat;
    }

    public fireAt(target: THREE.Vector3): THREE.Vector3 | null {
        if (!this.instance || !this.isActive()) return null;

        const root = this.instance.root;
        root.rotation.y = Math.atan2(target.x - root.position.x, target.z - root.position.z);
        root.updateMatrixWorld(true);

        this.instance.attack?.();
        if (!this.instance.getMuzzle?.(this.muzzle)) return null;
        return this.muzzle;
    }

    public setCombatUntil(until: number) {
        this.combatUntil = until;
    }

    public setScene(scene: THREE.Scene) {
        if (this.scene === scene) return;
        this.scene = scene;
        if (this.instance && this.isActive()) {
            scene.add(this.instance.root);
            this.snapToPlayer();
            return;
        }
        this.syncPresence();
    }

    public setLocation(locationId: string) {
        if (this.locationId === locationId) return;
        this.locationId = locationId;
        this.resetFetch();
        this.syncPresence();
    }

    public setEquipped(companionId: string | null) {
        const next = isCompanionId(companionId) ? companionId : null;
        const wasKnown = this.companionStateKnown;
        this.companionStateKnown = true;
        if (wasKnown && this.equippedId === next) return;
        this.equippedId = next;
        this.syncPresence();
    }

    public setOwnedFromPlaceables(placeables: Record<string, number>) {
        const owned = (placeables[DEFAULT_COMPANION_ID] || 0) > 0;
        if (this.legacyDogOwned === owned) return;
        this.legacyDogOwned = owned;
        this.syncPresence();
    }

    private wantedCompanion(): CompanionId | null {
        if (this.companionStateKnown) return this.equippedId;
        return this.legacyDogOwned ? DEFAULT_COMPANION_ID : null;
    }

    public isActive(): boolean {
        return this.wantedCompanion() !== null && !this.locationId.startsWith(BLOCKED_LOCATION_PREFIX);
    }

    private syncPresence() {
        const wanted = this.isActive() ? this.wantedCompanion() : null;
        if (wanted === this.activeId) return;
        this.despawn();
        if (wanted) this.spawn(wanted);
    }

    private spawn(companionId: CompanionId) {
        if (this.instance || !this.scene) return;
        this.instance = createCompanion(companionId);
        this.activeId = companionId;
        this.instance.root.scale.setScalar(this.tuning.scale);
        this.scene.add(this.instance.root);
        this.snapToPlayer();
    }

    private despawn() {
        this.activeId = null;
        if (!this.instance) return;
        this.instance.dispose();
        this.instance = null;
        this.resetFetch();
    }

    private resetFetch() {
        this.mode = "follow";
        this.targetId = null;
        this.restTimer = 0;
        this.lastPickupAt.clear();
    }

    private snapToPlayer() {
        this.restTimer = 0;
        this.ownerTracked = false;
        if (!this.instance) return;
        const p = this.player.mesh.position;
        const yaw = this.player.mesh.rotation.y;
        const x = p.x - Math.sin(yaw) * this.tuning.followDistance + Math.cos(yaw) * this.tuning.followSide;
        const z = p.z - Math.cos(yaw) * this.tuning.followDistance - Math.sin(yaw) * this.tuning.followSide;
        this.instance.root.position.set(x, this.getGroundHeight(x, z), z);
    }

    private pickTarget(): void {
        const drops = this.getFetchableDrops();
        if (drops.length === 0) {
            this.targetId = null;
            this.mode = "follow";
            return;
        }

        const from = this.player.mesh.position;
        let best: FetchableDrop | null = null;
        let bestDist = FETCH_RADIUS;

        for (const drop of drops) {
            const dist = drop.position.distanceTo(from);
            if (dist > bestDist) continue;
            best = drop;
            bestDist = dist;
        }

        if (!best) {
            this.targetId = null;
            this.mode = "follow";
            return;
        }

        this.targetId = best.id;
        this.target.copy(best.position);
        this.mode = "fetch";
    }

    public update(delta: number) {
        if (!this.instance || !this.isActive()) return;

        this.elapsed += delta;
        const root = this.instance.root;
        const playerPos = this.player.mesh.position;

        if (root.position.distanceTo(playerPos) > FOLLOW_TELEPORT_DISTANCE) {
            this.snapToPlayer();
            this.resetFetch();
        }

        const combat = Date.now() < this.combatUntil || this.isInCombat();
        const threat = combat ? this.getThreat(playerPos, ATTACK_RANGE) : null;

        if (threat) {
            this.mode = "attack";
            this.targetId = null;
            this.threatSpot.copy(threat.position);
        } else if (this.mode === "attack") {
            this.mode = "return";
        }

        if (this.mode === "fetch") {
            const drops = this.getFetchableDrops();
            const current = this.targetId ? drops.find((d) => d.id === this.targetId) : undefined;
            if (!current) {
                this.mode = "return";
                this.targetId = null;
            } else {
                this.target.copy(current.position);
            }
        }

        if (this.mode !== "fetch" && this.mode !== "attack" && !combat) this.pickTarget();

        let speed = this.tuning.walkSpeed;
        if (this.mode === "attack") {
            this.standoffFor(this.threatSpot, playerPos);
            const gap = Math.hypot(this.desired.x - root.position.x, this.desired.z - root.position.z);
            speed = gap > 0.6 ? this.tuning.runSpeed : 0;
        } else if (this.mode === "fetch") {
            this.desired.copy(this.target);
            speed = this.tuning.runSpeed;
        } else {
            const yaw = this.player.mesh.rotation.y;
            const behindX = playerPos.x - Math.sin(yaw) * this.tuning.followDistance + Math.cos(yaw) * this.tuning.followSide;
            const behindZ = playerPos.z - Math.cos(yaw) * this.tuning.followDistance - Math.sin(yaw) * this.tuning.followSide;
            this.desired.set(behindX, playerPos.y, behindZ);
            const gap = root.position.distanceTo(this.desired);
            speed = gap > 6 ? this.tuning.runSpeed : this.tuning.walkSpeed;
            if (gap < 0.5) speed = 0;
            if (this.mode === "return" && gap < 1.5) this.mode = "follow";
        }

        this.toTarget.set(this.desired.x - root.position.x, 0, this.desired.z - root.position.z);
        const distance = this.toTarget.length();

        if (speed > 0 && distance > 0.05) {
            const step = Math.min(speed * delta, distance);
            this.toTarget.normalize();
            root.position.x += this.toTarget.x * step;
            root.position.z += this.toTarget.z * step;
            if (this.mode !== "attack") root.rotation.y = Math.atan2(this.toTarget.x, this.toTarget.z);
        }

        if (this.mode === "attack") this.turnTowards(root, this.threatSpot, delta, ATTACK_FACE_RATE);

        root.position.y = this.getGroundHeight(root.position.x, root.position.z);

        if (this.mode === "fetch" && this.targetId && distance <= PICKUP_REACH) {
            const now = Date.now();
            const last = this.lastPickupAt.get(this.targetId) || 0;
            if (now - last >= PICKUP_RETRY_MS) {
                this.lastPickupAt.set(this.targetId, now);
                this.network.sendLootPickup(this.targetId, true);
            }
        }

        const ownerStill = this.ownerIsStill(playerPos, delta);
        const parked = this.mode === "follow" && speed <= 0 && distance <= 0.6;

        if (combat || !parked || !ownerStill) this.restTimer = 0;
        else this.restTimer += delta;

        const resting = this.restTimer >= REST_DELAY;
        if (resting) this.turnTowards(root, playerPos, delta, REST_FACE_RATE);

        const speed01 = speed <= 0 ? 0 : Math.min(1, speed / this.tuning.runSpeed);
        this.instance.update(this.elapsed, speed01, this.mode === "return", { delta, combat, resting });
    }

    private ownerIsStill(playerPos: THREE.Vector3, delta: number): boolean {
        const travelled = Math.hypot(playerPos.x - this.ownerLast.x, playerPos.z - this.ownerLast.z);
        const tracked = this.ownerTracked;

        this.ownerLast.copy(playerPos);
        this.ownerTracked = true;

        if (!tracked || delta <= 0) return false;
        return travelled / delta < OWNER_STILL_SPEED;
    }

    private turnTowards(root: THREE.Group, point: THREE.Vector3, delta: number, rate: number) {
        const target = Math.atan2(point.x - root.position.x, point.z - root.position.z);
        let diff = target - root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        root.rotation.y += diff * Math.min(1, delta * rate);
    }

    private standoffFor(threat: THREE.Vector3, playerPos: THREE.Vector3) {
        let awayX = playerPos.x - threat.x;
        let awayZ = playerPos.z - threat.z;
        const span = Math.hypot(awayX, awayZ);

        if (span < 0.001) {
            awayX = 0;
            awayZ = 1;
        } else {
            awayX /= span;
            awayZ /= span;
        }

        const reach = Math.max(ATTACK_MIN_GAP, Math.min(span, ATTACK_STANDOFF));

        this.desired.set(
            threat.x + awayX * reach - awayZ * ATTACK_FLANK,
            playerPos.y,
            threat.z + awayZ * reach + awayX * ATTACK_FLANK
        );

        const strayX = this.desired.x - playerPos.x;
        const strayZ = this.desired.z - playerPos.z;
        const stray = Math.hypot(strayX, strayZ);
        if (stray > ATTACK_LEASH) {
            const scale = ATTACK_LEASH / stray;
            this.desired.set(playerPos.x + strayX * scale, playerPos.y, playerPos.z + strayZ * scale);
        }
    }

    public clear() {
        this.resetFetch();
    }

    dispose() {
        this.despawn();
        this.scene = null;
    }
}
