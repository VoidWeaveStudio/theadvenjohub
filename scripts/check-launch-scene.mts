// scripts/check-launch-scene.mts
// Offline checks for the two halves of the moon trip: the pad layout must not overlap
// itself, and both timelines must rebuild any frame identically no matter which way
// they are scrubbed. Run with: npx tsx scripts/check-launch-scene.mts
import * as THREE from "three";
import { SceneTimeline } from "../src/features/game/world/locations/showcase/scene/SceneTimeline";
import {
    APRON_RADIUS,
    ARM_Y,
    BUNKER,
    CAGE_HIGH_Y,
    CAGE_X,
    CONTROL_SPOT,
    CREW_IDLE_A,
    CREW_IDLE_B, 
    ENGINEER_SPOT,
    FENCE_RADIUS,
    GATEHOUSE,
    GUEST_A,
    GUEST_B,
    PAD_DECK_Y,
    PAD_RADIUS,
    PERIMETER_BUILDINGS,
    SITE_RADIUS,
    SPAWN,
    STAND_Z,
    TANK_FARM,
    TOWER_SPAN,
    TOWER_X,
    WATER_TOWER,
    cabinDoorSpot,
    cageStandWorld,
    groundHeightAt,
    hatchSpot,
    seatPoint,
    towerDeck,
} from "../src/features/game/world/locations/showcase/rooms/launch/launchLayout";
import { LIFTOFF_TIME, TRANSFER_DELAY, buildLaunchScript } from "../src/features/game/world/locations/showcase/rooms/launch/launchScript";
import {
    FIELD_PADS,
    LANDING_PAD,
    MEET_SPOT,
    MEET_SPOT_B,
    NEIGHBOUR_MATE,
    NEIGHBOUR_SPOT,
    ROCKET_Y,
    TEAM_SPOT_A,
    TEAM_SPOT_B,
    crewSeat,
} from "../src/features/game/world/locations/showcase/rooms/moon/moonLayout";
import { TOUCHDOWN_TIME, buildMoonScript } from "../src/features/game/world/locations/showcase/rooms/moon/moonScript";

const FRAME = 1 / 30;
const problems: string[] = [];

interface Snapshot {
    position: [number, number, number];
    pose: string;
    facing: number;
    motion: string;
}

function mockActor() {
    const state = {
        position: [0, 0, 0] as [number, number, number],
        pose: "none",
        facing: 0,
        motion: "idle",
    };

    return {
        state,
        actor: {
            setScripted() { },
            setFrozen() { },
            setDestination() { },
            moveTo(x: number, y: number, z: number) { state.position = [x, y, z]; },
            snapPose(pose?: string) { state.pose = pose ?? "none"; },
            setFacing(facing: number) { state.facing = facing; },
            setMotion(motion: string) { state.motion = motion; },
            setHeldVisible() { },
            setTalking() { },
            currentPose() { return state.pose === "none" ? undefined : state.pose; },
        },
    };
}

interface SceneCheck {
    label: string;
    cast: string[];
    rest: Record<string, { at: THREE.Vector3; pose?: string; face?: THREE.Vector3; facing?: number }>;
    states: string[];
    build: (timeline: SceneTimeline) => void;
    mounts: Record<string, string>;
}

function runScene(check: SceneCheck) {
    const mocks = new Map<string, ReturnType<typeof mockActor>>();
    const timeline = new SceneTimeline();

    for (const id of check.cast) {
        const mock = mockActor();
        mocks.set(id, mock);
        timeline.register(id, mock.actor as never, check.rest[id] as never);
    }

    const states = new Map<string, number>();
    for (const key of check.states) timeline.sink(key, (value: number) => states.set(key, value));

    check.build(timeline);

    const duration = timeline.duration;
    const frames = Math.round(duration / FRAME);
    console.log(`\n== ${check.label} ==`);
    console.log(`length ${duration.toFixed(2)}s (${frames} frames), ${timeline.lines().length} lines`);

    const snapshot = (): Map<string, Snapshot> => {
        const out = new Map<string, Snapshot>();
        for (const [id, mock] of mocks) {
            out.set(id, {
                position: [...mock.state.position] as [number, number, number],
                pose: mock.state.pose,
                facing: mock.state.facing,
                motion: mock.state.motion,
            });
        }
        return out;
    };

    const same = (a: Map<string, Snapshot>, b: Map<string, Snapshot>): string | null => {
        for (const [id, left] of a) {
            const right = b.get(id);
            if (!right) return `${id} missing`;
            for (let i = 0; i < 3; i++) {
                if (Math.abs(left.position[i] - right.position[i]) > 1e-9) return `${id} position differs`;
            }
            if (left.pose !== right.pose) return `${id} pose ${left.pose} vs ${right.pose}`;
            if (Math.abs(left.facing - right.facing) > 1e-9) return `${id} facing differs`;
            if (left.motion !== right.motion) return `${id} motion differs`;
        }
        return null;
    };

    const forward: Array<Map<string, Snapshot>> = [];
    const stateTrack: Array<Map<string, number>> = [];
    let previous: Map<string, Snapshot> | null = null;
    let previousMounts = new Map<string, number>();

    for (let frame = 0; frame <= frames; frame++) {
        const time = Math.min(duration, frame * FRAME);
        timeline.seek(time);

        const shot = snapshot();
        forward.push(shot);
        stateTrack.push(new Map(states));

        const mounts = new Map<string, number>();
        for (const [id, key] of Object.entries(check.mounts)) mounts.set(id, states.get(key) ?? 0);

        if (previous) {
            for (const [id, now] of shot) {
                const before = previous.get(id)!;
                const step = Math.hypot(
                    now.position[0] - before.position[0],
                    now.position[1] - before.position[1],
                    now.position[2] - before.position[2]
                );
                if (step <= 0.6) continue;
                if (mounts.has(id) && mounts.get(id) !== previousMounts.get(id)) continue;
                problems.push(`${check.label}: ${id} jumps ${step.toFixed(2)} m at ${time.toFixed(2)}s (frame ${frame})`);
            }
        }

        previous = shot;
        previousMounts = mounts;
    }

    for (let frame = frames; frame >= 0; frame--) {
        const time = Math.min(duration, frame * FRAME);
        timeline.seek(time);
        const diff = same(forward[frame], snapshot());
        if (diff) {
            problems.push(`${check.label}: frame ${frame} (${time.toFixed(2)}s) differs when scrubbed backwards: ${diff}`);
            break;
        }
    }

    for (const time of [0, 12.5, 31.2, 64.4, duration * 0.75, duration - 0.1]) {
        timeline.seek(time);
        const first = snapshot();
        timeline.seek(0);
        timeline.seek(time);
        const diff = same(first, snapshot());
        if (diff) problems.push(`${check.label}: seek(${time.toFixed(2)}) is not repeatable: ${diff}`);
    }

    const spans = (timeline as unknown as { cues: Array<{ kind: string; start: number; end: number; text?: string }> }).cues
        .filter((cue) => cue.kind === "line")
        .sort((a, b) => a.start - b.start);

    for (let i = 1; i < spans.length; i++) {
        if (spans[i].start < spans[i - 1].end - 1e-6) {
            problems.push(
                `${check.label}: captions overlap — "${spans[i - 1].text}" ends ${spans[i - 1].end.toFixed(2)}s, ` +
                `"${spans[i].text}" starts ${spans[i].start.toFixed(2)}s`
            );
        }
    }

    const first = forward[0];
    const final = forward[frames];
    for (const id of check.cast) {
        const a = first.get(id)!;
        const b = final.get(id)!;
        const drift = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]);
        if (drift > 0.3) problems.push(`${check.label}: ${id} ends ${drift.toFixed(2)} m from where the loop starts`);
    }

    for (const key of check.states) {
        const start = stateTrack[0].get(key) ?? 0;
        const end = stateTrack[frames].get(key) ?? 0;
        if (Math.abs(start - end) > 0.02) {
            problems.push(`${check.label}: state ${key} ends at ${end.toFixed(2)} but the loop starts at ${start.toFixed(2)}`);
        }
    }

    return { timeline, forward, stateTrack, frames, duration };
}

const rocketLook = new THREE.Vector3(0, PAD_DECK_Y + 14, 0);

const launch = runScene({
    label: "launch",
    cast: ["commander", "walter", "engineer", "control", "guestA", "guestB"],
    rest: {
        commander: { at: CREW_IDLE_A, face: rocketLook },
        walter: { at: CREW_IDLE_B, face: rocketLook },
        engineer: { at: ENGINEER_SPOT, pose: "work", facing: 1.1 },
        control: { at: CONTROL_SPOT, pose: "phone", face: rocketLook },
        guestA: { at: GUEST_A, face: rocketLook },
        guestB: { at: GUEST_B, pose: "gawk", face: rocketLook },
    },
    states: ["mount.commander", "mount.walter", "cage", "arm", "hatch", "count", "rocket.blast", "rocket.lift", "charts", "pad.flood", "transfer"],
    build: buildLaunchScript,
    mounts: { commander: "mount.commander", walter: "mount.walter" },
});

const meetLook = new THREE.Vector3(NEIGHBOUR_SPOT.x, 1.6, NEIGHBOUR_SPOT.z);
const crewLook = new THREE.Vector3(MEET_SPOT.x, 1.6, MEET_SPOT.z);

const moon = runScene({
    label: "moon",
    cast: ["commander", "walter", "neighbour", "neighbourMate", "teamA", "teamB"],
    rest: {
        commander: { at: crewSeat("commander"), pose: "sit", facing: Math.PI },
        walter: { at: crewSeat("walter"), pose: "sit", facing: Math.PI },
        neighbour: { at: NEIGHBOUR_SPOT, pose: "work", face: meetLook },
        neighbourMate: { at: NEIGHBOUR_MATE, pose: "work", face: meetLook },
        teamA: { at: TEAM_SPOT_A, pose: "gawk", face: crewLook },
        teamB: { at: TEAM_SPOT_B, pose: "carry", face: crewLook },
    },
    states: ["mount.commander", "mount.walter", "cage", "arm", "hatch", "rocket.blast", "rocket.lift", "dust", "galaxy", "field.busy", "radio", "neighbour.blast", "neighbour.lift"],
    build: buildMoonScript,
    mounts: { commander: "mount.commander", walter: "mount.walter" },
});

// --- launch: the transfer to the moon fires once, fifteen seconds after liftoff ---
let transferAt = -1;
for (let frame = 0; frame <= launch.frames; frame++) {
    if ((launch.stateTrack[frame].get("transfer") ?? 0) > 0.5) {
        transferAt = frame * FRAME;
        break;
    }
}

if (transferAt < 0) problems.push("launch: the transfer to the moon never fires");
else if (Math.abs(transferAt - (LIFTOFF_TIME + TRANSFER_DELAY)) > FRAME * 2) {
    problems.push(`launch: transfer fires at ${transferAt.toFixed(2)}s, expected ${(LIFTOFF_TIME + TRANSFER_DELAY).toFixed(2)}s`);
}

// --- launch: the crew must be inside before the hatch shuts and the arm swings out ---
for (let frame = 0; frame <= launch.frames; frame++) {
    const mount = launch.stateTrack[frame].get("mount.commander") ?? 0;
    const hatch = launch.stateTrack[frame].get("hatch") ?? 0;
    const arm = launch.stateTrack[frame].get("arm") ?? 0;
    const lift = launch.stateTrack[frame].get("rocket.lift") ?? 0;

    if (mount !== 2 && hatch < 0.5 && lift < 0.001 && frame * FRAME < LIFTOFF_TIME) {
        problems.push(`launch: hatch is shut at ${(frame * FRAME).toFixed(2)}s while the crew is still outside`);
        break;
    }

    if (lift > 0.001 && (mount !== 2 || arm < 0.9)) {
        problems.push(`launch: the rocket leaves at ${(frame * FRAME).toFixed(2)}s with mount=${mount} arm=${arm.toFixed(2)}`);
        break;
    }
}

// --- launch: the board must show what ground control is counting ---
const launchLines = launch.timeline.lines();
const words = ["TEN", "NINE", "EIGHT", "SEVEN", "SIX", "FIVE", "FOUR", "THREE", "TWO", "ONE"];
for (let i = 0; i < words.length; i++) {
    const line = launchLines.find((entry) => entry.text === `${words[i]}.`);
    if (!line) {
        problems.push(`launch: the countdown never says ${words[i]}`);
        continue;
    }
    const frame = Math.round((line.at + 0.2) / FRAME);
    const shown = launch.stateTrack[Math.min(frame, launch.frames)].get("count") ?? 0;
    if (shown !== 10 - i) problems.push(`launch: board shows ${shown} while control says ${words[i]}`);
}

// --- moon: the ship is down before anyone opens the hatch ---
for (let frame = 0; frame <= moon.frames; frame++) {
    const hatch = moon.stateTrack[frame].get("hatch") ?? 0;
    const lift = moon.stateTrack[frame].get("rocket.lift") ?? 0;
    if (hatch > 0.05 && lift > 0.02) {
        problems.push(`moon: hatch opens at ${(frame * FRAME).toFixed(2)}s while the ship is still at lift ${lift.toFixed(2)}`);
        break;
    }
}

for (let frame = 0; frame <= moon.frames; frame++) {
    const mount = moon.stateTrack[frame].get("mount.commander") ?? 0;
    const cage = moon.stateTrack[frame].get("cage") ?? 0;
    if (mount === 1 && frame * FRAME < TOUCHDOWN_TIME) {
        problems.push("moon: the crew is in the cage before touchdown");
        break;
    }
    if (mount === 0 && cage > 0.02 && cage < 0.98) {
        problems.push(`moon: the crew is off the cage at ${(frame * FRAME).toFixed(2)}s while it is mid travel (${cage.toFixed(2)})`);
        break;
    }
}

let galaxyMax = 0;
for (let frame = 0; frame <= moon.frames; frame++) galaxyMax = Math.max(galaxyMax, moon.stateTrack[frame].get("galaxy") ?? 0);
if (galaxyMax < 0.99) problems.push(`moon: the galaxy never reaches full glow (max ${galaxyMax.toFixed(2)})`);

// --- pad layout: nothing sits inside anything else ---
interface Disc {
    label: string;
    x: number;
    z: number;
    radius: number;
}

const padDiscs: Disc[] = [
    { label: "pad deck", x: 0, z: 0, radius: PAD_RADIUS },
    { label: "water tower", x: WATER_TOWER.x, z: WATER_TOWER.z, radius: 5.6 },
    { label: "bunker", x: BUNKER.x, z: BUNKER.z, radius: 12 },
    { label: "tank farm", x: TANK_FARM.x, z: TANK_FARM.z, radius: 9 },
    { label: "stands", x: 0, z: STAND_Z, radius: 13 },
];

for (let i = 0; i < padDiscs.length; i++) {
    for (let j = i + 1; j < padDiscs.length; j++) {
        const a = padDiscs[i];
        const b = padDiscs[j];
        const gap = Math.hypot(a.x - b.x, a.z - b.z) - a.radius - b.radius;
        if (gap < 0) problems.push(`launch: ${a.label} overlaps ${b.label} by ${(-gap).toFixed(2)} m`);
    }

    const reach = Math.hypot(padDiscs[i].x, padDiscs[i].z) + padDiscs[i].radius;
    if (reach > FENCE_RADIUS) problems.push(`launch: ${padDiscs[i].label} reaches past the fence (${reach.toFixed(1)} > ${FENCE_RADIUS})`);
}

if (Math.hypot(SPAWN.x, SPAWN.z) > SITE_RADIUS - 4) problems.push("launch: the spawn point sits outside the walkable site");
if (Math.abs(groundHeightAt(0, 0) - PAD_DECK_Y) > 1e-6) problems.push("launch: the pad centre is not at deck height");
if (Math.abs(groundHeightAt(0, -APRON_RADIUS - 30)) > 1.4) problems.push("launch: the ground beyond the apron is not level enough to stand on");
if (Math.abs(groundHeightAt(0, 120)) > 0.35) problems.push("launch: the outer yards are not flat enough to set buildings on");

// The crew walks the arm at deck height: the tower deck, the arm and the hatch all
// have to sit on the same level or they step through the air.
const deck = towerDeck();
const hatch = hatchSpot();
if (Math.abs(deck.y - ARM_Y) > 1e-6 || Math.abs(hatch.y - ARM_Y) > 1e-6) problems.push("launch: the tower deck and the hatch are not on the arm level");
if (Math.abs(cageStandWorld("commander").y - (CAGE_HIGH_Y + 0.07)) > 1e-6) problems.push("launch: the cage does not stop at the arm level");

const cabinDoor = cabinDoorSpot();
if (Math.abs(cabinDoor.x - hatch.x) > 1e-6) problems.push("launch: the cabin door does not line up with the hatch spot");
if (Math.abs(seatPoint("commander").x - seatPoint("walter").x) < 1) problems.push("launch: the two seats are on top of each other");
if (Math.hypot(TOWER_X, 0) - TOWER_SPAN < 2.8) problems.push("launch: the service tower stands inside the rocket");
if (CAGE_X > TOWER_X) problems.push("launch: the cage hangs on the rocket side of the tower");

// --- the perimeter: buildings ring the site from outside the fence, nothing pokes in ---
for (const building of PERIMETER_BUILDINGS) {
    const reach = Math.hypot(building.x, building.z) - Math.hypot(building.width, building.depth) / 2;
    if (reach < SITE_RADIUS) {
        problems.push(`launch: ${building.id} reaches into the walkable site (nearest corner ${reach.toFixed(1)} < ${SITE_RADIUS})`);
    }
}

for (let i = 0; i < PERIMETER_BUILDINGS.length; i++) {
    for (let j = i + 1; j < PERIMETER_BUILDINGS.length; j++) {
        const a = PERIMETER_BUILDINGS[i];
        const b = PERIMETER_BUILDINGS[j];
        const radiusA = Math.hypot(a.width, a.depth) / 2;
        const radiusB = Math.hypot(b.width, b.depth) / 2;
        const gap = Math.hypot(a.x - b.x, a.z - b.z) - radiusA - radiusB;
        if (gap < 0) problems.push(`launch: ${a.id} overlaps ${b.id} by ${(-gap).toFixed(2)} m`);
    }
}

// The site is closed all the way round: with no gap wider than this the eye reads a
// built-up perimeter instead of open ground running to the horizon.
const bearings = PERIMETER_BUILDINGS
    .map((building) => ({
        angle: Math.atan2(building.z, building.x),
        spread: Math.atan2(Math.max(building.width, building.depth) / 2, Math.hypot(building.x, building.z)),
    }))
    .sort((a, b) => a.angle - b.angle);

let widestGap = 0;
for (let i = 0; i < bearings.length; i++) {
    const current = bearings[i];
    const next = bearings[(i + 1) % bearings.length];
    let gap = next.angle - current.angle;
    if (gap < 0) gap += Math.PI * 2;
    widestGap = Math.max(widestGap, gap - current.spread - next.spread);
}

console.log(`perimeter: ${PERIMETER_BUILDINGS.length} buildings, widest bare arc ${((widestGap * 180) / Math.PI).toFixed(0)} deg`);
if (widestGap > Math.PI * 0.62) {
    problems.push(`launch: the perimeter leaves a ${((widestGap * 180) / Math.PI).toFixed(0)} deg stretch with nothing built on it`);
}

// Everything the story touches has to stay inside the fence, because the fence is the
// wall the player actually runs into.
const inside: Array<[string, { x: number; z: number }]> = [
    ["spawn", SPAWN],
    ["exit gate", { x: -26, z: -74 }],
    ["ground control", CONTROL_SPOT],
    ["engineer clear", { x: -18, z: -46 }],
    ["guest A", GUEST_A],
    ["guest B", GUEST_B],
    ["countdown board", { x: 26, z: -44 }],
    ["water tower", WATER_TOWER],
    ["tank farm", TANK_FARM],
    ["bunker", BUNKER],
];

const gateReach = Math.hypot(GATEHOUSE.x, GATEHOUSE.z);
if (Math.abs(gateReach - FENCE_RADIUS) > 4) {
    problems.push(`launch: the gatehouse stands ${gateReach.toFixed(1)} m out instead of on the fence line (${FENCE_RADIUS})`);
}

for (const [label, spot] of inside) {
    const reach = Math.hypot(spot.x, spot.z);
    if (reach > FENCE_RADIUS - 1) problems.push(`launch: ${label} sits outside the fence (${reach.toFixed(1)} > ${FENCE_RADIUS - 1})`);
}

// --- moon field: the pads have to clear each other, the base and the walkable rim ---
const moonDiscs: Disc[] = [
    { label: "landing pad", x: LANDING_PAD.x, z: LANDING_PAD.z, radius: 14 },
    ...FIELD_PADS.map((pad) => ({ label: `${pad.ticker} pad`, x: pad.x, z: pad.z, radius: 13 })),
    { label: "base domes", x: -26, z: 8, radius: 9 },
    { label: "control", x: 34, z: 10, radius: 8 },
    { label: "flag field", x: -10, z: 19, radius: 7 },
    { label: "solar farm", x: 46, z: 36, radius: 11 },
];

for (let i = 0; i < moonDiscs.length; i++) {
    for (let j = i + 1; j < moonDiscs.length; j++) {
        const a = moonDiscs[i];
        const b = moonDiscs[j];
        const gap = Math.hypot(a.x - b.x, a.z - b.z) - a.radius - b.radius;
        if (gap < 0) problems.push(`moon: ${a.label} overlaps ${b.label} by ${(-gap).toFixed(2)} m`);
    }

    const reach = Math.hypot(moonDiscs[i].x, moonDiscs[i].z) + moonDiscs[i].radius;
    if (reach > 78) problems.push(`moon: ${moonDiscs[i].label} reaches past the walkable rim (${reach.toFixed(1)} > 78)`);
}

const meetGap = Math.hypot(MEET_SPOT.x - MEET_SPOT_B.x, MEET_SPOT.z - MEET_SPOT_B.z);
if (meetGap < 1) problems.push("moon: the two arrivals stand on the same spot");
if (Math.hypot(MEET_SPOT.x - NEIGHBOUR_SPOT.x, MEET_SPOT.z - NEIGHBOUR_SPOT.z) > 12) {
    problems.push("moon: the neighbour crew is too far away to be talking to");
}
if (ROCKET_Y < 1.6) problems.push("moon: the landed ship sits too low for its legs");

console.log(`\nlaunch liftoff ${LIFTOFF_TIME}s, transfer ${transferAt.toFixed(2)}s`);
console.log(`moon touchdown ${TOUCHDOWN_TIME}s, galaxy peak ${galaxyMax.toFixed(2)}`);

if (problems.length === 0) console.log("\nSCENES OK");
else {
    console.log(`\n${problems.length} problem(s):`);
    for (const problem of problems.slice(0, 30)) console.log(" - " + problem);
    process.exitCode = 1;
}
