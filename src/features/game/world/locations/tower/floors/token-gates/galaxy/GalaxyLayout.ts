// src/features/game/world/locations/tower/floors/token-gates/galaxy/GalaxyLayout.ts

export const GALAXY = {
    coreBubbleRadius: 110,
    factionRingRadius: 340,
    factionRingStep: 150,
    factionSpacing: 230,
    factionBubbleRadius: 42,
    playerRingStart: 900,
    playerRingStep: 40,
    playerSpacing: 34,
    playerBubbleRadius: 10,
    diskThickness: 90,
    orbitPeriodSec: 1500,
    maxRadius: 2600,
    hubPosition: { x: 0, y: 360, z: 900 },
    platformRadius: 26,
} as const;

export const ORBIT_OMEGA = (Math.PI * 2) / GALAXY.orbitPeriodSec;

const ARM_SWEEP = 0.0021;
const ORBIT_EPOCH_MS = 1735689600000;

export function galaxyOrbitTime(): number {
    return ((Date.now() - ORBIT_EPOCH_MS) / 1000) % GALAXY.orbitPeriodSec;
}

export interface BubbleOrbit {
    radius: number;
    phase: number;
    y: number;
    seed: number;
}

export interface Vec3Like {
    x: number;
    y: number;
    z: number;
}

export function hashString(value: string): number {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

export function hashInt(value: number): number {
    let h = value | 0;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
}

function unit(seed: number, salt: number): number {
    return hashInt(seed * 2654435761 + salt * 1013904223) / 4294967296;
}

function ringCapacity(radius: number, spacing: number): number {
    return Math.max(1, Math.floor((Math.PI * 2 * radius) / spacing));
}

function ringOf(index: number, startRadius: number, ringStep: number, spacing: number) {
    let ring = 0;
    let consumed = 0;

    for (; ring < 8192; ring++) {
        const radius = startRadius + ring * ringStep;
        const capacity = ringCapacity(radius, spacing);
        if (index < consumed + capacity) {
            return { ring, radius, capacity, slot: index - consumed, consumed };
        }
        consumed += capacity;
    }

    const radius = startRadius + ring * ringStep;
    return { ring, radius, capacity: ringCapacity(radius, spacing), slot: 0, consumed };
}

function ringAtRadius(radius: number): number {
    return Math.max(0, Math.round((radius - GALAXY.playerRingStart) / GALAXY.playerRingStep));
}

function ringFirstIndex(ring: number): number {
    let consumed = 0;
    for (let k = 0; k < ring; k++) {
        consumed += ringCapacity(GALAXY.playerRingStart + k * GALAXY.playerRingStep, GALAXY.playerSpacing);
    }
    return consumed;
}

export function playerBubbleOrbit(index: number): BubbleOrbit {
    const { radius, capacity, slot } = ringOf(
        index,
        GALAXY.playerRingStart,
        GALAXY.playerRingStep,
        GALAXY.playerSpacing
    );

    const jr = unit(index, 1);
    const ja = unit(index, 2);
    const jy = unit(index, 3);
    const clusterAngle = unit(index, 4) * Math.PI * 2;
    const clusterPull = Math.pow(unit(index, 5), 1.6);
    const slotAngle = (Math.PI * 2) / capacity;

    const scatterRadial = (jr - 0.5) * GALAXY.playerRingStep * 1.7 + Math.cos(clusterAngle) * clusterPull * GALAXY.playerSpacing * 1.4;
    const scatterAngular = (ja - 0.5) * slotAngle * 1.35 + (Math.sin(clusterAngle) * clusterPull * GALAXY.playerSpacing) / radius;

    const armSweep = ARM_SWEEP * radius;
    const finalRadius = Math.max(GALAXY.playerRingStart * 0.75, radius + scatterRadial);
    const spread = 1 - Math.min(1, (finalRadius - GALAXY.playerRingStart) / (GALAXY.maxRadius - GALAXY.playerRingStart));

    return {
        radius: finalRadius,
        phase: slot * slotAngle + scatterAngular + armSweep,
        y: Math.sign(jy - 0.5) * Math.pow(Math.abs(jy - 0.5) * 2, 1.7) * GALAXY.diskThickness * (0.4 + spread * 0.6),
        seed: unit(index, 6),
    };
}

export function factionBubbleOrbit(slotIndex: number): BubbleOrbit {
    const { ring, radius, capacity, slot } = ringOf(
        slotIndex,
        GALAXY.factionRingRadius,
        GALAXY.factionRingStep,
        GALAXY.factionSpacing
    );

    const jy = unit(slotIndex, 11);

    return {
        radius,
        phase: (slot / capacity) * Math.PI * 2 + ring * 0.55,
        y: (jy - 0.5) * GALAXY.diskThickness * 0.45,
        seed: unit(slotIndex, 12),
    };
}

export function orbitAngle(orbit: BubbleOrbit, timeSec: number): number {
    return orbit.phase + ORBIT_OMEGA * timeSec;
}

export function orbitPosition<T extends Vec3Like>(orbit: BubbleOrbit, timeSec: number, out: T): T {
    const angle = orbitAngle(orbit, timeSec);
    out.x = Math.cos(angle) * orbit.radius;
    out.y = orbit.y;
    out.z = Math.sin(angle) * orbit.radius;
    return out;
}

export interface NearbyBubble {
    index: number;
    x: number;
    y: number;
    z: number;
    distance: number;
}

const RING_SEARCH_SPAN = 3;
const SLOT_SEARCH_SPAN = 6;

export function findNearbyPlayerBubbles(
    point: Vec3Like,
    maxDistance: number,
    bubbleCount: number,
    timeSec: number,
    limit: number
): NearbyBubble[] {
    if (bubbleCount <= 0) return [];

    const pointRadius = Math.hypot(point.x, point.z);
    const pointAngle = Math.atan2(point.z, point.x);
    const centreRing = ringAtRadius(pointRadius);
    const found: NearbyBubble[] = [];
    const scratch = { x: 0, y: 0, z: 0 };

    for (let ring = Math.max(0, centreRing - RING_SEARCH_SPAN); ring <= centreRing + RING_SEARCH_SPAN; ring++) {
        const radius = GALAXY.playerRingStart + ring * GALAXY.playerRingStep;
        const capacity = ringCapacity(radius, GALAXY.playerSpacing);
        const first = ringFirstIndex(ring);
        if (first >= bubbleCount) break;

        const localAngle = pointAngle - ORBIT_OMEGA * timeSec - ARM_SWEEP * radius;
        const centreSlot = Math.round((localAngle / (Math.PI * 2)) * capacity);

        for (let offset = -SLOT_SEARCH_SPAN; offset <= SLOT_SEARCH_SPAN; offset++) {
            const slot = ((centreSlot + offset) % capacity + capacity) % capacity;
            const index = first + slot;
            if (index >= bubbleCount) continue;

            orbitPosition(playerBubbleOrbit(index), timeSec, scratch);
            const distance = Math.hypot(scratch.x - point.x, scratch.y - point.y, scratch.z - point.z);
            if (distance <= maxDistance) {
                found.push({ index, x: scratch.x, y: scratch.y, z: scratch.z, distance });
            }
        }
    }

    found.sort((a, b) => a.distance - b.distance);
    return found.length > limit ? found.slice(0, limit) : found;
}

export function galaxyOuterRadius(playerCount: number): number {
    if (playerCount <= 0) return GALAXY.playerRingStart;
    return playerBubbleOrbit(playerCount - 1).radius + GALAXY.playerRingStep;
}
