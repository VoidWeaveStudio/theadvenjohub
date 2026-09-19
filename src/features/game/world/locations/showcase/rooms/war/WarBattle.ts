// src/features/game/world/locations/showcase/rooms/war/WarBattle.ts
import * as THREE from "three";
import { ResourceManager } from "../../../../../core/ResourceManager";
import { CollisionGrid } from "../../../../CollisionGrid";
import { ShowcaseCrowd } from "../../actors/ShowcaseCrowd";
import { ShowcaseActor } from "../../actors/ShowcaseActor";
import { WarEffects } from "./WarEffects";

export const TEAM_RED = 0;
export const TEAM_BLUE = 1;

// Rambo fights for red, so the man he guns down — and who is later mourned — is blue.
export const JOHNNY_TEAM = TEAM_BLUE;
export const JOHNNY_VARIANT = 1;

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
// How long Johnny stays down before he is back on his mark.
const JOHNNY_DOWN_TIME = 5;
const HIT_CHANCE = 0.042;
const SPAWN_GRACE = 2.5;
const THIN_TEAM = 6;
const SPREAD = 0.55;
const ADVANCE_SPEED = 4.6;
const ADVANCE_GIVE_UP = 2.5;

export interface BattleSide {
    coverPoints: THREE.Vector3[];
    rearSpawns: THREE.Vector3[];
    variantSet: "soldierRed" | "soldierBlue";
    facing: number;
    // The sandbag line this side holds, and the x of every opening through it.
    wallZ: number;
    gapsX: number[];
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
    waypoint: THREE.Vector3 | null;
    advanceTimer: number;
}

export class WarBattle {
    private fighters: Fighter[] = [];
    private airTarget: THREE.Vector3 | null = null;
    private johnny: Fighter | null = null;
    private readonly johnnyPost = new THREE.Vector3();

    // Johnny is a tagged member of the ordinary red roster — he lives and dies through
    // the same ambient combat as everyone else. These only fire the room's reaction
    // (scream + cradle continuity) at the moments he specifically goes down or comes back.
    public onJohnnyDied: (() => void) | null = null;
    public onJohnnyRevived: (() => void) | null = null;

    private grid: CollisionGrid | null = null;

    private readonly muzzle = new THREE.Vector3();
    private readonly aimPoint = new THREE.Vector3();
    private readonly scratch = new THREE.Vector3();
    private readonly probe = new THREE.Vector3();
    private static readonly COVER_CLEARANCE = new THREE.Vector3(1.1, 1.8, 1.1);

    constructor(
        private readonly crowd: ShowcaseCrowd,
        private readonly effects: WarEffects,
        private readonly random: () => number,
        private readonly sides: [BattleSide, BattleSide]
    ) { }

    // A cover point that sits inside a sandbag mound or a wreck can never be reached, and
    // the fighter sent there just grinds against it. They are dropped up front rather
    // than handled as a special case every time one gets picked.
    private isClear(x: number, z: number): boolean {
        if (!this.grid) return true;
        this.probe.set(x, 0.95, z);
        return !this.grid.checkCollisionHorizontal(this.probe, WarBattle.COVER_CLEARANCE);
    }

    private pruneCoverPoints() {
        for (const side of this.sides) {
            const clear = side.coverPoints.filter((point) => this.isClear(point.x, point.z));
            if (clear.length === 0) continue;
            side.coverPoints.length = 0;
            side.coverPoints.push(...clear);
        }
    }

    public create(rm: ResourceManager, perSide: number, grid?: CollisionGrid, johnnyAnchor?: THREE.Vector3) {
        this.grid = grid ?? null;
        this.pruneCoverPoints();

        const johnnyIndex = this.pickJohnnyIndex(perSide, johnnyAnchor);

        for (const team of [TEAM_RED, TEAM_BLUE]) {
            const side = this.sides[team];

            for (let i = 0; i < perSide; i++) {
                const cover = side.coverPoints[i % side.coverPoints.length];
                const position = cover.clone();
                position.x += (this.random() - 0.5) * 1.4;
                position.z += (this.random() - 0.5) * 1.2;

                const isJohnny = team === JOHNNY_TEAM && i === johnnyIndex;

                const actor = this.crowd.createActor(rm, {
                    position,
                    set: side.variantSet,
                    variantIndex: isJohnny ? JOHNNY_VARIANT : undefined,
                    facing: side.facing,
                    // Johnny is unarmed: he is the one being shot, and empty hands are
                    // what let him throw his arms up as the rounds land.
                    weapon: isJohnny ? undefined : WEAPONS[Math.floor(this.random() * WEAPONS.length)],
                    phase: this.random() * 9,
                    solid: false,
                }, grid);

                if (!actor) continue;

                const fighter: Fighter = {
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
                    waypoint: null,
                    advanceTimer: 0,
                };
                this.fighters.push(fighter);
                if (isJohnny) {
                    this.johnny = fighter;
                    this.johnnyPost.copy(position);
                }

                actor.setCrouch(0.8);
            }
        }
    }

    // Johnny holds the stretch of line Rambo is firing at, so the duel reads from a single
    // camera setup: whichever slot starts closest to the spot in front of his nest.
    private pickJohnnyIndex(perSide: number, anchor?: THREE.Vector3): number {
        if (!anchor) return 0;

        const points = this.sides[JOHNNY_TEAM].coverPoints;
        let best = Infinity;
        let index = 0;

        for (let i = 0; i < perSide; i++) {
            const distance = points[i % points.length].distanceToSquared(anchor);
            if (distance < best) {
                best = distance;
                index = i;
            }
        }

        return index;
    }

    public getJohnnyActor(): ShowcaseActor | null {
        return this.johnny?.actor ?? null;
    }

    public isJohnnyAlive(): boolean {
        return !!this.johnny && this.johnny.state !== "dead";
    }

    public killJohnny(): boolean {
        if (!this.johnny || this.johnny.state === "dead") return false;
        this.kill(this.johnny);
        return true;
    }

    // Johnny is the man being shot at, not a shooter: he holds his ground and throws his
    // arms up with each round that reaches him.
    public flinchJohnny(strength: number) {
        if (!this.johnny || this.johnny.state === "dead") return;
        this.johnny.actor.flinch(strength);
    }

    // Nearest living fighter on `team` to `position`, optionally skipping one actor —
    // used both to pick Rambo's live target and to find who reacts to Johnny going down.
    public nearestLiving(team: number, position: THREE.Vector3, exclude?: ShowcaseActor | null): ShowcaseActor | null {
        let best: Fighter | null = null;
        let bestDist = Infinity;

        for (const fighter of this.fighters) {
            if (fighter.team !== team || fighter.state === "dead") continue;
            if (exclude && fighter.actor === exclude) continue;

            const distance = fighter.actor.position.distanceToSquared(position);
            if (distance < bestDist) {
                bestDist = distance;
                best = fighter;
            }
        }

        return best?.actor ?? null;
    }

    public killNearest(team: number, position: THREE.Vector3): boolean {
        let best: Fighter | null = null;
        let bestDist = Infinity;

        for (const fighter of this.fighters) {
            if (fighter.team !== team || fighter.state === "dead") continue;
            const distance = fighter.actor.position.distanceToSquared(position);
            if (distance < bestDist) {
                bestDist = distance;
                best = fighter;
            }
        }

        if (!best) return false;
        this.kill(best);
        return true;
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

    // Nothing here can path-find, and the sandbag line runs the width of the field, so a
    // cover point on the far side of it has to be reached through an opening. One
    // waypoint at the nearest gap is enough: from there the destination is a clear run.
    private sendTo(fighter: Fighter, destination: THREE.Vector3) {
        const side = this.sides[fighter.team];
        const from = fighter.actor.position;
        const crossing = (from.z - side.wallZ) * (destination.z - side.wallZ) < 0;

        if (!crossing) {
            fighter.waypoint = null;
            fighter.actor.setDestination(destination, ADVANCE_SPEED);
            return;
        }

        let gapX = side.gapsX[0] ?? 0;
        let best = Infinity;
        for (const x of side.gapsX) {
            const cost = Math.abs(x - from.x) + Math.abs(x - destination.x);
            if (cost < best) {
                best = cost;
                gapX = x;
            }
        }

        fighter.waypoint = destination.clone();
        this.scratch.set(gapX, destination.y, side.wallZ);
        fighter.actor.setDestination(this.scratch, ADVANCE_SPEED);
    }

    private pickCover(fighter: Fighter): THREE.Vector3 {
        const points = this.sides[fighter.team].coverPoints;
        const point = points[Math.floor(this.random() * points.length)];

        // The jitter that spreads fighters along the line can just as easily push one
        // into the scenery, so keep the offset only while it stays clear.
        for (let attempt = 0; attempt < 4; attempt++) {
            const x = point.x + (this.random() - 0.5) * 1.6;
            const z = point.z + (this.random() - 0.5) * 1.3;
            if (this.isClear(x, z)) return new THREE.Vector3(x, point.y, z);
        }

        return point.clone();
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

        // Johnny only ever goes down on Rambo's count, never to a stray round from the
        // ambient firefight — otherwise the ten seconds are not the ten seconds.
        const victim = fighter.target;
        if (!air && victim && victim !== this.johnny && victim.graceTimer <= 0 && this.random() < HIT_CHANCE) {
            const thin = this.livingCount(victim.team) <= THIN_TEAM;
            if (!thin || this.random() < 0.35) this.kill(victim);
        }
    }

    private kill(fighter: Fighter) {
        if (fighter.state === "dead") return;

        fighter.state = "dead";

        if (fighter === this.johnny) {
            // Johnny runs to a fixed beat for the camera: down for a set count, then
            // straight back on his feet.
            fighter.deadTimer = JOHNNY_DOWN_TIME;
        } else {
            const thin = this.livingCount(fighter.team) <= THIN_TEAM;
            fighter.deadTimer = thin
                ? 2 + this.random() * 3
                : DEAD_MIN + this.random() * (DEAD_MAX - DEAD_MIN);
        }
        fighter.target = null;
        fighter.burst = 0;

        fighter.actor.chestWorld(this.scratch);
        this.effects.spawnPuff(this.scratch, 0.6, 0.5, 0.7, 0x8a3b32, 0.55);
        fighter.actor.die();

        if (fighter === this.johnny) this.onJohnnyDied?.();
    }

    private respawn(fighter: Fighter) {
        const side = this.sides[fighter.team];

        // He is back on the same mark, on his feet, with no run-in from the rear: the
        // shot is of Rambo cutting him down, and waiting for him to jog into frame each
        // time killed the rhythm.
        if (fighter === this.johnny) {
            fighter.actor.revive(this.johnnyPost, side.facing);
            fighter.state = "hold";
            fighter.waypoint = null;
            fighter.advanceTimer = 0;
            fighter.graceTimer = 0;
            fighter.cover = this.johnnyPost.clone();
            fighter.actor.setCrouch(0);
            fighter.actor.setFiring(false);
            this.onJohnnyRevived?.();
            return;
        }
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
        fighter.advanceTimer = 0;
        fighter.actor.setCrouch(0);
        this.sendTo(fighter, fighter.cover);
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
                fighter.advanceTimer += delta;

                // Whatever it is caught on, a soldier grinding against scenery for this
                // long reads as broken. Take the ground it is standing on as the new
                // position and start shooting from there.
                if (fighter.advanceTimer > ADVANCE_GIVE_UP) {
                    fighter.waypoint = null;
                    actor.setDestination(null);
                }

                if (!actor.hasDestination()) {
                    // Reached the gap — carry on to the cover it was heading for.
                    if (fighter.waypoint) {
                        const destination = fighter.waypoint;
                        fighter.waypoint = null;
                        actor.setDestination(destination, ADVANCE_SPEED);
                        continue;
                    }

                    fighter.cover = actor.position.clone();
                    fighter.state = "hold";
                    fighter.holdTimer = HOLD_MIN + this.random() * (HOLD_MAX - HOLD_MIN);
                    fighter.fireTimer = this.random() * 0.8;
                    actor.setCrouch(0.8);
                    actor.faceTowards(this.aimFacing(fighter));
                }
                continue;
            }

            // Johnny never advances and never fires — he stands in Rambo's line and takes
            // it, which is the whole point of the shot.
            if (fighter === this.johnny) {
                actor.setFiring(false);
                actor.setCrouch(0);
                actor.faceTowards(this.aimFacing(fighter));
                continue;
            }

            fighter.holdTimer -= delta;
            if (fighter.holdTimer <= 0) {
                fighter.cover = this.pickCover(fighter);
                fighter.state = "advance";
                fighter.advanceTimer = 0;
                fighter.burst = 0;
                actor.setFiring(false);
                actor.setCrouch(0);
                actor.setAim(0);
                this.sendTo(fighter, fighter.cover);
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
