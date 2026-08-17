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
            "Hi! Sola. I run the job board for this tower, which mostly means I know everybody's business before they do.",
            "Every quest in the tower comes from me. You bring one back finished, I pay in Ash and experience.",
            "Here's your first, and it's an easy one: go say hello to the other five stewards. Tony at the counter, Alfredo, old Alaric, the canyon dispatcher, and the thing in the basement. Just say hello.",
            "That gets you to level 2, and then I can open your path — rifle or staff. Pick the wrong one and you come back to me. It's free until level 10. After that, it's Ash.",
        ],
        action: "Take the quest",
    },
    {
        id: "token-vendor",
        name: "Tony",
        role: "Trader",
        accent: "#f0b95c",
        emoji: "💰",
        lines: [
            "Tony. I run the counter. Anything in this world that has value passes over this table eventually.",
            "You bring me tokens, I give you Ash. Ash is the money of this tower — respecs, goods, everything upstairs is priced in it.",
            "So when your pockets fill up out there, you come to me first. Nothing else in this tower gets cheaper if you skip me.",
        ],
        action: "Trade tokens for Ash",
    },
    {
        id: "npc-alfredo",
        name: "Alfredo",
        role: "Appearance",
        accent: "#7cc4e8",
        emoji: "🎨",
        lines: [
            "Alfredo. Yes, that Alfredo. I am in charge of how you look, and you, my dear, are a project.",
            "Skins, masks, colour — every cosmetic in this tower passes through my hands. Nothing else.",
            "None of it will make you stronger, so let us be honest about that. It makes you recognisable. Out there, that is worth considerably more.",
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
            "Alaric. I keep the registry. Every faction in this world is written in it, the living ones and the ended ones.",
            "You may swear to one, or found your own if you can carry the weight. A faction earns its own gate, its own room and its own quests.",
            "Come to me when you tire of fighting alone. Nothing worth holding in this world was ever held by one pair of hands.",
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
            "Dispatcher. I handle canyon traffic. You want out of the tower, you go through me.",
            "Map's here. Segments open in order — Slime Valley first, then whatever is behind it. Clear one and the next unlocks. I don't set the order, I just post it.",
            "And that's where your levels are. Nothing inside the tower will ever make you stronger. Come back when you want that to change.",
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
            "I am the Keeper of Gates. I stood here before the tower had floors, and I will stand here after it has none.",
            "Every column in this hall is a token. While it lives, its gate is held open. When it dies, the gate seals, and everything beyond it is unmade.",
            "Come when you wish to know which ways are still open. I do not advise and I do not warn. I unlock.",
        ],
        action: "See the gates",
    },
];

export const NPC_DIALOGUES_BY_ID = new Map(NPC_DIALOGUES.map((d) => [d.id, d]));

export function isNpcId(value: string): value is NpcId {
    return NPC_DIALOGUES_BY_ID.has(value as NpcId);
}
