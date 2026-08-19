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
        name: "g.npc.sola",
        role: "g.npc.quest-giver-sola.role",
        accent: "#7fd6a2",
        emoji: "🌱",
        lines: [
            "g.npc.quest-giver-sola.line1",
            "g.npc.quest-giver-sola.line2",
            "g.npc.quest-giver-sola.line3",
            "g.npc.quest-giver-sola.line4",
        ],
        action: "g.npc.quest-giver-sola.action",
    },
    {
        id: "token-vendor",
        name: "g.npc.tony",
        role: "g.npc.token-vendor.role",
        accent: "#f0b95c",
        emoji: "💰",
        lines: [
            "g.npc.token-vendor.line1",
            "g.npc.token-vendor.line2",
            "g.npc.token-vendor.line3",
        ],
        action: "g.npc.token-vendor.action",
    },
    {
        id: "npc-alfredo",
        name: "g.npc.alfredo",
        role: "g.npc.npc-alfredo.role",
        accent: "#7cc4e8",
        emoji: "🎨",
        lines: [
            "g.npc.npc-alfredo.line1",
            "g.npc.npc-alfredo.line2",
            "g.npc.npc-alfredo.line3",
        ],
        action: "g.npc.npc-alfredo.action",
    },
    {
        id: "faction-broker",
        name: "g.npc.alaric",
        role: "g.npc.faction-broker.role",
        accent: "#c79ae0",
        emoji: "🏛️",
        lines: [
            "g.npc.faction-broker.line1",
            "g.npc.faction-broker.line2",
            "g.npc.faction-broker.line3",
        ],
        action: "g.npc.faction-broker.action",
    },
    {
        id: "canyon-dispatcher",
        name: "g.npc.dispatcher",
        role: "g.npc.canyon-dispatcher.role",
        accent: "#6fa8ff",
        emoji: "🗺️",
        lines: [
            "g.npc.canyon-dispatcher.line1",
            "g.npc.canyon-dispatcher.line2",
            "g.npc.canyon-dispatcher.line3",
        ],
        action: "g.npc.canyon-dispatcher.action",
    },
    {
        id: "gate-steward",
        name: "g.npc.keeper",
        role: "g.npc.gate-steward.role",
        accent: "#7FE6CF",
        emoji: "🔮",
        lines: [
            "g.npc.gate-steward.line1",
            "g.npc.gate-steward.line2",
            "g.npc.gate-steward.line3",
        ],
        action: "g.npc.gate-steward.action",
    },
];

export const NPC_DIALOGUES_BY_ID = new Map(NPC_DIALOGUES.map((d) => [d.id, d]));

export function isNpcId(value: string): value is NpcId {
    return NPC_DIALOGUES_BY_ID.has(value as NpcId);
}
