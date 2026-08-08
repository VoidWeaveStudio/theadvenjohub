// src/features/game/world/locations/tower/floors/first-floor/utils/canyonBiomes.ts
export type CanyonBiomeKey = "slime_valley" | "ember_wastes" | "frozen_shelf" | "spore_hollow" | "void_rift";

export interface CanyonBiome {
    key: CanyonBiomeKey;
    name: string;
    sky: number;
    fogDensity: number;
    sunColor: number;
    sunIntensity: number;
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    rockBase: string;
    rockLight: string;
    rockDark: string;
    rockVein: string;
    groundColor: number;
    accent: number;
    propStyle: "cactus" | "ember" | "ice" | "mushroom" | "shard";
}

export const CANYON_BIOMES: CanyonBiome[] = [
    {
        key: "slime_valley",
        name: "Slime Valley",
        sky: 0xc9a876,
        fogDensity: 0.0028,
        sunColor: 0xfff2d8,
        sunIntensity: 1.3,
        hemiSky: 0xe8c99a,
        hemiGround: 0x8b5a2b,
        hemiIntensity: 0.9,
        rockBase: "#B79868",
        rockLight: "rgba(255,240,210,",
        rockDark: "rgba(60,40,20,",
        rockVein: "rgba(70,48,26,0.3)",
        groundColor: 0xb79868,
        accent: 0x33cc55,
        propStyle: "cactus",
    },
    {
        key: "ember_wastes",
        name: "Ember Wastes",
        sky: 0x3a1410,
        fogDensity: 0.0042,
        sunColor: 0xff9a4a,
        sunIntensity: 1.1,
        hemiSky: 0xff7a3a,
        hemiGround: 0x2a0d09,
        hemiIntensity: 0.8,
        rockBase: "#4A211A",
        rockLight: "rgba(255,140,60,",
        rockDark: "rgba(20,6,4,",
        rockVein: "rgba(255,96,32,0.45)",
        groundColor: 0x4a211a,
        accent: 0xff7a2f,
        propStyle: "ember",
    },
    {
        key: "frozen_shelf",
        name: "Frozen Shelf",
        sky: 0xbfe4f5,
        fogDensity: 0.0036,
        sunColor: 0xe8f6ff,
        sunIntensity: 1.5,
        hemiSky: 0xdff2ff,
        hemiGround: 0x6d8fa6,
        hemiIntensity: 1.1,
        rockBase: "#A9C6D6",
        rockLight: "rgba(255,255,255,",
        rockDark: "rgba(70,105,130,",
        rockVein: "rgba(120,190,225,0.4)",
        groundColor: 0xa9c6d6,
        accent: 0x7fd8ff,
        propStyle: "ice",
    },
    {
        key: "spore_hollow",
        name: "Spore Hollow",
        sky: 0x241634,
        fogDensity: 0.005,
        sunColor: 0xc79bff,
        sunIntensity: 0.9,
        hemiSky: 0xa670e0,
        hemiGround: 0x1a1024,
        hemiIntensity: 0.9,
        rockBase: "#3B2A4C",
        rockLight: "rgba(200,150,255,",
        rockDark: "rgba(18,10,26,",
        rockVein: "rgba(176,114,214,0.45)",
        groundColor: 0x3b2a4c,
        accent: 0xb072d6,
        propStyle: "mushroom",
    },
    {
        key: "void_rift",
        name: "Void Rift",
        sky: 0x08070f,
        fogDensity: 0.0062,
        sunColor: 0xff4d8f,
        sunIntensity: 0.8,
        hemiSky: 0x4a2a6a,
        hemiGround: 0x05040a,
        hemiIntensity: 0.7,
        rockBase: "#1A1826",
        rockLight: "rgba(255,80,150,",
        rockDark: "rgba(4,3,8,",
        rockVein: "rgba(255,45,120,0.5)",
        groundColor: 0x1a1826,
        accent: 0xff2d78,
        propStyle: "shard",
    },
];

export const CANYON_BIOMES_BY_KEY = new Map(CANYON_BIOMES.map((b) => [b.key, b]));

export function biomeForSegment(segment: number): CanyonBiome {
    const index = Math.min(CANYON_BIOMES.length, Math.max(1, segment)) - 1;
    return CANYON_BIOMES[index];
}

export function biomeFromKey(key: string | undefined, segment: number): CanyonBiome {
    if (key && CANYON_BIOMES_BY_KEY.has(key as CanyonBiomeKey)) {
        return CANYON_BIOMES_BY_KEY.get(key as CanyonBiomeKey)!;
    }
    return biomeForSegment(segment);
}
