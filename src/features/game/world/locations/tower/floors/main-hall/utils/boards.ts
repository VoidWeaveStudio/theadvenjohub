// src/features/game/world/locations/tower/floors/main-hall/utils/boards.ts
import type { LeaderboardEntry, FactionSummary, FactionQuestEntry } from "../../../../../../network/NetworkManager";
import type { TournamentSummary } from "@/core/lib/tournaments";
import { formatReward } from "@/core/lib/tournaments";
import { FACTION_QUEST_TYPES } from "../../../../../../../../core/lib/factionQuests";
import { factionColor } from "../layout";
import { drawFactionLogo } from "./factionImages";
import { t } from "@/core/i18n";

function questLabel(key: string): string {
    const type = FACTION_QUEST_TYPES.find((entry) => entry.key === key);
    return type ? t(type.labelKey) : key.replace(/_/g, " ");
}

export const BOARD_WIDTH = 1536;
export const BOARD_HEIGHT = 512;
export const BANNER_WIDTH = 384;
export const BANNER_HEIGHT = 768;

const RANK_COLORS = ["#ffd479", "#dfe4ec", "#d09a63"];
const TEXT_COLOR = "#e8edf5";
const MUTED_COLOR = "#8b95a6";
const ACCENT_COLOR = "#f0b95c";
const UP_COLOR = "#5fd39a";
const DOWN_COLOR = "#e2666e";
const ROWS = 8;

function formatNumber(value: number): string {
    if (!Number.isFinite(value)) return "0";
    if (value >= 1e9) return (value / 1e9).toFixed(1) + "B";
    if (value >= 1e6) return (value / 1e6).toFixed(1) + "M";
    if (value >= 1e3) return (value / 1e3).toFixed(1) + "K";
    return Math.round(value).toString();
}

function shortName(value: string, max: number): string {
    return value.length > max ? value.slice(0, max - 1) + "…" : value;
}

function walletName(entry: LeaderboardEntry): string {
    if (entry.nickname && entry.nickname.trim().length > 0) return entry.nickname;
    if (entry.wallet.length > 10) return entry.wallet.slice(0, 4) + "…" + entry.wallet.slice(-4);
    return entry.wallet;
}

export function hexColor(value: number): string {
    return "#" + value.toString(16).padStart(6, "0");
}

function paintShell(ctx: CanvasRenderingContext2D, title: string, subtitle: string, accent: string) {
    const backdrop = ctx.createLinearGradient(0, 0, 0, BOARD_HEIGHT);
    backdrop.addColorStop(0, "#0d1119");
    backdrop.addColorStop(1, "#05070b");
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < BOARD_WIDTH; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, BOARD_HEIGHT);
        ctx.stroke();
    }

    const header = ctx.createLinearGradient(0, 0, BOARD_WIDTH, 0);
    header.addColorStop(0, "rgba(20,26,38,0.95)");
    header.addColorStop(1, "rgba(10,13,19,0.95)");
    ctx.fillStyle = header;
    ctx.fillRect(0, 0, BOARD_WIDTH, 86);

    ctx.fillStyle = accent;
    ctx.fillRect(0, 84, BOARD_WIDTH, 3);
    ctx.fillRect(0, 0, 10, 86);

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = accent;
    ctx.font = "bold 52px Arial";
    ctx.fillText(title, 36, 45);

    ctx.fillStyle = MUTED_COLOR;
    ctx.font = "bold 26px Arial";
    ctx.textAlign = "right";
    ctx.fillText(subtitle, BOARD_WIDTH - 36, 45);

    ctx.strokeStyle = "rgba(199,154,75,0.35)";
    ctx.lineWidth = 5;
    ctx.strokeRect(2.5, 2.5, BOARD_WIDTH - 5, BOARD_HEIGHT - 5);
}

function paintRow(ctx: CanvasRenderingContext2D, index: number, y: number, height: number, accent: string) {
    if (index % 2 === 1) {
        ctx.fillStyle = "rgba(255,255,255,0.028)";
        ctx.fillRect(14, y, BOARD_WIDTH - 28, height - 3);
    }
    if (index < 3) {
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(14, y, 5, height - 3);
        ctx.globalAlpha = 1;
    }
}

function paintEmpty(ctx: CanvasRenderingContext2D, message: string) {
    ctx.fillStyle = MUTED_COLOR;
    ctx.font = "bold 36px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, BOARD_WIDTH / 2, BOARD_HEIGHT / 2 + 40);
}

function paintSparkline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, up: boolean) {
    let state = (seed * 2654435761) >>> 0;
    const next = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };

    ctx.strokeStyle = up ? UP_COLOR : DOWN_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();

    let value = 0.5;
    for (let i = 0; i <= 22; i++) {
        value += (next() - (up ? 0.42 : 0.58)) * 0.24;
        value = Math.max(0.06, Math.min(0.94, value));
        const px = x + (i / 22) * w;
        const py = y + h - value * h;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.stroke();
}

export function drawPlayerBoard(ctx: CanvasRenderingContext2D, entries: LeaderboardEntry[]) {
    paintShell(ctx, t("g.board.topTraders"), t("g.board.traderCols"), ACCENT_COLOR);

    if (entries.length === 0) {
        paintEmpty(ctx, t("g.board.awaitingData"));
        return;
    }

    const rowHeight = (BOARD_HEIGHT - 104) / ROWS;
    const visible = entries.slice(0, ROWS);

    visible.forEach((entry, index) => {
        const y = 96 + index * rowHeight;
        const rankColor = index < 3 ? RANK_COLORS[index] : MUTED_COLOR;
        paintRow(ctx, index, y, rowHeight, rankColor);

        const centerY = y + rowHeight / 2;

        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.fillStyle = rankColor;
        ctx.font = index < 3 ? "bold 40px Arial" : "bold 30px Arial";
        ctx.fillText(String(index + 1), 62, centerY);

        const tint = entry.faction ? hexColor(factionColor(index + 3)) : "#3a4354";
        const logoSize = rowHeight - 16;
        drawFactionLogo(
            ctx,
            null,
            110,
            y + 8,
            logoSize,
            tint,
            entry.faction?.symbol ?? entry.faction?.name ?? "—"
        );

        ctx.textAlign = "left";
        ctx.fillStyle = index < 3 ? rankColor : TEXT_COLOR;
        ctx.font = index < 3 ? "bold 38px Arial" : "bold 32px Arial";
        ctx.fillText(shortName(walletName(entry), 18), 126 + logoSize, centerY - 8);

        const tag = entry.faction?.name ?? t("g.board.unaffiliated");
        ctx.fillStyle = MUTED_COLOR;
        ctx.font = "bold 22px Arial";
        ctx.fillText(shortName(tag, 22), 126 + logoSize, centerY + 20);

        paintSparkline(ctx, 700, y + 10, 190, rowHeight - 22, index + 11, index % 3 !== 2);

        ctx.textAlign = "right";
        ctx.fillStyle = ACCENT_COLOR;
        ctx.font = "bold 34px Arial";
        ctx.fillText(formatNumber(entry.score), 1080, centerY);

        ctx.fillStyle = TEXT_COLOR;
        ctx.font = "bold 28px Arial";
        ctx.fillText(formatNumber(entry.kills), 1270, centerY);

        ctx.fillStyle = MUTED_COLOR;
        ctx.fillText(formatNumber(entry.ash), BOARD_WIDTH - 36, centerY);
    });
}

export function drawFactionBoard(ctx: CanvasRenderingContext2D, factions: FactionSummary[]) {
    paintShell(ctx, t("g.board.topFactions"), t("g.board.factionCols"), "#c79ae0");

    if (factions.length === 0) {
        paintEmpty(ctx, t("g.board.noFactions"));
        return;
    }

    const rowHeight = (BOARD_HEIGHT - 104) / ROWS;
    const visible = factions.slice(0, ROWS);

    visible.forEach((faction, index) => {
        const y = 96 + index * rowHeight;
        const rankColor = index < 3 ? RANK_COLORS[index] : MUTED_COLOR;
        paintRow(ctx, index, y, rowHeight, rankColor);

        const centerY = y + rowHeight / 2;
        const tint = hexColor(factionColor(faction.number));

        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.fillStyle = rankColor;
        ctx.font = index < 3 ? "bold 40px Arial" : "bold 30px Arial";
        ctx.fillText(String(faction.rank ?? index + 1), 62, centerY);

        const logoSize = rowHeight - 14;
        drawFactionLogo(ctx, faction.image, 108, y + 7, logoSize, tint, faction.symbol ?? faction.name);

        ctx.textAlign = "left";
        ctx.fillStyle = index < 3 ? rankColor : TEXT_COLOR;
        ctx.font = index < 3 ? "bold 38px Arial" : "bold 32px Arial";
        ctx.fillText(shortName(faction.name, 20), 124 + logoSize, centerY - 8);

        ctx.fillStyle = tint;
        ctx.font = "bold 23px Arial";
        ctx.fillText(shortName(faction.symbol ?? "—", 12), 124 + logoSize, centerY + 20);

        paintSparkline(ctx, 780, y + 10, 190, rowHeight - 22, faction.number + 5, index % 4 !== 3);

        ctx.textAlign = "right";
        ctx.fillStyle = ACCENT_COLOR;
        ctx.font = "bold 34px Arial";
        ctx.fillText(t("g.board.lv", { level: faction.level }), 1160, centerY);

        ctx.fillStyle = TEXT_COLOR;
        ctx.font = "bold 30px Arial";
        ctx.fillText(String(faction.memberCount), 1320, centerY);

        ctx.fillStyle = MUTED_COLOR;
        ctx.font = "bold 26px Arial";
        ctx.fillText(formatNumber(faction.levelProgressAsh ?? 0), BOARD_WIDTH - 36, centerY);
    });
}

export function drawBanner(ctx: CanvasRenderingContext2D, faction: FactionSummary | null, rank: number, color: string) {
    ctx.clearRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT);

    const cloth = ctx.createLinearGradient(0, 0, BANNER_WIDTH, BANNER_HEIGHT);
    cloth.addColorStop(0, color);
    cloth.addColorStop(0.55, "rgba(0,0,0,0)");
    ctx.fillStyle = "#141821";
    ctx.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT - 46);
    ctx.fillStyle = cloth;
    ctx.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT - 46);

    ctx.beginPath();
    ctx.moveTo(0, BANNER_HEIGHT - 46);
    ctx.lineTo(BANNER_WIDTH / 2, BANNER_HEIGHT);
    ctx.lineTo(BANNER_WIDTH, BANNER_HEIGHT - 46);
    ctx.closePath();
    ctx.fillStyle = "#141821";
    ctx.fill();
    ctx.fillStyle = cloth;
    ctx.fill();

    ctx.strokeStyle = "rgba(199,154,75,0.75)";
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, BANNER_WIDTH - 24, BANNER_HEIGHT - 82);

    ctx.fillStyle = "rgba(6,8,12,0.55)";
    ctx.fillRect(12, 12, BANNER_WIDTH - 24, 116);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = RANK_COLORS[Math.min(rank - 1, 2)] ?? "#ffffff";
    ctx.font = "bold 78px Arial";
    ctx.fillText("#" + rank, BANNER_WIDTH / 2, 70);

    if (!faction) {
        ctx.fillStyle = "rgba(232,237,245,0.6)";
        ctx.font = "bold 40px Arial";
        ctx.fillText(t("g.board.vacant"), BANNER_WIDTH / 2, 380);
        return;
    }

    drawFactionLogo(
        ctx,
        faction.image,
        BANNER_WIDTH / 2 - 96,
        176,
        192,
        color,
        faction.symbol ?? faction.name
    );

    ctx.fillStyle = "#0d1016";
    ctx.font = "bold 62px Arial";
    ctx.fillText((faction.symbol ?? faction.name).slice(0, 6).toUpperCase(), BANNER_WIDTH / 2, 424);

    ctx.fillStyle = "rgba(13,16,22,0.9)";
    ctx.font = "bold 34px Arial";
    ctx.fillText(shortName(faction.name, 15), BANNER_WIDTH / 2, 490);

    ctx.fillStyle = "rgba(13,16,22,0.78)";
    ctx.font = "bold 28px Arial";
    ctx.fillText(t("g.board.bannerMeta", { level: faction.level, members: faction.memberCount }), BANNER_WIDTH / 2, 546);

    ctx.strokeStyle = "rgba(13,16,22,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(70, 580);
    ctx.lineTo(BANNER_WIDTH - 70, 580);
    ctx.stroke();

    ctx.fillStyle = "rgba(13,16,22,0.72)";
    ctx.font = "bold 24px Arial";
    ctx.fillText(t("g.board.syndicate"), BANNER_WIDTH / 2, 616);
}

export function drawNoticeBoard(ctx: CanvasRenderingContext2D) {
    paintShell(ctx, t("g.board.floorNotices"), t("g.board.exchange"), ACCENT_COLOR);

    const lines = ["pit", "safeZone", "balcony", "events", "universe"].map((id) => [
        t(`g.notice.${id}.title`),
        t(`g.notice.${id}.text`),
    ]);

    const rowHeight = (BOARD_HEIGHT - 104) / lines.length;
    lines.forEach(([title, text], index) => {
        const y = 96 + index * rowHeight;
        paintRow(ctx, index, y, rowHeight, ACCENT_COLOR);

        const centerY = y + rowHeight / 2;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = ACCENT_COLOR;
        ctx.font = "bold 36px Arial";
        ctx.fillText(title, 44, centerY);

        ctx.fillStyle = MUTED_COLOR;
        ctx.font = "28px Arial";
        ctx.fillText(text, 430, centerY);
    });
}

export function drawQuestBoard(ctx: CanvasRenderingContext2D, quests: FactionQuestEntry[]) {
    paintShell(ctx, t("g.board.factionQuests"), t("g.board.questCols"), UP_COLOR);

    if (quests.length === 0) {
        paintEmpty(ctx, t("g.board.noQuests"));
        return;
    }

    const rows = 6;
    const rowHeight = (BOARD_HEIGHT - 104) / rows;
    const visible = quests.slice(0, rows);

    visible.forEach((quest, index) => {
        const y = 96 + index * rowHeight;
        const tint = hexColor(factionColor(index + 2));
        paintRow(ctx, index, y, rowHeight, tint);

        const centerY = y + rowHeight / 2;
        const logoSize = rowHeight - 16;

        drawFactionLogo(ctx, quest.factionImage, 34, y + 8, logoSize, tint, quest.factionSymbol ?? quest.factionName);

        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = "bold 36px Arial";
        ctx.fillText(shortName(quest.factionName, 18), 52 + logoSize, centerY - 12);

        ctx.fillStyle = MUTED_COLOR;
        ctx.font = "bold 24px Arial";
        ctx.fillText(shortName(questLabel(quest.questType), 30), 52 + logoSize, centerY + 20);

        const remaining = Math.max(0, quest.slotsRemaining);
        const filled = quest.slotsTotal > 0 ? 1 - remaining / quest.slotsTotal : 1;
        const barX = 880;
        const barWidth = 300;
        const barY = centerY - 9;

        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(barX, barY, barWidth, 18);
        ctx.fillStyle = remaining > 0 ? UP_COLOR : DOWN_COLOR;
        ctx.fillRect(barX, barY, barWidth * Math.min(1, Math.max(0, filled)), 18);

        ctx.textAlign = "left";
        ctx.fillStyle = MUTED_COLOR;
        ctx.font = "bold 20px Arial";
        ctx.fillText(t("g.board.slotsLeft", { left: remaining, total: quest.slotsTotal }), barX, centerY + 28);

        ctx.textAlign = "right";
        ctx.fillStyle = ACCENT_COLOR;
        ctx.font = "bold 38px Arial";
        ctx.fillText(t("g.board.rewardAsh", { amount: formatNumber(quest.rewardAsh) }), BOARD_WIDTH - 36, centerY);
    });
}


export const PRIZE_BOARD_WIDTH = 1024;
export const PRIZE_BOARD_HEIGHT = 512;

function prizeCountdown(tournament: TournamentSummary, now: number): string {
    const target = tournament.phase === "upcoming" ? tournament.startsAt : tournament.endsAt;
    const remaining = target - now;
    if (tournament.phase === "ended" || remaining <= 0) return t("g.tournament.board.closed");

    const hours = Math.floor(remaining / 3_600_000);
    if (hours >= 24) return t("g.tournament.board.days", { count: Math.floor(hours / 24) });
    if (hours >= 1) return t("g.tournament.board.hours", { count: hours });
    return t("g.tournament.board.minutes", { count: Math.max(1, Math.floor(remaining / 60_000)) });
}

function prizePhaseLabel(tournament: TournamentSummary): string {
    if (tournament.phase === "upcoming") return t("g.tournament.phase.upcoming");
    if (tournament.phase === "ended") return t("g.tournament.phase.ended");
    return t("g.tournament.phase.active");
}

// The billboard is the advertisement, not the panel: one line per contest with
// the prize, the clock and the entry count, and nothing a player has to read twice.
export function drawTournamentBoard(
    ctx: CanvasRenderingContext2D,
    tournaments: TournamentSummary[],
    now = Date.now()
) {
    const width = PRIZE_BOARD_WIDTH;
    const height = PRIZE_BOARD_HEIGHT;

    const backdrop = ctx.createLinearGradient(0, 0, 0, height);
    backdrop.addColorStop(0, "#141019");
    backdrop.addColorStop(1, "#07050a");
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,209,102,0.06)";
    for (let y = 0; y < height; y += 24) ctx.fillRect(0, y, width, 1);

    ctx.fillStyle = "rgba(24,18,32,0.96)";
    ctx.fillRect(0, 0, width, 92);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(0, 90, width, 4);
    ctx.fillRect(0, 0, 12, 92);

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 50px Arial";
    ctx.fillText(t("g.tournament.board.title"), 40, 48);

    ctx.textAlign = "right";
    ctx.fillStyle = MUTED_COLOR;
    ctx.font = "bold 26px Arial";
    ctx.fillText(t("g.tournament.board.subtitle"), width - 40, 48);

    ctx.strokeStyle = "rgba(255,209,102,0.35)";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, width - 6, height - 6);

    const live = tournaments.filter((entry) => entry.phase !== "ended");
    const shown = (live.length > 0 ? live : tournaments).slice(0, 4);

    if (shown.length === 0) {
        ctx.fillStyle = MUTED_COLOR;
        ctx.font = "bold 34px Arial";
        ctx.textAlign = "center";
        ctx.fillText(t("g.tournament.board.empty"), width / 2, height / 2 + 30);
        return;
    }

    const rowHeight = (height - 116) / 4;

    shown.forEach((tournament, index) => {
        const y = 104 + index * rowHeight;
        const accent = /^#[0-9a-fA-F]{6}$/.test(tournament.accent) ? tournament.accent : "#ffd166";
        const centerY = y + rowHeight / 2;

        if (index % 2 === 1) {
            ctx.fillStyle = "rgba(255,255,255,0.03)";
            ctx.fillRect(16, y, width - 32, rowHeight - 4);
        }

        ctx.fillStyle = accent;
        ctx.globalAlpha = tournament.phase === "active" ? 0.85 : 0.35;
        ctx.fillRect(16, y + 4, 7, rowHeight - 12);
        ctx.globalAlpha = 1;

        ctx.textAlign = "left";
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = "bold 36px Arial";
        ctx.fillText(shortName(tournament.title, 26), 44, centerY - 16);

        ctx.fillStyle = accent;
        ctx.font = "bold 22px Arial";
        ctx.fillText(prizePhaseLabel(tournament).toUpperCase(), 44, centerY + 20);

        ctx.fillStyle = MUTED_COLOR;
        ctx.font = "bold 22px Arial";
        ctx.fillText(
            t("g.tournament.board.entries", { count: tournament.entryCount }),
            220,
            centerY + 20
        );

        ctx.textAlign = "right";
        ctx.fillStyle = "#ffd166";
        ctx.font = "bold 38px Arial";
        ctx.fillText(formatReward(tournament.rewardAmount, tournament.rewardCurrency), width - 44, centerY - 14);

        ctx.fillStyle = MUTED_COLOR;
        ctx.font = "bold 24px Arial";
        ctx.fillText(prizeCountdown(tournament, now), width - 44, centerY + 22);
    });
}
