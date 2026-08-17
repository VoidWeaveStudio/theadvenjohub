// src/features/game/data/npcDialogues.ts
export type NpcId =
    | "quest-giver-sola"
    | "token-vendor"
    | "npc-alfredo"
    | "faction-broker"
    | "canyon-dispatcher"
    | "gate-steward";

export interface NpcDialogue {
    id: NpcId;
    name: string;
    role: string;
    accent: string;
    emoji: string;
    lines: string[];
    action: string;
}

export const NPC_DIALOGUES: NpcDialogue[] = [
    {
        id: "quest-giver-sola",
        name: "Sola",
        role: "Guide of the Tower",
        accent: "#7fd6a2",
        emoji: "🌱",
        lines: [
            "You made it inside. Good. Most people stand at the door for a week first.",
            "I hand out the work that keeps this tower running, and I pay in Ash for it.",
            "When you are ready to pick a path — rifle or staff — I am the one who signs it off. And I can undo that choice too, for a price.",
        ],
        action: "See what she needs",
    },
    {
        id: "token-vendor",
        name: "Tony",
        role: "Trader",
        accent: "#f0b95c",
        emoji: "💰",
        lines: [
            "Whatever coins you scraped off the floor out there, I will take them.",
            "I pay in Ash, and Ash is what buys everything else in this tower.",
            "No, I do not care what the chart says. Bring it here and we talk numbers.",
        ],
        action: "Trade coins for Ash",
    },
    {
        id: "npc-alfredo",
        name: "Alfredo",
        role: "Appearance",
        accent: "#7cc4e8",
        emoji: "🎨",
        lines: [
            "Ah — someone who still dresses like a default character. We can fix that.",
            "Skins, masks, colours. Nothing here makes you stronger, it only makes you look like someone worth remembering.",
            "Come back whenever you get bored of your own reflection.",
        ],
        action: "Change your look",
    },
    {
        id: "faction-broker",
        name: "Alaric",
        role: "Factions",
        accent: "#c79ae0",
        emoji: "🏛️",
        lines: [
            "Every faction in this world is written down in my registry. Every single one.",
            "You can join one, found your own, or just read what the others are up to.",
            "A faction gets its own gate, its own room and its own quests. Alone you are just another shooter.",
        ],
        action: "Open the registry",
    },
    {
        id: "canyon-dispatcher",
        name: "Canyon Dispatcher",
        role: "Expeditions",
        accent: "#6fa8ff",
        emoji: "🗺️",
        lines: [
            "You want the canyon? Everyone wants the canyon, right up until the first boss.",
            "I keep the map. Slime Valley first, then it gets colder, hotter and much worse.",
            "Clear a segment and I will open the next one for you. Die, and you walk back here on foot.",
        ],
        action: "View the canyon map",
    },
    {
        id: "gate-steward",
        name: "Keeper of Gates",
        role: "Token Gates",
        accent: "#7FE6CF",
        emoji: "🔮",
        lines: [
            "Down here the tower listens to the market. Every column you see is a token holding a gate open.",
            "When a token grows, its gate widens. When it dies, the gate closes and whatever is behind it is gone.",
            "I only keep the keys. What you do on the other side is your business.",
        ],
        action: "Speak about the gates",
    },
];

export const NPC_DIALOGUES_BY_ID = new Map(NPC_DIALOGUES.map((d) => [d.id, d]));

export function isNpcId(value: string): value is NpcId {
    return NPC_DIALOGUES_BY_ID.has(value as NpcId);
}
