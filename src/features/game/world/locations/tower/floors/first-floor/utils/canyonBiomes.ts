// src/features/game/world/locations/tower/floors/first-floor/utils/canyonBiomes.ts
export type CanyonBiomeKey = "slime_valley" | "ember_wastes" | "frozen_shelf" | "spore_hollow" | "void_rift";

export interface CanyonBiome {
    key: CanyonBiomeKey;
    name: string;

    fogColor: number;
    fogDensity: number;

    sunColor: number;
    sunIntensity: number;
    sunAltitude: number;
    sunAzimuth: number;

    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    bounceColor: number;
    bounceIntensity: number;

    rockTint: number;
    groundTint: number;
    strataA: number;
    strataB: number;
    strataC: number;
    veinColor: number;
    veinStrength: number;

    skyZenith: number;
    skyHorizon: number;
    skyHaze: number;
    sunDiscColor: number;

    dustColor: number;
    dustDensity: number;
    dustAdditive: boolean;

    accent: number;
    propStyle: "cactus" | "ember" | "ice" | "mushroom" | "shard";
}

export const CANYON_BIOMES: CanyonBiome[] = [
    {
        key: "slime_valley",
        name: "Slime Valley",

        fogColor: 0xd8bb92,
        fogDensity: 0.0022,

        sunColor: 0xffe7c0,
        sunIntensity: 2.4,
        sunAltitude: 34,
        sunAzimuth: 62,

        hemiSky: 0xbdd6f2,
        hemiGround: 0x9a6c42,
        hemiIntensity: 0.55,
        bounceColor: 0xd9a469,
        bounceIntensity: 0.45,

        rockTint: 0xc09468,
        groundTint: 0xd7b98c,
        strataA: 0xdcb684,
        strataB: 0x9c6b42,
        strataC: 0xe8cda2,
        veinColor: 0x63d16b,
        veinStrength: 0.18,

        skyZenith: 0x3d78bd,
        skyHorizon: 0xe9cda2,
        skyHaze: 0xd9b78c,
        sunDiscColor: 0xfff3d6,

        dustColor: 0xe2c79f,
        dustDensity: 0.55,
        dustAdditive: false,

        accent: 0x33cc55,
        propStyle: "cactus",
    },
    {
        key: "ember_wastes",
        name: "Ember Wastes",

        fogColor: 0x4d1810,
        fogDensity: 0.0038,

        sunColor: 0xff8a44,
        sunIntensity: 1.9,
        sunAltitude: 20,
        sunAzimuth: 108,

        hemiSky: 0xff7038,
        hemiGround: 0x2a0d09,
        hemiIntensity: 0.5,
        bounceColor: 0xff5a1e,
        bounceIntensity: 0.7,

        rockTint: 0x5c352a,
        groundTint: 0x4a2b21,
        strataA: 0x6f3d2c,
        strataB: 0x2c1510,
        strataC: 0x8c4c31,
        veinColor: 0xff5a1e,
        veinStrength: 1.0,

        skyZenith: 0x270c0b,
        skyHorizon: 0xff6a2a,
        skyHaze: 0x8c2f15,
        sunDiscColor: 0xffb070,

        dustColor: 0xff8a4a,
        dustDensity: 1.0,
        dustAdditive: true,

        accent: 0xff7a2f,
        propStyle: "ember",
    },
    {
        key: "frozen_shelf",
        name: "Frozen Shelf",

        fogColor: 0xc9e2f1,
        fogDensity: 0.0030,

        sunColor: 0xeaf6ff,
        sunIntensity: 2.6,
        sunAltitude: 22,
        sunAzimuth: 250,

        hemiSky: 0xdff2ff,
        hemiGround: 0x6d8fa6,
        hemiIntensity: 0.75,
        bounceColor: 0xbcd9ee,
        bounceIntensity: 0.5,

        rockTint: 0xb2c8d6,
        groundTint: 0xd8e8f1,
        strataA: 0xd9e9f3,
        strataB: 0x7d9bb0,
        strataC: 0xa9c3d3,
        veinColor: 0x8fe3ff,
        veinStrength: 0.4,

        skyZenith: 0x2c6cab,
        skyHorizon: 0xdaeefb,
        skyHaze: 0xc4dced,
        sunDiscColor: 0xffffff,

        dustColor: 0xf2fbff,
        dustDensity: 0.85,
        dustAdditive: false,

        accent: 0x7fd8ff,
        propStyle: "ice",
    },
    {
        key: "spore_hollow",
        name: "Spore Hollow",

        fogColor: 0x2a1a3c,
        fogDensity: 0.0044,

        sunColor: 0xc79bff,
        sunIntensity: 1.5,
        sunAltitude: 18,
        sunAzimuth: 296,

        hemiSky: 0x9a6ad8,
        hemiGround: 0x1a1024,
        hemiIntensity: 0.6,
        bounceColor: 0x8f5cc4,
        bounceIntensity: 0.6,

        rockTint: 0x48355e,
        groundTint: 0x392a4a,
        strataA: 0x5c4176,
        strataB: 0x221930,
        strataC: 0x785a94,
        veinColor: 0xb072d6,
        veinStrength: 0.85,

        skyZenith: 0x120b1f,
        skyHorizon: 0x6a3f96,
        skyHaze: 0x3f265b,
        sunDiscColor: 0xd9b6ff,

        dustColor: 0xc79bff,
        dustDensity: 1.15,
        dustAdditive: true,

        accent: 0xb072d6,
        propStyle: "mushroom",
    },
    {
        key: "void_rift",
        name: "Void Rift",

        fogColor: 0x0d0912,
        fogDensity: 0.0052,

        sunColor: 0xff4d8f,
        sunIntensity: 1.2,
        sunAltitude: 16,
        sunAzimuth: 340,

        hemiSky: 0x4a2a6a,
        hemiGround: 0x05040a,
        hemiIntensity: 0.45,
        bounceColor: 0xff2d78,
        bounceIntensity: 0.55,

        rockTint: 0x22202e,
        groundTint: 0x191722,
        strataA: 0x2f2c40,
        strataB: 0x0b0a11,
        strataC: 0x423d59,
        veinColor: 0xff2d78,
        veinStrength: 1.15,

        skyZenith: 0x04030a,
        skyHorizon: 0x3a0c26,
        skyHaze: 0x190713,
        sunDiscColor: 0xff86b4,

        dustColor: 0xff4d8f,
        dustDensity: 1.3,
        dustAdditive: true,

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

export function biomeSunDirection(biome: CanyonBiome): { x: number; y: number; z: number } {
    const altitude = (biome.sunAltitude * Math.PI) / 180;
    const azimuth = (biome.sunAzimuth * Math.PI) / 180;
    const horizontal = Math.cos(altitude);

    return {
        x: Math.sin(azimuth) * horizontal,
        y: Math.sin(altitude),
        z: Math.cos(azimuth) * horizontal,
    };
}
