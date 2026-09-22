// src/features/game/world/locations/showcase/rooms/launch/LaunchService.ts
import * as THREE from "three";
import { ResourceManager } from "../../../../../core/ResourceManager";
import { CollisionGrid } from "../../../../CollisionGrid";
import { ShowcaseCrowd, type CrowdSpec } from "../../actors/ShowcaseCrowd";
import type { ShowcaseActor } from "../../actors/ShowcaseActor";
import { SceneTimeline } from "../../scene/SceneTimeline";
import { setSceneSubtitle } from "../../scene/subtitles";
import type { ChartMood } from "./launchTextures";
import {
    CONTROL_SPOT,
    CREW_IDLE_A,
    CREW_IDLE_B,
    ENGINEER_SPOT,
    GUEST_A,
    GUEST_B,
    PAD_DECK_Y,
} from "./launchLayout";
import { buildLaunchScript } from "./launchScript";

export interface LaunchStage {
    setCage(amount: number): void;
    setArm(amount: number): void;
    setHatch(amount: number): void;
    setCount(value: number): void;
    setBlast(amount: number): void;
    setLift(amount: number): void;
    setCharts(mood: ChartMood): void;
    setFlood(amount: number): void;
    requestTransfer(): void;
    cageObject(): THREE.Object3D;
    cabinObject(): THREE.Object3D;
}

const CHART_MOODS: ChartMood[] = ["chop", "dump", "pump"];

export class LaunchService {
    private readonly timeline = new SceneTimeline();
    private readonly cast = new Map<string, ShowcaseActor>();
    private readonly extras: ShowcaseActor[] = [];
    private collected = false;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly stage: LaunchStage,
        private readonly crowd: ShowcaseCrowd,
        private readonly random: () => number
    ) { }

    public getTimeline(): SceneTimeline {
        return this.timeline;
    }

    public create(rm: ResourceManager, grid: CollisionGrid) {
        const rocketLook = new THREE.Vector3(0, PAD_DECK_Y + 14, 0);

        const commander = this.spawn(rm, grid, "commander", {
            position: CREW_IDLE_A.clone(),
            set: "spacer",
            variantIndex: 0,
            lookAt: rocketLook,
            accent: 0xffd166,
        });

        const walter = this.spawn(rm, grid, "walter", {
            position: CREW_IDLE_B.clone(),
            set: "spacer",
            variantIndex: 1,
            lookAt: rocketLook,
        });

        const engineer = this.spawn(rm, grid, "engineer", {
            position: ENGINEER_SPOT.clone(),
            set: "spacer",
            variantIndex: 2,
            pose: "work",
            held: "wrench",
            facing: 1.1,
        });

        const control = this.spawn(rm, grid, "control", {
            position: CONTROL_SPOT.clone(),
            set: "spacer",
            variantIndex: 3,
            pose: "phone",
            held: "phone",
            lookAt: rocketLook,
        });

        const guestA = this.spawn(rm, grid, "guestA", {
            position: GUEST_A.clone(),
            set: "crowd",
            variantIndex: 1,
            lookAt: rocketLook,
            held: "bag",
        });

        const guestB = this.spawn(rm, grid, "guestB", {
            position: GUEST_B.clone(),
            set: "crowd",
            variantIndex: 2,
            pose: "gawk",
            lookAt: rocketLook,
        });

        if (!commander || !walter || !engineer || !control || !guestA || !guestB) return;

        this.timeline.onSubtitle = (subtitle) => setSceneSubtitle(subtitle);

        this.timeline.register("commander", commander, { at: CREW_IDLE_A, face: rocketLook });
        this.timeline.register("walter", walter, { at: CREW_IDLE_B, face: rocketLook });
        this.timeline.register("engineer", engineer, { at: ENGINEER_SPOT, pose: "work", facing: 1.1 });
        this.timeline.register("control", control, { at: CONTROL_SPOT, pose: "phone", face: rocketLook });
        this.timeline.register("guestA", guestA, { at: GUEST_A, face: rocketLook });
        this.timeline.register("guestB", guestB, { at: GUEST_B, pose: "gawk", face: rocketLook });

        this.timeline.sink("mount.commander", (value) => this.mount("commander", Math.round(value)));
        this.timeline.sink("mount.walter", (value) => this.mount("walter", Math.round(value)));
        this.timeline.sink("cage", (value) => this.stage.setCage(value));
        this.timeline.sink("arm", (value) => this.stage.setArm(value));
        this.timeline.sink("hatch", (value) => this.stage.setHatch(value));
        this.timeline.sink("count", (value) => this.stage.setCount(Math.round(value)));
        this.timeline.sink("rocket.blast", (value) => this.stage.setBlast(value));
        this.timeline.sink("rocket.lift", (value) => this.stage.setLift(value));
        this.timeline.sink("pad.flood", (value) => this.stage.setFlood(value));
        this.timeline.sink("charts", (value) => this.stage.setCharts(CHART_MOODS[Math.round(value)] ?? "chop"));
        this.timeline.sink("transfer", (value) => {
            if (value > 0.5) this.stage.requestTransfer();
        });

        buildLaunchScript(this.timeline);
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
