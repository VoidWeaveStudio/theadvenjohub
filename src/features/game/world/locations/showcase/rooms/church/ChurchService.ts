// src/features/game/world/locations/showcase/rooms/church/ChurchService.ts
import * as THREE from "three";
import { ResourceManager } from "../../../../../core/ResourceManager";
import { CollisionGrid } from "../../../../CollisionGrid";
import { ShowcaseCrowd, type CrowdSpec } from "../../actors/ShowcaseCrowd";
import type { ShowcaseActor } from "../../actors/ShowcaseActor";
import type { PoseId } from "../../actors/poses";
import { SceneTimeline } from "../../scene/SceneTimeline";
import { setSceneSubtitle } from "../../scene/subtitles";
import { PULPIT_FACING, pewSeatPoint, STORY_SEATS, type BoothCell } from "./churchLayout";
import { buildChurchScript, churchSpots } from "./churchScript";

export interface ChurchStage {
    setBoothDoor(cell: BoothCell, open: boolean): void;
    setRoseGlow(amount: number): void;
}

// Filler churchgoers that the sermon stands up. Anyone inside this box is sitting on a
// bench; the choir, the candle table and the aisles are all outside it.
const PEW_ZONE = { minX: 1.8, maxX: 10.2, minZ: -23.5, maxZ: 14 };

interface PewMember {
    actor: ShowcaseActor;
    pose: PoseId | undefined;
    x: number;
    y: number;
    z: number;
}

export class ChurchService {
    private readonly timeline = new SceneTimeline();
    private readonly cast = new Map<string, ShowcaseActor>();
    private readonly pews: PewMember[] = [];
    private readonly extras: ShowcaseActor[] = [];
    private collected = false;
    private standing = false;
    private bagsUp = false;

    constructor(
        private readonly stage: ChurchStage,
        private readonly crowd: ShowcaseCrowd,
        private readonly random: () => number
    ) { }

    public getTimeline(): SceneTimeline {
        return this.timeline;
    }

    public create(rm: ResourceManager, grid: CollisionGrid) {
        const spot = churchSpots();

        const sinner = this.spawn(rm, grid, "sinner", {
            position: spot.gateSpot.clone(),
            set: "flock",
            variantIndex: 1,
            facing: 0,
            held: "bag",
        });

        const father = this.spawn(rm, grid, "father", {
            position: spot.priestSeat.clone(),
            set: "clergy",
            variantIndex: 1,
            pose: "sit",
            lookAt: spot.grille,
        });

        const preacher = this.spawn(rm, grid, "preacher", {
            position: spot.deck.clone(),
            set: "clergy",
            variantIndex: 0,
            pose: "preach",
            held: "book",
            heldHand: "left",
            accent: 0xffd166,
            facing: PULPIT_FACING,
        });

        const holderA = this.spawn(rm, grid, "holderA", {
            position: pewSeatPoint(STORY_SEATS.holderA),
            set: "flock",
            variantIndex: 3,
            pose: "sit",
            facing: 0.06,
        });

        const holderB = this.spawn(rm, grid, "holderB", {
            position: pewSeatPoint(STORY_SEATS.holderB),
            set: "flock",
            variantIndex: 0,
            pose: "sitSlouch",
            facing: -0.06,
        });

        const widowA = this.spawn(rm, grid, "widowA", {
            position: pewSeatPoint(STORY_SEATS.gossipA),
            set: "flock",
            variantIndex: 2,
            pose: "sit",
            facing: 0.08,
        });

        const widowB = this.spawn(rm, grid, "widowB", {
            position: pewSeatPoint(STORY_SEATS.gossipB),
            set: "flock",
            variantIndex: 2,
            pose: "pray",
            facing: -0.08,
        });

        const suppliants = (["suppliantA", "suppliantB", "suppliantC"] as const).map((key) =>
            this.spawn(rm, grid, key, {
                position: pewSeatPoint(STORY_SEATS[key]),
                set: "flock",
                pose: "sit",
                held: "bag",
                facing: 0.04,
            })
        );

        if (!sinner || !father || !preacher || !holderA || !holderB || !widowA || !widowB) return;
        if (suppliants.some((actor) => actor === null)) return;

        this.timeline.onSubtitle = (subtitle) => setSceneSubtitle(subtitle);

        this.timeline.register("sinner", sinner, { at: spot.gateSpot, facing: 0 });
        this.timeline.register("father", father, { at: spot.priestSeat, pose: "sit", face: spot.grille });
        this.timeline.register("preacher", preacher, { at: spot.deck, pose: "preach", facing: PULPIT_FACING });
        this.timeline.register("holderA", holderA, { at: pewSeatPoint(STORY_SEATS.holderA), pose: "sit", facing: 0.06 });
        this.timeline.register("holderB", holderB, { at: pewSeatPoint(STORY_SEATS.holderB), pose: "sitSlouch", facing: -0.06 });
        this.timeline.register("widowA", widowA, { at: pewSeatPoint(STORY_SEATS.gossipA), pose: "sit", facing: 0.08 });
        this.timeline.register("widowB", widowB, { at: pewSeatPoint(STORY_SEATS.gossipB), pose: "pray", facing: -0.08 });

        for (const key of ["suppliantA", "suppliantB", "suppliantC"] as const) {
            const actor = this.cast.get(key);
            if (actor) this.timeline.register(key, actor, { at: pewSeatPoint(STORY_SEATS[key]), pose: "sit", facing: 0.04 });
        }

        this.timeline.sink("door.penitent", (value) => this.stage.setBoothDoor("penitent", value > 0.5));
        this.timeline.sink("door.priest", (value) => this.stage.setBoothDoor("priest", value > 0.5));
        this.timeline.sink("rose", (value) => this.stage.setRoseGlow(value));
        this.timeline.sink("congregation.stand", (value) => {
            this.standing = value > 0.5;
            this.applyCongregation();
        });
        this.timeline.sink("bags.up", (value) => {
            this.bagsUp = value > 0.5;
            this.applyCongregation();
        });

        buildChurchScript(this.timeline, spot);
    }

    private spawn(rm: ResourceManager, grid: CollisionGrid, id: string, spec: Omit<CrowdSpec, "solid">): ShowcaseActor | null {
        const actor = this.crowd.createActor(rm, { ...spec, phase: this.random() * 8, solid: false }, grid);
        if (actor) this.cast.set(id, actor);
        return actor;
    }

    // buildCrowd fills the benches before this runs, but the actors themselves are not
    // built until the room finishes creating, so the seated extras are collected on the
    // first frame instead of during create().
    private collect() {
        this.collected = true;
        const mine = new Set(this.cast.values());

        for (const actor of this.crowd.actors()) {
            if (mine.has(actor)) continue;

            // Everyone in the room shouts along with the sermon, seated or not.
            this.extras.push(actor);

            const position = actor.position;
            const x = Math.abs(position.x);
            if (x < PEW_ZONE.minX || x > PEW_ZONE.maxX) continue;
            if (position.z < PEW_ZONE.minZ || position.z > PEW_ZONE.maxZ) continue;
            if (position.y > 0.2) continue;

            this.pews.push({
                actor,
                pose: actor.currentPose(),
                x: position.x,
                y: position.y,
                z: position.z,
            });
            actor.setScripted(true);
        }

        this.timeline.setChorus(this.extras);
    }

    private applyCongregation() {
        const up = this.standing || this.bagsUp;

        for (const member of this.pews) {
            member.actor.snapPose(this.bagsUp ? "cheer" : up ? undefined : member.pose);
            member.actor.moveTo(member.x, up ? 0 : member.y, member.z);
            member.actor.setMotion("idle");
        }
    }

    public update(delta: number) {
        if (!this.collected) {
            this.collect();
            this.applyCongregation();
        }

        this.timeline.update(delta);
    }

    public dispose() {
        this.cast.clear();
        this.pews.length = 0;
        this.extras.length = 0;
        this.collected = false;
        setSceneSubtitle(null);
    }
}
