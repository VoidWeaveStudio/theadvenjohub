// src/features/game/world/locations/showcase/rooms/war/WarBattle.ts
import * as THREE from "three";
import { ResourceManager } from "../../../../../core/ResourceManager";
import { CollisionGrid } from "../../../../CollisionGrid";
import { ShowcaseCrowd } from "../../actors/ShowcaseCrowd";
import { ShowcaseActor } from "../../actors/ShowcaseActor";
import { WarEffects } from "./WarEffects";

const TEAM_RED = 0;
const TEAM_BLUE = 1;

const TRACER_COLORS = [0xffb060, 0x8fd0ff];
const WEAPONS = ["pump-rifle", "bluechip-rifle", "whale-cannon"];

const BURST_MIN = 3;
const BURST_MAX = 7;
const SHOT_INTERVAL = 0.085;
const FIRE_PAUSE_MIN = 0.7;
const FIRE_PAUSE_MAX = 2.4;
const HOLD_MIN = 6;
const HOLD_MAX = 14;
const DEAD_MIN = 5;
const DEAD_MAX = 11;
const HIT_CHANCE = 0.042;
const SPAWN_GRACE = 2.5;
const THIN_TEAM = 6;
const SPREAD = 0.55;
const ADVANCE_SPEED = 4.6;

export interface BattleSide {
    coverPoints: THREE.Vector3[];
    rearSpawns: THREE.Vector3[];
    variantSet: "soldierRed" | "soldierBlue";
    facing: number;
}

interface Fighter {
    actor: ShowcaseActor;
    team: number;
    state: "hold" | "advance" | "dead";
    cover: THREE.Vector3;
    fireTimer: number;
    burst: number;
    shotTimer: number;
    holdTimer: number;
    deadTimer: number;
    graceTimer: number;
    target: Fighter | null;
    airTicket: boolean;
}

export class WarBattle {
    private fighters: Fighter[] = [];
    private airTarget: THREE.Vector3 | null = null;

    private readonly muzzle = new THREE.Vector3();
    private readonly aimPoint = new THREE.Vector3();
    private readonly scratch = new THREE.Vector3();

    constructor(
        private readonly crowd: ShowcaseCrowd,
        private readonly effects: WarEffects,
        private readonly random: () => number,
        private readonly sides: [BattleSide, BattleSide]
    ) { }

    public create(rm: ResourceManager, perSide: number, grid?: CollisionGrid) {
        for (const team of [TEAM_RED, TEAM_BLUE]) {
            const side = this.sides[team];

            for (let i = 0; i < perSide; i++) {
                const cover = side.coverPoints[i % side.coverPoints.length];
                const position = cover.clone();
                position.x += (this.random() - 0.5) * 1.4;
                position.z += (this.random() - 0.5) * 1.2;

                const actor = this.crowd.createActor(rm, {
                    position,
                    set: side.variantSet,
                    facing: side.facing,
                    weapon: WEAPONS[Math.floor(this.random() * WEAPONS.length)],
                    phase: this.random() * 9,
                    solid: false,
                }, grid);

                if (!actor) continue;

                this.fighters.push({
                    actor,
                    team,
                    state: "hold",
                    cover: position.clone(),
                    fireTimer: this.random() * 2.5,
                    burst: 0,
                    shotTimer: 0,
                    holdTimer: HOLD_MIN + this.random() * (HOLD_MAX - HOLD_MIN),
                    deadTimer: 0,
                    graceTimer: 0,
                    target: null,
                    airTicket: this.random() < 0.18,
                });

                actor.setCrouch(0.8);
            }
        }
    }

    public setAirTarget(position: THREE.Vector3 | null) {
        this.airTarget = position;
    }

    public livingCount(team: number): number {
        let count = 0;
        for (const fighter of this.fighters) {
            if (fighter.team === team && fighter.state !== "dead") count++;
        }
        return count;
    }

    private pickTarget(fighter: Fighter): Fighter | null {
        const near: Fighter[] = [];
        const distances: number[] = [];

        for (const other of this.fighters) {
            if (other.team === fighter.team || other.state === "dead") continue;

            const distance = other.actor.position.distanceToSquared(fighter.actor.position);
            let slot = near.length;
            while (slot > 0 && distances[slot - 1] > distance) slot--;

            near.splice(slot, 0, other);
            distances.splice(slot, 0, distance);

            if (near.length > 4) {
                near.pop();
                distances.pop();
            }
        }

        if (near.length === 0) return null;
        return near[Math.floor(this.random() * near.length)];
    }

    private pickCover(fighter: Fighter): THREE.Vector3 {
        const points = this.sides[fighter.team].coverPoints;
        const point = points[Math.floor(this.random() * points.length)];
        return new THREE.Vector3(
            point.x + (this.random() - 0.5) * 1.6,
            point.y,
            point.z + (this.random() - 0.5) * 1.3
        );
    }

    private shoot(fighter: Fighter) {
        const actor = fighter.actor;
        actor.muzzleWorld(this.muzzle);

        const air = fighter.airTicket && this.airTarget;
        if (air && this.airTarget) {
            this.aimPoint.copy(this.airTarget);
        } else if (fighter.target) {
            fighter.target.actor.chestWorld(this.aimPoint);
        } else {
            return;
        }

        this.aimPoint.x += (this.random() - 0.5) * SPREAD * 2;
        this.aimPoint.y += (this.random() - 0.5) * SPREAD;
        this.aimPoint.z += (this.random() - 0.5) * SPREAD * 2;

        this.effects.spawnTracer(this.muzzle, this.aimPoint, TRACER_COLORS[fighter.team]);
        this.effects.spawnFlash(this.muzzle, 0.75, 0xffd9a0);
        actor.kick(0.55);

        const victim = fighter.target;
        if (!air && victim && victim.graceTimer <= 0 && this.random() < HIT_CHANCE) {
            const thin = this.livingCount(victim.team) <= THIN_TEAM;
            if (!thin || this.random() < 0.35) this.kill(victim);
        }
    }

    private kill(fighter: Fighter) {
        if (fighter.state === "dead") return;

        fighter.state = "dead";
        const thin = this.livingCount(fighter.team) <= THIN_TEAM;
        fighter.deadTimer = thin
            ? 2 + this.random() * 3
            : DEAD_MIN + this.random() * (DEAD_MAX - DEAD_MIN);
        fighter.target = null;
        fighter.burst = 0;

        fighter.actor.chestWorld(this.scratch);
        this.effects.spawnPuff(this.scratch, 0.6, 0.5, 0.7, 0x8a3b32, 0.55);
        fighter.actor.die();
    }

    private respawn(fighter: Fighter) {
        const side = this.sides[fighter.team];
        const spawn = side.rearSpawns[Math.floor(this.random() * side.rearSpawns.length)];

        this.scratch.set(
            spawn.x + (this.random() - 0.5) * 6,
            spawn.y,
            spawn.z + (this.random() - 0.5) * 4
        );

        fighter.actor.revive(this.scratch, side.facing);
        fighter.graceTimer = SPAWN_GRACE;
        fighter.cover = this.pickCover(fighter);
        fighter.state = "advance";
        fighter.actor.setCrouch(0);
        fighter.actor.setDestination(fighter.cover, ADVANCE_SPEED);
        fighter.holdTimer = HOLD_MIN + this.random() * (HOLD_MAX - HOLD_MIN);
    }

    public update(delta: number) {
        for (const fighter of this.fighters) {
            const actor = fighter.actor;

            if (fighter.graceTimer > 0) fighter.graceTimer -= delta;

            if (fighter.state === "dead") {
                fighter.deadTimer -= delta;
                if (fighter.deadTimer <= 0) this.respawn(fighter);
                continue;
            }

            if (fighter.state === "advance") {
                if (!actor.hasDestination()) {
                    fighter.state = "hold";
                    fighter.holdTimer = HOLD_MIN + this.random() * (HOLD_MAX - HOLD_MIN);
                    fighter.fireTimer = this.random() * 0.8;
                    actor.setCrouch(0.8);
                    actor.faceTowards(this.aimFacing(fighter));
                }
                continue;
            }

            fighter.holdTimer -= delta;
            if (fighter.holdTimer <= 0) {
                fighter.cover = this.pickCover(fighter);
                fighter.state = "advance";
                fighter.burst = 0;
                actor.setFiring(false);
                actor.setCrouch(0);
                actor.setAim(0);
                actor.setDestination(fighter.cover, ADVANCE_SPEED);
                continue;
            }

            if (!fighter.target || fighter.target.state === "dead") {
                fighter.target = this.pickTarget(fighter);
            }

            if (fighter.burst > 0) {
                fighter.shotTimer -= delta;
                if (fighter.shotTimer <= 0) {
                    fighter.shotTimer = SHOT_INTERVAL;
                    fighter.burst--;
                    this.shoot(fighter);

                    if (fighter.burst === 0) {
                        actor.setFiring(false);
                        actor.setCrouch(0.8);
                        actor.setAim(0);
                        fighter.fireTimer = FIRE_PAUSE_MIN + this.random() * (FIRE_PAUSE_MAX - FIRE_PAUSE_MIN);
                    }
                }
                continue;
            }

            fighter.fireTimer -= delta;
            if (fighter.fireTimer > 0) continue;

            const target = fighter.airTicket && this.airTarget ? this.airTarget : fighter.target?.actor.position;
            if (!target) {
                fighter.fireTimer = 0.6;
                continue;
            }

            fighter.burst = BURST_MIN + Math.floor(this.random() * (BURST_MAX - BURST_MIN));
            fighter.shotTimer = 0;
            actor.setCrouch(fighter.airTicket && this.airTarget ? 0 : 0.28);
            actor.setFiring(true);
            actor.faceTowards(target);

            const dy = target.y - (actor.position.y + 1.2);
            const flat = Math.hypot(target.x - actor.position.x, target.z - actor.position.z);
            actor.setAim(Math.atan2(dy, Math.max(1, flat)));
        }
    }

    private aimFacing(fighter: Fighter): THREE.Vector3 {
        const target = this.pickTarget(fighter);
        if (target) return target.actor.position;

        return this.scratch.set(
            fighter.actor.position.x,
            fighter.actor.position.y,
            fighter.actor.position.z + (fighter.team === TEAM_RED ? 20 : -20)
        );
    }
}
