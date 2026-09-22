// src/features/game/world/locations/showcase/rooms/moon/MoonMission.ts
import * as THREE from "three";
import { ResourceManager } from "../../../../../core/ResourceManager";
import { CollisionGrid } from "../../../../CollisionGrid";
import { ShowcaseCrowd, type CrowdSpec } from "../../actors/ShowcaseCrowd";
import type { ShowcaseActor } from "../../actors/ShowcaseActor";
import { SceneTimeline } from "../../scene/SceneTimeline";
import { setSceneSubtitle } from "../../scene/subtitles";
import {
    MEET_SPOT,
    NEIGHBOUR_MATE,
    NEIGHBOUR_SPOT,
    TEAM_SPOT_A,
    TEAM_SPOT_B,
    crewSeat,
} from "./moonLayout";
import { buildMoonScript } from "./moonScript";

export interface MoonStage {
    setCage(amount: number): void;
    setArm(amount: number): void;
    setHatch(amount: number): void;
    setBlast(amount: number): void;
    setLift(amount: number): void;
    setDust(amount: number): void;
    setGalaxy(amount: number): void;
    setFieldBusy(busy: boolean): void;
    setRadio(active: boolean): void;
    setNeighbourBlast(amount: number): void;
    setNeighbourLift(amount: number): void;
    cageObject(): THREE.Object3D;
    cabinObject(): THREE.Object3D;
}


export class MoonMission {
    private readonly timeline = new SceneTimeline();
    private readonly cast = new Map<string, ShowcaseActor>();
    private readonly extras: ShowcaseActor[] = [];
    private collected = false;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly stage: MoonStage,
        private readonly crowd: ShowcaseCrowd,
        private readonly random: () => number
    ) { }

    public getTimeline(): SceneTimeline {
        return this.timeline;
    }

    public create(rm: ResourceManager, grid: CollisionGrid) {
        const meetLook = new THREE.Vector3(NEIGHBOUR_SPOT.x, 1.6, NEIGHBOUR_SPOT.z);
        const crewLook = new THREE.Vector3(MEET_SPOT.x, 1.6, MEET_SPOT.z);

        const commanderSeat = crewSeat("commander");
        const walterSeat = crewSeat("walter");

        const commander = this.spawn(rm, grid, "commander", {
            position: commanderSeat.clone(),
            set: "spacer",
            variantIndex: 0,
            pose: "sit",
            facing: Math.PI,
            accent: 0xffd166,
        });

        const walter = this.spawn(rm, grid, "walter", {
            position: walterSeat.clone(),
            set: "spacer",
            variantIndex: 1,
            pose: "sit",
            facing: Math.PI,
        });

        const neighbour = this.spawn(rm, grid, "neighbour", {
            position: NEIGHBOUR_SPOT.clone(),
            set: "spacer",
            variantIndex: 2,
            pose: "work",
            held: "wrench",
            lookAt: meetLook,
            accent: 0x3ddc84,
        });

        const neighbourMate = this.spawn(rm, grid, "neighbourMate", {
            position: NEIGHBOUR_MATE.clone(),
            set: "spacer",
            variantIndex: 3,
            pose: "work",
            held: "wrench",
            lookAt: meetLook,
            accent: 0x3ddc84,
        });

        const teamA = this.spawn(rm, grid, "teamA", {
            position: TEAM_SPOT_A.clone(),
            set: "spacer",
            variantIndex: 4,
            pose: "gawk",
            lookAt: crewLook,
        });

        const teamB = this.spawn(rm, grid, "teamB", {
            position: TEAM_SPOT_B.clone(),
            set: "spacer",
            variantIndex: 5,
            pose: "carry",
            held: "bag",
            lookAt: crewLook,
        });

        if (!commander || !walter || !neighbour || !neighbourMate || !teamA || !teamB) return;

        this.timeline.onSubtitle = (subtitle) => setSceneSubtitle(subtitle);

        this.timeline.register("commander", commander, { at: commanderSeat, pose: "sit", facing: Math.PI });
        this.timeline.register("walter", walter, { at: walterSeat, pose: "sit", facing: Math.PI });
        this.timeline.register("neighbour", neighbour, { at: NEIGHBOUR_SPOT, pose: "work", face: meetLook });
        this.timeline.register("neighbourMate", neighbourMate, { at: NEIGHBOUR_MATE, pose: "work", face: meetLook });
        this.timeline.register("teamA", teamA, { at: TEAM_SPOT_A, pose: "gawk", face: crewLook });
        this.timeline.register("teamB", teamB, { at: TEAM_SPOT_B, pose: "carry", face: crewLook });

        this.timeline.sink("mount.commander", (value) => this.mount("commander", Math.round(value)));
        this.timeline.sink("mount.walter", (value) => this.mount("walter", Math.round(value)));
        this.timeline.sink("cage", (value) => this.stage.setCage(value));
        this.timeline.sink("arm", (value) => this.stage.setArm(value));
        this.timeline.sink("hatch", (value) => this.stage.setHatch(value));
        this.timeline.sink("rocket.blast", (value) => this.stage.setBlast(value));
        this.timeline.sink("rocket.lift", (value) => this.stage.setLift(value));
        this.timeline.sink("dust", (value) => this.stage.setDust(value));
        this.timeline.sink("galaxy", (value) => this.stage.setGalaxy(value));
        this.timeline.sink("field.busy", (value) => this.stage.setFieldBusy(value > 0.5));
        this.timeline.sink("radio", (value) => this.stage.setRadio(value > 0.5));
        this.timeline.sink("neighbour.blast", (value) => this.stage.setNeighbourBlast(value));
        this.timeline.sink("neighbour.lift", (value) => this.stage.setNeighbourLift(value));

        buildMoonScript(this.timeline);
    }

    private spawn(rm: ResourceManager, grid: CollisionGrid, id: string, spec: Omit<CrowdSpec, "solid">): ShowcaseActor | null {
        const actor = this.crowd.createActor(rm, { ...spec, phase: this.random() * 8, solid: false }, grid);
        if (actor) this.cast.set(id, actor);
        return actor;
    }

    private mount(id: string, mode: number) {
        const target = mode === 1
            ? this.stage.cageObject()
            : mode === 2
                ? this.stage.cabinObject()
                : this.scene;

        const actor = this.cast.get(id);
        if (!actor || actor.group.parent === target) return;
        target.add(actor.group);
    }

    private collect() {
        this.collected = true;
        const mine = new Set(this.cast.values());

        for (const actor of this.crowd.actors()) {
            if (mine.has(actor)) continue;
            this.extras.push(actor);
        }

        this.timeline.setChorus(this.extras);
    }

    public update(delta: number) {
        if (!this.collected) this.collect();
        this.timeline.update(delta);
    }

    public dispose() {
        this.cast.clear();
        this.extras.length = 0;
        this.collected = false;
        setSceneSubtitle(null);
    }
}
