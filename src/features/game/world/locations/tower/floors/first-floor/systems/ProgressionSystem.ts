// src/features/game/world/locations/tower/floors/first-floor/systems/ProgressionSystem.ts
import * as THREE from "three";
import { CANYON_START_Z, SEAL_TRIGGER_MARGIN, segmentStartZ } from "../utils/canyonMath";
import { biomeFromKey } from "../utils/canyonBiomes";
import type { CanyonClearedInfo, CanyonHubInfo, CanyonSegmentInfo } from "../FirstFloor";
import type { FirstFloor } from "../FirstFloor";

export class ProgressionSystem {
    private hubGateOpen: boolean = false;

    constructor(private floor: FirstFloor) { }

    applyFreshSegment(info: CanyonSegmentInfo): void {
        const removed = [...(this.floor.current?.interactables ?? []), ...(this.floor.pendingNext?.interactables ?? [])];
        if (this.floor.current) this.floor.segmentBuilder.disposeContent(this.floor.current);
        if (this.floor.pendingNext) this.floor.segmentBuilder.disposeContent(this.floor.pendingNext);
        this.floor.pendingNext = null;
        this.floor.thresholdZ = null;

        this.hubGateOpen = false;
        this.floor.gateAnimation.resetGate(this.floor.hub.farGate, this.floor.hub);

        this.floor.inHub = false;
        this.floor.segment = info.segment;
        this.floor.applyBiome(info.biome, info.segment);
        this.floor.current = this.floor.segmentBuilder.buildSegment(info.segment, this.floor.biome);

        this.floor.segmentBuilder.buildGateWallInto(this.floor.current, segmentStartZ(info.segment));
        this.floor.segmentBuilder.rebuildCollisionGrid();

        this.floor.onInteractablesChanged?.(this.floor.current.interactables, removed);
    }

    applyHub(info: CanyonHubInfo): void {
        const removed = [...(this.floor.current?.interactables ?? []), ...(this.floor.pendingNext?.interactables ?? [])];
        if (this.floor.current) this.floor.segmentBuilder.disposeContent(this.floor.current);
        if (this.floor.pendingNext) this.floor.segmentBuilder.disposeContent(this.floor.pendingNext);
        this.floor.current = null;
        this.floor.pendingNext = null;
        this.floor.thresholdZ = null;

        this.floor.inHub = true;
        this.hubGateOpen = false;
        this.floor.gateAnimation.resetGate(this.floor.hub.farGate, this.floor.hub);
        this.floor.segmentBuilder.rebuildCollisionGrid();

        this.floor.onInteractablesChanged?.(this.floor.hub.interactables, removed);
    }

    applyBossDefeated(info: CanyonClearedInfo): void {
        if (!this.floor.current) return;
        this.floor.segment = info.segment;
        this.floor.gateAnimation.startCrumble(this.floor.current.farGate);
        if (this.floor.current.arrow) this.floor.current.arrow.visible = true;

        const idx = this.floor.current.colliders.indexOf(this.floor.current.farGate.collider);
        if (idx !== -1) this.floor.current.colliders.splice(idx, 1);

        const next = this.floor.segmentBuilder.buildSegment(info.segment, biomeFromKey(info.biome, info.segment));
        this.floor.pendingNext = next;
        this.floor.thresholdZ = segmentStartZ(info.segment);
        this.floor.segmentBuilder.rebuildCollisionGrid();

        this.floor.onInteractablesChanged?.(next.interactables, []);
    }

    private sealBehindAndPromote() {
        if (!this.floor.current || !this.floor.pendingNext || this.floor.thresholdZ === null) return;
        this.floor.onSegmentCrossed?.();
        const removedInteractables = this.floor.current.interactables;
        this.floor.segmentBuilder.disposeContent(this.floor.current);

        const sealGate = this.floor.segmentBuilder.buildGateWallInto(this.floor.pendingNext, this.floor.thresholdZ);
        this.floor.gateAnimation.startReform(sealGate);

        this.floor.current = this.floor.pendingNext;
        this.floor.pendingNext = null;
        this.floor.thresholdZ = null;
        this.floor.segmentBuilder.rebuildCollisionGrid();

        this.floor.onInteractablesChanged?.([], removedInteractables);
    }

    checkHubGateTrigger(playerPosition: THREE.Vector3) {
        if (this.floor.inHub) {
            if (!this.hubGateOpen && playerPosition.z >= CANYON_START_Z - 15 && playerPosition.z <= CANYON_START_Z + 5) {
                this.hubGateOpen = true;
                const idx = this.floor.hub.colliders.indexOf(this.floor.hub.farGate.collider);
                if (idx !== -1) this.floor.hub.colliders.splice(idx, 1);
                this.floor.segmentBuilder.rebuildCollisionGrid();
                this.floor.gateAnimation.startCrumble(this.floor.hub.farGate);
                this.floor.onReadyToEnterDungeon?.();
            }
        } else if (this.floor.thresholdZ !== null && this.floor.pendingNext && playerPosition.z >= this.floor.thresholdZ + SEAL_TRIGGER_MARGIN) {
            this.sealBehindAndPromote();
        }
    }
}
