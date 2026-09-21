// src/features/game/world/locations/showcase/rooms/church/churchLayout.ts
import * as THREE from "three";
import { seatedActorY } from "../../actors/poses";

export const HALF_WIDTH = 15;
export const WALL_HEIGHT = 19;
export const VAULT_RADIUS = HALF_WIDTH - 0.4;
export const NAVE_START = -34;
export const NAVE_END = 40;
export const NAVE_MID = (NAVE_START + NAVE_END) / 2;
export const NAVE_LENGTH = NAVE_END - NAVE_START;

export const ALTAR_Z = 30;
export const PULPIT_X = -6.4;
export const PULPIT_Z = 21;
export const PULPIT_DECK_Y = 1.58;
// The open side of the pulpit looks back down the nave, angled slightly towards the
// centre aisle; the stair therefore runs off the back, towards the altar.
export const PULPIT_FACING = Math.PI * 0.94;

export const WINDOW_BAYS = 6;
export const COLUMN_X = 11.4;
export const VOTIVE_Z = -27;

export const SEAT_TOP = 0.46;
export const PEW_ROWS = 13;
export const PEW_FIRST_Z = -22;
export const PEW_STEP = 2.9;

// Benches used to reach x = 11.1 while the columns start at 10.25, so whoever drew the
// outside seat of a row ended up standing inside a column. Shorter pews with three
// seats keep the whole congregation clear of them.
export const PEW_CENTER_X = 6;
export const PEW_WIDTH = 7.6;
export const PEW_SEATS = 3;
export const PEW_SEAT_STEP = 2.4;

export const CHOIR_Z = 16.5;
export const CHOIR_X = 7.6;

// Geometry and singers read the same two numbers, so the choir cannot end up sunk into
// its own platform or floating above it.
export const CHOIR_TIERS: Array<{ y: number; z: number; width: number }> = [
    { y: 0.5, z: CHOIR_Z, width: 8.4 },
    { y: 1, z: CHOIR_Z + 2.4, width: 7.2 },
];

export const CENSER_ANCHOR_Y = 20.2;
export const CENSER_DROP = 10.7;

export const ROSE_Z = NAVE_END - 1.4;
export const ROSE_Y = 12.4;
export const ROSE_RADIUS = 6.1;
export const ROSE_IDLE_GLOW = 0.55;
export const ROSE_BLAZE_GLOW = 3.6;

// The confessional: two doors on the aisle face, the priest behind the far one, the
// penitent behind the near one, a dividing wall between them with a grille at face
// height. It stands past the last pews on the left, in the one stretch of that aisle
// with no column (none between z = 10.15 and 15.25) and clear of the wall buttress
// that starts at z = 13.8.
export const BOOTH_X = -12.8;
export const BOOTH_Z = 11.95;
export const BOOTH_WIDTH = 3.4;
export const BOOTH_DEPTH = 2.6;
export const BOOTH_HEIGHT = 4.3;
export const BOOTH_CELL_OFFSET = 0.85;
export const BOOTH_DOOR_WIDTH = 1.04;
export const BOOTH_GRILLE_Y = 1.2;
export const BOOTH_SEAT_TOP = 0.5;

export type PewSide = -1 | 1;

export interface PewSeat {
    row: number;
    side: PewSide;
    seat: number;
}

// Seats the story owns. buildCrowd skips them so a scripted actor never shares a spot
// with a filler churchgoer.
export const STORY_SEATS: Record<string, PewSeat> = {
    holderA: { row: 1, side: 1, seat: 0 },
    holderB: { row: 1, side: 1, seat: 1 },
    gossipA: { row: 2, side: -1, seat: 1 },
    gossipB: { row: 2, side: -1, seat: 2 },
    sinner: { row: 12, side: -1, seat: 0 },
    father: { row: 12, side: -1, seat: 2 },
    suppliantA: { row: 11, side: 1, seat: 1 },
    suppliantB: { row: 12, side: -1, seat: 1 },
    suppliantC: { row: 10, side: 1, seat: 2 },
};

export function seatKey(seat: PewSeat): string {
    return `${seat.row}:${seat.side}:${seat.seat}`;
}

export function pewRowZ(row: number): number {
    return PEW_FIRST_Z + row * PEW_STEP;
}

export function pewSeatX(side: PewSide, seat: number): number {
    return side * PEW_CENTER_X + (seat - (PEW_SEATS - 1) / 2) * PEW_SEAT_STEP;
}

// Where an actor's group goes to look seated on that bench.
export function pewSeatPoint(seat: PewSeat): THREE.Vector3 {
    return new THREE.Vector3(pewSeatX(seat.side, seat.seat), seatedActorY(SEAT_TOP), pewRowZ(seat.row) + 0.1);
}

// The floor spot in front of that seat, for walking up to it before sitting down.
export function pewApproachPoint(seat: PewSeat): THREE.Vector3 {
    return new THREE.Vector3(pewSeatX(seat.side, seat.seat), 0, pewRowZ(seat.row) + 1.6);
}

export type BoothCell = "priest" | "penitent";

// The penitent's door is the one you reach first walking up the nave from the gate;
// the priest sits in the far cell, towards the altar.
export function boothCellZ(cell: BoothCell): number {
    return BOOTH_Z + (cell === "priest" ? BOOTH_CELL_OFFSET : -BOOTH_CELL_OFFSET);
}

// Where a seated actor's group goes inside that cell: on the bench against the back
// wall, knees towards the door, with the grille beside their face.
export const BOOTH_BENCH_X = -0.78;

export function boothCellPoint(cell: BoothCell): THREE.Vector3 {
    return new THREE.Vector3(BOOTH_X + BOOTH_BENCH_X, seatedActorY(BOOTH_SEAT_TOP), boothCellZ(cell));
}

// The floor spot just outside that door, where an actor stands before stepping in.
export function boothDoorPoint(cell: BoothCell): THREE.Vector3 {
    return new THREE.Vector3(BOOTH_X + BOOTH_DEPTH / 2 + 1.05, 0, boothCellZ(cell));
}

// Both occupants turn towards this, which puts the grille between them and leaves
// each of them facing partly out of their own doorway.
export function boothGrillePoint(): THREE.Vector3 {
    return new THREE.Vector3(BOOTH_X + 0.3, BOOTH_GRILLE_Y, BOOTH_Z);
}
