// scripts/check-church-scene.mts
// Offline checks for the church showcase: the fixed layout must not overlap itself,
// and the service timeline must rebuild any frame identically no matter which way it
// is scrubbed. Run with: npx tsx scripts/check-church-scene.mts
import {
    ALTAR_Z,
    BOOTH_DEPTH,
    BOOTH_WIDTH,
    BOOTH_X,
    BOOTH_Z,
    boothCellPoint,
    boothDoorPoint,
    CHOIR_TIERS,
    CHOIR_X,
    COLUMN_X,
    HALF_WIDTH,
    NAVE_END,
    NAVE_START,
    PEW_CENTER_X,
    PEW_FIRST_Z,
    PEW_ROWS,
    PEW_SEATS,
    PEW_STEP,
    PEW_WIDTH,
    PULPIT_FACING,
    PULPIT_X,
    PULPIT_Z,
    pewSeatPoint,
    pewSeatX,
    pewRowZ,
    STORY_SEATS,
} from "../src/features/game/world/locations/showcase/rooms/church/churchLayout";
import { buildChurchScript, churchSpots } from "../src/features/game/world/locations/showcase/rooms/church/churchScript";
import { SceneTimeline } from "../src/features/game/world/locations/showcase/scene/SceneTimeline";

const problems: string[] = [];


interface Box {
    label: string;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}


function box(label: string, cx: number, cz: number, sx: number, sz: number): Box {
    return { label, minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2 };
}

function overlap(a: Box, b: Box, slack = 0): number {
    const x = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const z = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
    if (x <= slack || z <= slack) return 0;
    return Math.min(x, z);
}

// --- static obstacles, mirrored from ChurchRoom ---
const obstacles: Box[] = [];

for (let z = NAVE_START + 6; z <= ALTAR_Z - 2; z += 7.4) {
    for (const side of [-1, 1]) obstacles.push(box(`column ${side > 0 ? "R" : "L"} z=${z.toFixed(1)}`, side * COLUMN_X, z, 2.3, 2.3));
}

for (let z = NAVE_START + 4; z <= NAVE_END - 4; z += 7.4) {
    for (const side of [-1, 1]) obstacles.push(box(`buttress ${side > 0 ? "R" : "L"} z=${z.toFixed(1)}`, side * (HALF_WIDTH - 1.2), z, 1.4, 1.2));
}

for (let row = 0; row < PEW_ROWS; row++) {
    const z = pewRowZ(row);
    for (const side of [-1, 1]) obstacles.push(box(`pew ${side > 0 ? "R" : "L"} row=${row}`, side * PEW_CENTER_X, z, PEW_WIDTH, 0.9));
}

for (const tier of CHOIR_TIERS) obstacles.push(box(`choir deck z=${tier.z}`, CHOIR_X, tier.z, tier.width, 2.6));

obstacles.push(box("pulpit", PULPIT_X, PULPIT_Z, 3.2, 3.2));

// --- 1. the confessional must not intersect anything ---
const booth = box("booth", BOOTH_X, BOOTH_Z, BOOTH_DEPTH, BOOTH_WIDTH);
for (const other of obstacles) {
    const hit = overlap(booth, other);
    if (hit > 0) problems.push(`booth overlaps ${other.label} by ${hit.toFixed(2)} m`);
}
const wallFace = -(HALF_WIDTH - 0.8);
if (booth.minX < wallFace + 0.05) problems.push(`booth reaches into the wall (minX ${booth.minX.toFixed(2)}, wall face ${wallFace.toFixed(2)})`);

// --- 2. every seat on a bench must be clear of the columns ---
const shoulder = 0.42;
for (let row = 0; row < PEW_ROWS; row++) {
    for (const side of [-1, 1] as Array<-1 | 1>) {
        for (let seat = 0; seat < PEW_SEATS; seat++) {
            const person = box(`seat r${row} s${seat} ${side > 0 ? "R" : "L"}`, pewSeatX(side, seat), pewRowZ(row) + 0.1, shoulder * 2, shoulder * 2);
            for (const other of obstacles) {
                if (other.label.startsWith("pew")) continue;
                const hit = overlap(person, other);
                if (hit > 0) problems.push(`${person.label} sits inside ${other.label} by ${hit.toFixed(2)} m`);
            }
        }
    }
}

// --- 3. the choir stands on its platform, not through it ---
for (const tier of CHOIR_TIERS) {
    for (let i = 0; i < 4; i++) {
        const x = CHOIR_X - 2.7 + i * 1.8;
        if (x - shoulder < CHOIR_X - tier.width / 2 || x + shoulder > CHOIR_X + tier.width / 2) {
            problems.push(`choir singer at x=${x.toFixed(2)} hangs off tier z=${tier.z}`);
        }
    }
}

// --- 4. the story's walk must stay in the open ---
const doorSpot = boothDoorPoint("penitent");
const cellSpot = boothCellPoint("penitent");
const priestDoor = boothDoorPoint("priest");

for (const [label, point] of [["penitent door", doorSpot], ["priest door", priestDoor]] as Array<[string, { x: number; z: number }]>) {
    const stand = box(label, point.x, point.z, shoulder * 2, shoulder * 2);
    for (const other of obstacles) {
        const hit = overlap(stand, other);
        if (hit > 0) problems.push(`${label} stand spot is inside ${other.label} by ${hit.toFixed(2)} m`);
    }
    if (overlap(stand, booth) > 0) problems.push(`${label} stand spot is inside the booth itself`);
}

if (cellSpot.x < booth.minX + 0.2 || cellSpot.x > booth.maxX - 0.2) {
    problems.push(`seated cell spot x=${cellSpot.x.toFixed(2)} is outside the booth shell`);
}

const front = { x: Math.sin(PULPIT_FACING), z: Math.cos(PULPIT_FACING) };
if (front.z > -0.5) problems.push(`the pulpit faces z=${front.z.toFixed(2)}; it should look back down the nave (negative z)`);

const blessSpot = { x: PULPIT_X + front.x * 2.7, z: PULPIT_Z + front.z * 2.7 };
const blessBox = box("bless spot", blessSpot.x, blessSpot.z, shoulder * 2, shoulder * 2);
for (const other of obstacles) {
    const hit = overlap(blessBox, other);
    if (hit > 0) problems.push(`blessing spot is inside ${other.label} by ${hit.toFixed(2)} m`);
}

// The aisle the penitent walks up: from the gate to z = 7 along x = 0.
const aisle = box("aisle walk", 0, (NAVE_START + 10 + 7) / 2, shoulder * 2, 7 - (NAVE_START + 10));
for (const other of obstacles) {
    const hit = overlap(aisle, other);
    if (hit > 0) problems.push(`the central walk crosses ${other.label} by ${hit.toFixed(2)} m`);
}

// --- 5. reserved seats must be real seats ---
for (const [name, seat] of Object.entries(STORY_SEATS)) {
    if (seat.row < 0 || seat.row >= PEW_ROWS) problems.push(`story seat ${name} uses row ${seat.row}`);
    if (seat.seat < 0 || seat.seat >= PEW_SEATS) problems.push(`story seat ${name} uses seat ${seat.seat}`);
}

const keys = new Set(Object.values(STORY_SEATS).map((seat) => `${seat.row}:${seat.side}:${seat.seat}`));
if (keys.size !== Object.keys(STORY_SEATS).length) problems.push("two story actors share the same seat");

console.log(`pews: rows ${PEW_ROWS}, first z ${PEW_FIRST_Z}, step ${PEW_STEP}, seat span ${pewSeatX(-1, 0).toFixed(2)} .. ${pewSeatX(-1, PEW_SEATS - 1).toFixed(2)}`);
console.log(`booth: x ${booth.minX.toFixed(2)}..${booth.maxX.toFixed(2)}, z ${booth.minZ.toFixed(2)}..${booth.maxZ.toFixed(2)}`);
console.log(`bless spot: ${blessSpot.x.toFixed(2)}, ${blessSpot.z.toFixed(2)}`);
console.log(`sinner seat: ${pewSeatPoint(STORY_SEATS.sinner).toArray().map((v) => v.toFixed(2)).join(", ")}`);

if (problems.length === 0) console.log("\nLAYOUT OK");
else {
    console.log(`\n${problems.length} problem(s):`);
    for (const problem of problems) console.log(" - " + problem);
    process.exitCode = 1;
}

const FRAME = 1 / 30;

const CAST = [
    "sinner", "father", "preacher", "holderA", "holderB", "widowA", "widowB",
    "suppliantA", "suppliantB", "suppliantC",
];

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
        talking: false,
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
            setTalking(talking: boolean) { state.talking = talking; },
            currentPose() { return state.pose === "none" ? undefined : state.pose; },
        },
    };
}

const mocks = new Map<string, ReturnType<typeof mockActor>>();
const timeline = new SceneTimeline();
const spot = churchSpots();

// Mirrors the rest states ChurchService registers, so the check exercises the same
// starting conditions as the room does.
const REST: Record<string, { at: unknown; pose?: string; face?: unknown; facing?: number }> = {
    sinner: { at: spot.gateSpot, facing: 0 },
    father: { at: spot.priestSeat, pose: "sit", face: spot.grille },
    preacher: { at: spot.deck, pose: "preach", facing: PULPIT_FACING },
    holderA: { at: pewSeatPoint(STORY_SEATS.holderA), pose: "sit", facing: 0.06 },
    holderB: { at: pewSeatPoint(STORY_SEATS.holderB), pose: "sitSlouch", facing: -0.06 },
    widowA: { at: pewSeatPoint(STORY_SEATS.gossipA), pose: "sit", facing: 0.08 },
    widowB: { at: pewSeatPoint(STORY_SEATS.gossipB), pose: "pray", facing: -0.08 },
    suppliantA: { at: pewSeatPoint(STORY_SEATS.suppliantA), pose: "sit", facing: 0.04 },
    suppliantB: { at: pewSeatPoint(STORY_SEATS.suppliantB), pose: "sit", facing: 0.04 },
    suppliantC: { at: pewSeatPoint(STORY_SEATS.suppliantC), pose: "sit", facing: 0.04 },
};

for (const id of CAST) {
    const mock = mockActor();
    mocks.set(id, mock);
    timeline.register(id, mock.actor as never, REST[id] as never);
}

const states = new Map<string, number>();
for (const key of ["door.penitent", "door.priest", "rose", "congregation.stand", "bags.up"]) {
    timeline.sink(key, (value: number) => states.set(key, value));
}

const subtitles: Array<{ speaker: string; text: string } | null> = [];
timeline.onSubtitle = (subtitle: { speaker: string; text: string } | null) => subtitles.push(subtitle);

buildChurchScript(timeline, spot);

const duration = timeline.duration;
console.log(`scene length: ${duration.toFixed(2)}s (${Math.round(duration / FRAME)} frames), ${timeline.lines().length} lines`);

function snapshot(): Map<string, Snapshot> {
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
}

function same(a: Map<string, Snapshot>, b: Map<string, Snapshot>): string | null {
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
}

// 1. forward pass: record every frame, and check nobody teleports between frames.
const forward: Array<Map<string, Snapshot>> = [];
const stateTrack: Array<Map<string, number>> = [];
const frames = Math.round(duration / FRAME);

let previous: Map<string, Snapshot> | null = null;
for (let frame = 0; frame <= frames; frame++) {
    const time = Math.min(duration, frame * FRAME);
    timeline.seek(time);
    const shot = snapshot();
    forward.push(shot);
    stateTrack.push(new Map(states));

    if (previous) {
        for (const [id, now] of shot) {
            const before = previous.get(id)!;
            const step = Math.hypot(
                now.position[0] - before.position[0],
                now.position[1] - before.position[1],
                now.position[2] - before.position[2]
            );
            if (step > 0.5) {
                problems.push(`${id} jumps ${step.toFixed(2)} m at ${time.toFixed(2)}s (frame ${frame})`);
            }
        }
    }
    previous = shot;
}

// 2. backward pass: the same frame must rebuild identically from the other direction.
for (let frame = frames; frame >= 0; frame--) {
    const time = Math.min(duration, frame * FRAME);
    timeline.seek(time);
    const diff = same(forward[frame], snapshot());
    if (diff) {
        problems.push(`frame ${frame} (${time.toFixed(2)}s) differs when scrubbed backwards: ${diff}`);
        break;
    }
}

// 3. repeat seeks land on the same state.
for (const time of [0, 12.5, 31.2, 77.4, 121.9, 160.3, duration - 0.1]) {
    timeline.seek(time);
    const first = snapshot();
    timeline.seek(0);
    timeline.seek(time);
    const diff = same(first, snapshot());
    if (diff) problems.push(`seek(${time.toFixed(2)}) is not repeatable: ${diff}`);
}

// 4. captions must not overlap each other.
const lines = timeline.lines();
const spans = (timeline as unknown as { cues: Array<{ kind: string; start: number; end: number; speaker?: string; text?: string }> }).cues
    .filter((cue) => cue.kind === "line")
    .sort((a, b) => a.start - b.start);

for (let i = 1; i < spans.length; i++) {
    if (spans[i].start < spans[i - 1].end - 1e-6) {
        problems.push(
            `captions overlap: "${spans[i - 1].text}" ends ${spans[i - 1].end.toFixed(2)}s, ` +
            `"${spans[i].text}" starts ${spans[i].start.toFixed(2)}s`
        );
    }
}

// 5. the door has to be open while the penitent is in the doorway.
const doorX = spot.penitentDoor.x;
const cellX = spot.penitentSeat.x;
for (let frame = 0; frame <= frames; frame++) {
    const sinner = forward[frame].get("sinner")!;
    const x = sinner.position[0];
    const inDoorway = x < doorX - 0.2 && x > cellX + 0.2;
    if (!inDoorway) continue;
    if ((stateTrack[frame].get("door.penitent") ?? 0) < 0.5) {
        problems.push(`penitent is in the doorway at frame ${frame} (${(frame * FRAME).toFixed(2)}s) with the door shut`);
        break;
    }
}

// 6. the window blazes only after the bags go up, and settles back by the loop point.
let roseMax = 0;
let roseAtBags = 0;
for (let frame = 0; frame <= frames; frame++) {
    const rose = stateTrack[frame].get("rose") ?? 0;
    roseMax = Math.max(roseMax, rose);
    if ((stateTrack[frame].get("bags.up") ?? 0) > 0.5) roseAtBags = Math.max(roseAtBags, rose);
}
if (roseMax < 0.99) problems.push(`the rose window never reaches full glow (max ${roseMax.toFixed(2)})`);
if (roseAtBags < 0.99) problems.push("the window does not blaze while the bags are up");

const last = stateTrack[frames];
for (const key of ["door.penitent", "door.priest", "congregation.stand", "bags.up"]) {
    if ((last.get(key) ?? 0) > 0.01) problems.push(`${key} is still set at the end of the loop`);
}
if ((last.get("rose") ?? 0) > 0.05) problems.push(`rose is still lit at the end of the loop (${(last.get("rose") ?? 0).toFixed(2)})`);

// 7. everyone is back on their mark for the loop.
const first = forward[0];
const final = forward[frames];
for (const id of CAST) {
    const a = first.get(id)!;
    const b = final.get(id)!;
    const drift = Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]);
    if (id === "sinner" || id === "father" || id === "preacher") continue;
    if (drift > 0.3) problems.push(`${id} ends ${drift.toFixed(2)} m from where the loop starts`);
}

console.log(`lines: ${lines.length}, first at ${lines[0]?.at.toFixed(2)}s, last at ${lines[lines.length - 1]?.at.toFixed(2)}s`);

if (problems.length === 0) console.log("\nTIMELINE OK");
else {
    console.log(`\n${problems.length} problem(s):`);
    for (const problem of problems.slice(0, 25)) console.log(" - " + problem);
    process.exitCode = 1;
}
