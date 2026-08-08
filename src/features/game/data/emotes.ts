// src/features/game/data/emotes.ts
export type EmoteKey = "laugh" | "fuck_you" | "angry" | "to_the_moon" | "green_candle";

export interface EmoteDefinition {
    key: EmoteKey;
    label: string;
    hint: string;
    accent: string;
    emoji: string;
}

export const EMOTES: EmoteDefinition[] = [
    { key: "laugh", label: "Laugh", hint: "Crying with laughter", accent: "#FFD93B", emoji: "😂" },
    { key: "fuck_you", label: "Fuck You", hint: "The universal gesture", accent: "#E8B08A", emoji: "🖕" },
    { key: "angry", label: "Angry", hint: "Blowing off steam", accent: "#FF5A4D", emoji: "😡" },
    { key: "to_the_moon", label: "To The Moon", hint: "Ignition and liftoff", accent: "#8FD8FF", emoji: "🚀" },
    { key: "green_candle", label: "Green Candle", hint: "Pump, then dump", accent: "#27D14F", emoji: "🕯️" },
];

export const BODY_EMOTES: EmoteKey[] = ["green_candle"];

export function isBodyEmote(key: EmoteKey): boolean {
    return BODY_EMOTES.includes(key);
}

export const EMOTES_BY_KEY = new Map(EMOTES.map((e) => [e.key, e]));

export const EMOTE_KEYS: EmoteKey[] = EMOTES.map((e) => e.key);

export function isEmoteKey(value: unknown): value is EmoteKey {
    return typeof value === "string" && (EMOTE_KEYS as string[]).includes(value);
}
