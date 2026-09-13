// src/features/game/world/locations/showcase/config.ts
export const SECOND_WORLD_ID = "tower-token-gates";

export type ShowcaseId =
    | "show-church"
    | "show-war"
    | "show-garden"
    | "show-graveyard"
    | "show-casino"
    | "show-moon"
    | "show-bazaar";

export interface ShowcaseInfo {
    id: ShowcaseId;
    nameKey: string;
    taglineKey: string;
    accent: number;
    gateStone: number;
    ringAngle: number;
    ringHeight: number;
}

export const SHOWCASE_RADIUS = 150;
export const GATE_RING_RADIUS = 78;
export const GATE_INTERACT_RANGE = 9;

export const SHOWCASE_INFO: ShowcaseInfo[] = [
    {
        id: "show-church",
        nameKey: "g.showcase.church.name",
        taglineKey: "g.showcase.church.tagline",
        accent: 0xffd489,
        gateStone: 0x6f5a3c,
        ringAngle: 0,
        ringHeight: 0,
    },
    {
        id: "show-war",
        nameKey: "g.showcase.war.name",
        taglineKey: "g.showcase.war.tagline",
        accent: 0xff5a3c,
        gateStone: 0x3a3530,
        ringAngle: (Math.PI * 2) / 7,
        ringHeight: -6,
    },
    {
        id: "show-garden",
        nameKey: "g.showcase.garden.name",
        taglineKey: "g.showcase.garden.tagline",
        accent: 0x7ce8a8,
        gateStone: 0x5c7a55,
        ringAngle: (Math.PI * 4) / 7,
        ringHeight: 5,
    },
    {
        id: "show-graveyard",
        nameKey: "g.showcase.graveyard.name",
        taglineKey: "g.showcase.graveyard.tagline",
        accent: 0x9ec6ff,
        gateStone: 0x4a4a52,
        ringAngle: (Math.PI * 6) / 7,
        ringHeight: -4,
    },
    {
        id: "show-casino",
        nameKey: "g.showcase.casino.name",
        taglineKey: "g.showcase.casino.tagline",
        accent: 0xff4fd8,
        gateStone: 0x2b2340,
        ringAngle: (Math.PI * 8) / 7,
        ringHeight: 7,
    },
    {
        id: "show-moon",
        nameKey: "g.showcase.moon.name",
        taglineKey: "g.showcase.moon.tagline",
        accent: 0xbfe6ff,
        gateStone: 0x5a5f68,
        ringAngle: (Math.PI * 10) / 7,
        ringHeight: 3,
    },
    {
        id: "show-bazaar",
        nameKey: "g.showcase.bazaar.name",
        taglineKey: "g.showcase.bazaar.tagline",
        accent: 0xffb547,
        gateStone: 0x7a5a34,
        ringAngle: (Math.PI * 12) / 7,
        ringHeight: -2,
    },
];

export const SHOWCASE_IDS: string[] = SHOWCASE_INFO.map((entry) => entry.id);

export const SHOWCASE_INFO_BY_ID = new Map<string, ShowcaseInfo>(
    SHOWCASE_INFO.map((entry) => [entry.id, entry])
);
