// src/core/lib/tournaments.ts
// Shared between the admin dashboard, the Next API routes and the game client.
// game-server/tournaments.js mirrors the parts the CommonJS server needs.

export const TOURNAMENT_KINDS = [
    {
        key: "costume",
        labelKey: "g.tournament.kind.costume.label",
        descriptionKey: "g.tournament.kind.costume.description",
        adminLabel: "Best costume (painted at Alfredo)",
        // A submission is the painted character texture, snapshotted server-side.
        submission: "skin",
        rankBy: "likes",
    },
    {
        key: "build",
        labelKey: "g.tournament.kind.build.label",
        descriptionKey: "g.tournament.kind.build.description",
        adminLabel: "Best build in your own bubble",
        // A submission is a screenshot the player takes inside their own room.
        submission: "shot",
        rankBy: "likes",
    },
    {
        key: "xp24h",
        labelKey: "g.tournament.kind.xp24h.label",
        descriptionKey: "g.tournament.kind.xp24h.description",
        adminLabel: "Most XP earned during the window",
        // Nothing to upload — joining records an XP baseline and the server ranks
        // by the delta, so there is no "show my entry" step at all.
        submission: "none",
        rankBy: "xp",
    },
] as const;

export type TournamentKind = (typeof TOURNAMENT_KINDS)[number]["key"];
export type TournamentSubmissionKind = (typeof TOURNAMENT_KINDS)[number]["submission"];

export const TOURNAMENT_KINDS_BY_KEY = new Map(TOURNAMENT_KINDS.map((entry) => [entry.key, entry]));

export function isTournamentKind(value: unknown): value is TournamentKind {
    return typeof value === "string" && TOURNAMENT_KINDS_BY_KEY.has(value as TournamentKind);
}

export function submissionKindOf(kind: string): TournamentSubmissionKind {
    return TOURNAMENT_KINDS_BY_KEY.get(kind as TournamentKind)?.submission ?? "none";
}

export function ranksByLikes(kind: string): boolean {
    return TOURNAMENT_KINDS_BY_KEY.get(kind as TournamentKind)?.rankBy === "likes";
}

export const TOURNAMENT_CURRENCIES = ["TNJ", "SOL", "USDT", "USDC"] as const;
export type TournamentCurrency = (typeof TOURNAMENT_CURRENCIES)[number];

export function isTournamentCurrency(value: unknown): value is TournamentCurrency {
    return typeof value === "string" && (TOURNAMENT_CURRENCIES as readonly string[]).includes(value);
}

export const TOURNAMENT_STATUSES = ["draft", "published", "archived"] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export function isTournamentStatus(value: unknown): value is TournamentStatus {
    return typeof value === "string" && (TOURNAMENT_STATUSES as readonly string[]).includes(value);
}

// What a player sees. Derived from the window every time it is read, so a
// contest opens and closes on schedule without a cron job touching the row.
export type TournamentPhase = "upcoming" | "active" | "ended";

export const TOURNAMENT_LIMITS = {
    title: 80,
    description: 2000,
    rulesText: 2000,
    rewardNote: 240,
    payoutRef: 200,
    xPostUrl: 512,
    maxEntriesCap: 100_000,
    rewardAmountCap: 1_000_000_000,
    listLimit: 12,
    entriesLimit: 200,
} as const;

export function tournamentPhase(startsAt: number, endsAt: number, now = Date.now()): TournamentPhase {
    if (now < startsAt) return "upcoming";
    if (now >= endsAt) return "ended";
    return "active";
}

export function formatRewardAmount(amount: string | number): string {
    const value = typeof amount === "number" ? amount : Number(amount);
    if (!Number.isFinite(value)) return "0";
    if (Number.isInteger(value)) return value.toLocaleString("en-US");
    return value
        .toFixed(6)
        .replace(/0+$/, "")
        .replace(/\.$/, "");
}

export function formatReward(amount: string | number, currency: string): string {
    return `${formatRewardAmount(amount)} ${currency}`;
}

export const X_POST_URL_PREFIX = "https://x.com/";

// Deliberately the same rule the faction quests already enforce: only real x.com
// post links, never a shortener or a look-alike host.
export function isValidXPostUrl(url: unknown): url is string {
    if (typeof url !== "string") return false;
    const trimmed = url.trim();
    if (!trimmed.startsWith(X_POST_URL_PREFIX)) return false;
    if (trimmed.length <= X_POST_URL_PREFIX.length) return false;
    if (trimmed.length > TOURNAMENT_LIMITS.xPostUrl) return false;
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === "https:" && parsed.hostname === "x.com";
    } catch {
        return false;
    }
}

export interface TournamentSummary {
    id: string;
    kind: TournamentKind;
    title: string;
    description: string;
    rulesText: string;
    rewardAmount: string;
    rewardCurrency: string;
    rewardNote: string;
    accent: string;
    maxEntries: number;
    startsAt: number;
    endsAt: number;
    phase: TournamentPhase;
    entryCount: number;
    submission: TournamentSubmissionKind;
    winnerEntryId: string | null;
    // Viewer-relative state, so the panel can decide which button to show without
    // pulling the whole entry list first.
    joined: boolean;
    submitted: boolean;
    myEntryId: string | null;
    myXPostUrl: string | null;
    myLikedEntryId: string | null;
}

export interface TournamentEntryView {
    id: string;
    userId: string;
    wallet: string;
    nickname: string | null;
    skinUrl: string | null;
    shotUrl: string | null;
    xPostUrl: string | null;
    xpGained: number;
    likeCount: number;
    submittedAt: number | null;
    isMe: boolean;
    likedByMe: boolean;
    isWinner: boolean;
    // "joined" or "removed". The game only ever receives joined entries; the
    // admin view asks for both so a hidden entry can be put back.
    status: string;
}
