// src/features/game/data/eventDoors.ts
export interface EventDoor {
    id: string;
    locationId: string;
    name: string;
    glyph: string;
    accent: number;
    trim: number;
    live: boolean;
    tagline: string;
    teaser: string;
    partyHint: string;
    rewardText: string;
    ashPerWave: number;
    xpPerWave: number;
    ashCap: number;
    xpCap: number;
    cooldownMinutes: number;
    maxParty: number;
    scored: boolean;
}

export interface EventConfigRow {
    eventId: string;
    enabled: boolean;
    title: string | null;
    tagline: string | null;
    description: string | null;
    rewardText: string | null;
    scheduleNote: string | null;
    startsAt: Date | string | null;
    endsAt: Date | string | null;
    repeatDays: number;
    minParty: number;
    maxParty: number;
    cooldownMinutes: number;
    ashPerWave: number;
    xpPerWave: number;
    ashCap: number;
    xpCap: number;
}

export type EventWindowState = "always" | "open" | "upcoming" | "ended";

export interface EventWindow {
    state: EventWindowState;
    open: boolean;
    opensAt: number | null;
    closesAt: number | null;
}

export interface ResolvedEvent {
    id: string;
    locationId: string;
    glyph: string;
    accent: number;
    trim: number;
    scored: boolean;
    enabled: boolean;
    title: string;
    tagline: string;
    description: string;
    rewardText: string;
    scheduleNote: string;
    startsAt: number | null;
    endsAt: number | null;
    repeatDays: number;
    minParty: number;
    maxParty: number;
    cooldownMinutes: number;
    ashPerWave: number;
    xpPerWave: number;
    ashCap: number;
    xpCap: number;
}

export interface EventBoardEntry {
    rank: number;
    wallet: string;
    nickname: string | null;
    wavesCleared: number;
    partySize: number;
    achievedAt: string;
}

export const EVENT_DOOR_PREFIX = "event-door:";
export const EVENTS_LOBBY_ID = "tower-events";
export const EVENT_EXIT_INTERACTION = "event-exit";
export const ARENA_ALTAR_INTERACTION = "arena-altar";

export const EVENT_DOORS: EventDoor[] = [
    {
        id: "arena",
        locationId: "event-arena",
        name: "Candle Defence",
        glyph: "🕯️",
        accent: 0x4ade80,
        trim: 0xeafff2,
        live: true,
        tagline: "Endless waves",
        teaser: "Hold the green candle against the waves.",
        partyHint: "1-4 fighters",
        rewardText: "25 ash and 50 XP per wave cleared, paid once when the run ends.",
        ashPerWave: 25,
        xpPerWave: 50,
        ashCap: 1500,
        xpCap: 3000,
        cooldownMinutes: 60,
        maxParty: 4,
        scored: true,
    },
    {
        id: "dust2",
        locationId: "event-dust2",
        name: "Dust II",
        glyph: "💣",
        accent: 0xd9a441,
        trim: 0xffe6b8,
        live: false,
        tagline: "5v5 defusal",
        teaser: "Plant the bomb or defuse it. First person, fixed loadout for everyone.",
        partyHint: "5v5 — queue solo or bring a party",
        rewardText: "Rewards are still being set.",
        ashPerWave: 25,
        xpPerWave: 50,
        ashCap: 1500,
        xpCap: 3000,
        cooldownMinutes: 60,
        maxParty: 4,
        scored: false,
    },
    {
        id: "pump",
        locationId: "event-pump",
        name: "Pump Party",
        glyph: "📈",
        accent: 0xffd166,
        trim: 0xfff2cc,
        live: false,
        tagline: "Climb",
        teaser: "Ride the candle as high as it goes.",
        partyHint: "1-4 climbers",
        rewardText: "Rewards are still being set.",
        ashPerWave: 25,
        xpPerWave: 50,
        ashCap: 1500,
        xpCap: 3000,
        cooldownMinutes: 60,
        maxParty: 4,
        scored: false,
    },
    {
        id: "whale",
        locationId: "event-whale",
        name: "Whale Hunt",
        glyph: "🐋",
        accent: 0x4fd1ff,
        trim: 0xd6f3ff,
        live: false,
        tagline: "Raid boss",
        teaser: "Something enormous moves in the deep.",
        partyHint: "4 hunters",
        rewardText: "Rewards are still being set.",
        ashPerWave: 25,
        xpPerWave: 50,
        ashCap: 1500,
        xpCap: 3000,
        cooldownMinutes: 60,
        maxParty: 4,
        scored: false,
    },
    {
        id: "mint",
        locationId: "event-mint",
        name: "Mint Rush",
        glyph: "🪙",
        accent: 0xd4af50,
        trim: 0xffeab8,
        live: false,
        tagline: "Race",
        teaser: "First to the mint takes the supply.",
        partyHint: "Free for all",
        rewardText: "Rewards are still being set.",
        ashPerWave: 25,
        xpPerWave: 50,
        ashCap: 1500,
        xpCap: 3000,
        cooldownMinutes: 60,
        maxParty: 4,
        scored: false,
    },
    {
        id: "bridge",
        locationId: "event-bridge",
        name: "Bridge Run",
        glyph: "🌉",
        accent: 0xa855f7,
        trim: 0xe9d5ff,
        live: false,
        tagline: "Gauntlet",
        teaser: "Cross before the bridge unwinds.",
        partyHint: "1-4 runners",
        rewardText: "Rewards are still being set.",
        ashPerWave: 25,
        xpPerWave: 50,
        ashCap: 1500,
        xpCap: 3000,
        cooldownMinutes: 60,
        maxParty: 4,
        scored: false,
    },
    {
        id: "audit",
        locationId: "event-audit",
        name: "The Audit",
        glyph: "🔍",
        accent: 0x8ad4ff,
        trim: 0xe2f5ff,
        live: false,
        tagline: "Trial",
        teaser: "Every wallet gets read out loud.",
        partyHint: "Solo trial",
        rewardText: "Rewards are still being set.",
        ashPerWave: 25,
        xpPerWave: 50,
        ashCap: 1500,
        xpCap: 3000,
        cooldownMinutes: 60,
        maxParty: 1,
        scored: false,
    },
    {
        id: "airdrop",
        locationId: "event-airdrop",
        name: "Airdrop Storm",
        glyph: "🎁",
        accent: 0x7dffb0,
        trim: 0xdcffe9,
        live: false,
        tagline: "Scramble",
        teaser: "Catch what falls. Keep what you catch.",
        partyHint: "Free for all",
        rewardText: "Rewards are still being set.",
        ashPerWave: 25,
        xpPerWave: 50,
        ashCap: 1500,
        xpCap: 3000,
        cooldownMinutes: 60,
        maxParty: 4,
        scored: false,
    },
    {
        id: "burn",
        locationId: "event-burn",
        name: "Burn Ritual",
        glyph: "🔥",
        accent: 0xff8a3c,
        trim: 0xffd9bd,
        live: false,
        tagline: "Sacrifice",
        teaser: "Feed the fire and see what it returns.",
        partyHint: "1-4 acolytes",
        rewardText: "Rewards are still being set.",
        ashPerWave: 25,
        xpPerWave: 50,
        ashCap: 1500,
        xpCap: 3000,
        cooldownMinutes: 60,
        maxParty: 4,
        scored: false,
    },
    {
        id: "diamond",
        locationId: "event-diamond",
        name: "Diamond Hands",
        glyph: "💎",
        accent: 0xb8f2ff,
        trim: 0xf2fdff,
        live: false,
        tagline: "Endurance",
        teaser: "Hold on. That is the whole event.",
        partyHint: "Free for all",
        rewardText: "Rewards are still being set.",
        ashPerWave: 25,
        xpPerWave: 50,
        ashCap: 1500,
        xpCap: 3000,
        cooldownMinutes: 60,
        maxParty: 4,
        scored: false,
    },
];

export const EVENT_DOORS_BY_ID = new Map(EVENT_DOORS.map((door) => [door.id, door]));
export const EVENT_DOORS_BY_LOCATION = new Map(EVENT_DOORS.map((door) => [door.locationId, door]));
export const EVENT_LOCATION_IDS = EVENT_DOORS.map((door) => door.locationId);
export const EVENT_IDS = EVENT_DOORS.map((door) => door.id);

export function isEventLocation(locationId: string): boolean {
    return EVENT_DOORS_BY_LOCATION.has(locationId);
}

export function isEventId(eventId: string): boolean {
    return EVENT_DOORS_BY_ID.has(eventId);
}

export const DAY_MS = 24 * 60 * 60 * 1000;

function toEpoch(value: Date | string | number | null | undefined): number | null {
    if (value == null) return null;
    const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
}

// Where the event sits relative to its scheduled window. With repeatDays set,
// the window recurs every N days from the first occurrence and never "ends".
export function eventWindow(event: ResolvedEvent, now: number = Date.now()): EventWindow {
    const { startsAt, endsAt } = event;

    if (startsAt === null && endsAt === null) {
        return { state: "always", open: true, opensAt: null, closesAt: null };
    }

    if (startsAt === null) {
        const closesAt = endsAt!;
        return now < closesAt
            ? { state: "open", open: true, opensAt: null, closesAt }
            : { state: "ended", open: false, opensAt: null, closesAt };
    }

    if (endsAt === null || endsAt <= startsAt) {
        return now >= startsAt
            ? { state: "open", open: true, opensAt: startsAt, closesAt: null }
            : { state: "upcoming", open: false, opensAt: startsAt, closesAt: null };
    }

    const duration = endsAt - startsAt;
    const period = event.repeatDays > 0 ? event.repeatDays * DAY_MS : 0;

    if (now < startsAt) {
        return { state: "upcoming", open: false, opensAt: startsAt, closesAt: endsAt };
    }

    if (period <= 0) {
        return now < endsAt
            ? { state: "open", open: true, opensAt: startsAt, closesAt: endsAt }
            : { state: "ended", open: false, opensAt: startsAt, closesAt: endsAt };
    }

    const cycles = Math.floor((now - startsAt) / period);
    const occurrenceStart = startsAt + cycles * period;
    const occurrenceEnd = occurrenceStart + Math.min(duration, period);

    if (now < occurrenceEnd) {
        return { state: "open", open: true, opensAt: occurrenceStart, closesAt: occurrenceEnd };
    }

    const nextStart = occurrenceStart + period;
    return { state: "upcoming", open: false, opensAt: nextStart, closesAt: nextStart + Math.min(duration, period) };
}

export function isEventLive(event: ResolvedEvent, now: number = Date.now()): boolean {
    return event.enabled && eventWindow(event, now).open;
}

export function resolveEvent(door: EventDoor, row?: Partial<EventConfigRow> | null): ResolvedEvent {
    const pickText = (value: string | null | undefined, fallback: string) => {
        const trimmed = typeof value === "string" ? value.trim() : "";
        return trimmed.length > 0 ? trimmed : fallback;
    };
    const pickNumber = (value: number | null | undefined, fallback: number) =>
        typeof value === "number" && Number.isFinite(value) ? value : fallback;

    return {
        id: door.id,
        locationId: door.locationId,
        glyph: door.glyph,
        accent: door.accent,
        trim: door.trim,
        scored: door.scored,
        enabled: typeof row?.enabled === "boolean" ? row.enabled : door.live,
        title: pickText(row?.title, door.name),
        tagline: pickText(row?.tagline, door.tagline),
        description: pickText(row?.description, door.teaser),
        rewardText: pickText(row?.rewardText, door.rewardText),
        scheduleNote: pickText(row?.scheduleNote, ""),
        startsAt: toEpoch(row?.startsAt),
        endsAt: toEpoch(row?.endsAt),
        repeatDays: Math.max(0, pickNumber(row?.repeatDays, 0)),
        minParty: pickNumber(row?.minParty, 1),
        maxParty: pickNumber(row?.maxParty, door.maxParty),
        cooldownMinutes: pickNumber(row?.cooldownMinutes, door.cooldownMinutes),
        ashPerWave: pickNumber(row?.ashPerWave, door.ashPerWave),
        xpPerWave: pickNumber(row?.xpPerWave, door.xpPerWave),
        ashCap: pickNumber(row?.ashCap, door.ashCap),
        xpCap: pickNumber(row?.xpCap, door.xpCap),
    };
}

export function resolveAllEvents(rows: Partial<EventConfigRow>[]): ResolvedEvent[] {
    const byId = new Map(rows.filter((row) => typeof row.eventId === "string").map((row) => [row.eventId as string, row]));
    return EVENT_DOORS.map((door) => resolveEvent(door, byId.get(door.id)));
}
