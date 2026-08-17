// src/features/game/data/eventDoors.ts
export interface EventDoor {
    id: string;
    name: string;
    glyph: string;
    accent: number;
    live: boolean;
    teaser: string;
}

export const EVENT_DOOR_PREFIX = "event-door:";

export const EVENT_DOORS: EventDoor[] = [
    { id: "arena", name: "Candle Defence", glyph: "🕯️", accent: 0x4ade80, live: true, teaser: "Hold the green candle against the waves." },
    { id: "rug-pull", name: "Rug Pull", glyph: "📉", accent: 0xff5757, live: false, teaser: "The floor gives out. Survive the drop." },
    { id: "pump", name: "Pump Party", glyph: "📈", accent: 0xffd166, live: false, teaser: "Ride the candle as high as it goes." },
    { id: "whale", name: "Whale Hunt", glyph: "🐋", accent: 0x4fd1ff, live: false, teaser: "Something enormous moves in the deep." },
    { id: "mint", name: "Mint Rush", glyph: "🪙", accent: 0xd4af50, live: false, teaser: "First to the mint takes the supply." },
    { id: "bridge", name: "Bridge Run", glyph: "🌉", accent: 0xa855f7, live: false, teaser: "Cross before the bridge unwinds." },
    { id: "audit", name: "The Audit", glyph: "🔍", accent: 0x8ad4ff, live: false, teaser: "Every wallet gets read out loud." },
    { id: "airdrop", name: "Airdrop Storm", glyph: "🎁", accent: 0x7dffb0, live: false, teaser: "Catch what falls. Keep what you catch." },
    { id: "burn", name: "Burn Ritual", glyph: "🔥", accent: 0xff8a3c, live: false, teaser: "Feed the fire and see what it returns." },
    { id: "diamond", name: "Diamond Hands", glyph: "💎", accent: 0xb8f2ff, live: false, teaser: "Hold on. That is the whole event." },
];

export const EVENT_DOORS_BY_ID = new Map(EVENT_DOORS.map((door) => [door.id, door]));
