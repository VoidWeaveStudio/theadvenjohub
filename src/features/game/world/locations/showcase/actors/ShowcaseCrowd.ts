// src/features/game/world/locations/showcase/actors/ShowcaseCrowd.ts
import * as THREE from "three";
import { ResourceManager } from "../../../../core/ResourceManager";
import { CollisionGrid } from "../../../CollisionGrid";
import { AssetBin } from "../../../AssetBin";
import { ActorSpec, ShowcaseActor, WalkSpec } from "./ShowcaseActor";
import { PoseId } from "./poses";
import { HeldItemId } from "./heldItems";
import { VARIANT_SETS, VariantSetId } from "./variants";

export interface CrowdSpec {
    position: THREE.Vector3;
    set: VariantSetId;
    variantIndex?: number;
    facing?: number;
    lookAt?: THREE.Vector3;
    pose?: PoseId;
    held?: HeldItemId;
    heldHand?: "right" | "left";
    heldLight?: boolean;
    weapon?: string;
    accent?: number;
    tilt?: number;
    scale?: number;
    walk?: WalkSpec;
    phase?: number;
    solid?: boolean;
}

const ACTOR_RADIUS = 0.42;
const ACTOR_HEIGHT = 1.9;

export class ShowcaseCrowd {
    private readonly specs: CrowdSpec[] = [];
    private readonly built: ShowcaseActor[] = [];
    private readonly materials = new Map<string, THREE.Material>();
    private groundAt: ((x: number, z: number) => number) | null = null;

    constructor(private readonly scene: THREE.Scene, private readonly bin: AssetBin, private readonly random: () => number) { }

    public setGroundProvider(provider: ((x: number, z: number) => number) | null) {
        this.groundAt = provider;
    }

    public add(spec: CrowdSpec): void {
        this.specs.push(spec);
    }

    public addMany(specs: CrowdSpec[]): void {
        for (const spec of specs) this.specs.push(spec);
    }

    public count(): number {
        return this.specs.length;
    }

    public createActor(rm: ResourceManager, spec: CrowdSpec, grid?: CollisionGrid): ShowcaseActor | null {
        return this.build(rm, spec, grid);
    }

    public actors(): ShowcaseActor[] {
        return this.built;
    }

    public create(rm: ResourceManager, grid?: CollisionGrid): void {
        for (const spec of this.specs) {
            this.build(rm, spec, grid);
        }
    }

    private build(rm: ResourceManager, spec: CrowdSpec, grid?: CollisionGrid): ShowcaseActor | null {
        const bin = <T extends THREE.Material>(material: T): T => this.bin.material(material);

        {
            const pool = VARIANT_SETS[spec.set];
            const index = spec.variantIndex !== undefined
                ? spec.variantIndex % pool.length
                : Math.floor(this.random() * pool.length) % pool.length;

            const actorSpec: ActorSpec = {
                position: spec.position,
                facing: spec.facing,
                lookAt: spec.lookAt,
                pose: spec.pose,
                variant: pool[index],
                variantKey: `${spec.set}-${index}`,
                held: spec.held,
                heldHand: spec.heldHand,
                heldLight: spec.heldLight,
                weapon: spec.weapon,
                accent: spec.accent,
                tilt: spec.tilt,
                scale: spec.scale ?? 0.95 + this.random() * 0.12,
                walk: spec.walk,
                phase: spec.phase ?? this.random() * 12,
            };

            const actor = new ShowcaseActor(actorSpec);
            if (!actor.create(rm, bin, this.materials)) return null;

            actor.setGroundProvider(spec.walk || spec.weapon ? this.groundAt : null);
            this.scene.add(actor.group);
            this.built.push(actor);

            if (grid && spec.solid !== false && !spec.walk) {
                grid.insertCylinder(
                    new THREE.Vector3(spec.position.x, spec.position.y + ACTOR_HEIGHT * 0.5, spec.position.z),
                    ACTOR_RADIUS,
                    ACTOR_HEIGHT
                );
            }

            return actor;
        }
    }

    public update(delta: number): void {
        for (const actor of this.built) actor.update(delta);
    }

    public dispose(): void {
        for (const actor of this.built) actor.dispose();
        this.built.length = 0;
        this.specs.length = 0;
        this.materials.clear();
    }
}

export function ringWalkPath(center: THREE.Vector3, radius: number, points: number, jitter: number, random: () => number): THREE.Vector3[] {
    const path: THREE.Vector3[] = [];
    for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const distance = radius + (random() - 0.5) * jitter;
        path.push(new THREE.Vector3(
            center.x + Math.cos(angle) * distance,
            center.y,
            center.z + Math.sin(angle) * distance
        ));
    }
    return path;
}

export function patrolPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    return [from.clone(), to.clone()];
}
