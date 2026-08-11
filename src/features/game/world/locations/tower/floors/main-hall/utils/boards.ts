// src/features/game/world/locations/tower/floors/main-hall/utils/boards.ts
import type { LeaderboardEntry, FactionSummary } from "../../../../../../network/NetworkManager";

export const BOARD_WIDTH = 1024;
export const BOARD_HEIGHT = 352;
export const BANNER_WIDTH = 256;
export const BANNER_HEIGHT = 512;

const RANK_COLORS = ["#ffd479", "#dfe4ec", "#d09a63"];
const TEXT_COLOR = "#e8edf5";
const MUTED_COLOR = "#8b95a6";
const ACCENT_COLOR = "#f0b95c";
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

function paintFrame(ctx: CanvasRenderingContext2D, title: string, subtitle: string) {
    ctx.fillStyle = "#0a0d13";
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    ctx.fillStyle = "#12161f";
    ctx.fillRect(0, 0, BOARD_WIDTH, 62);

    ctx.strokeStyle = "#3a4354";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, BOARD_WIDTH - 4, BOARD_HEIGHT - 4);

    ctx.fillStyle = ACCENT_COLOR;
    ctx.font = "bold 38px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(title, 28, 33);

    ctx.fillStyle = MUTED_COLOR;
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "right";
    ctx.fillText(subtitle, BOARD_WIDTH - 28, 33);
}

function paintRowBackground(ctx: CanvasRenderingContext2D, index: number, y: number, height: number) {
    if (index % 2 === 1) {
        ctx.fillStyle = "#101520";
        ctx.fillRect(12, y, BOARD_WIDTH - 24, height);
    }
}

function paintEmpty(ctx: CanvasRenderingContext2D, message: string) {
    ctx.fillStyle = MUTED_COLOR;
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, BOARD_WIDTH / 2, BOARD_HEIGHT / 2 + 20);
}

export function drawPlayerBoard(ctx: CanvasRenderingContext2D, entries: LeaderboardEntry[]) {
    paintFrame(ctx, "TOP TRADERS", "SCORE / KILLS / ASH");

    if (entries.length === 0) {
        paintEmpty(ctx, "awaiting market data");
        return;
    }

    const rowHeight = (BOARD_HEIGHT - 74) / ROWS;
    const visible = entries.slice(0, ROWS);

    visible.forEach((entry, index) => {
        const y = 68 + index * rowHeight;
        paintRowBackground(ctx, index, y, rowHeight);

        const centerY = y + rowHeight / 2;
        const rankColor = index < 3 ? RANK_COLORS[index] : MUTED_COLOR;

        ctx.textBaseline = "middle";
        ctx.textAlign = "right";
        ctx.fillStyle = rankColor;
        ctx.font = "bold 28px Arial";
        ctx.fillText(String(index + 1), 62, centerY);

        ctx.textAlign = "left";
        ctx.fillStyle = index < 3 ? rankColor : TEXT_COLOR;
        ctx.font = index < 3 ? "bold 30px Arial" : "bold 26px Arial";
        ctx.fillText(shortName(walletName(entry), 18), 86, centerY);

        const tag = entry.faction?.symbol ?? entry.faction?.name ?? "";
        if (tag) {
            ctx.fillStyle = MUTED_COLOR;
            ctx.font = "bold 22px Arial";
            ctx.fillText(shortName(tag, 8), 420, centerY);
        }

        ctx.textAlign = "right";
        ctx.fillStyle = ACCENT_COLOR;
        ctx.font = "bold 28px Arial";
        ctx.fillText(formatNumber(entry.score), 700, centerY);

        ctx.fillStyle = TEXT_COLOR;
        ctx.font = "bold 24px Arial";
        ctx.fillText(formatNumber(entry.kills), 840, centerY);

        ctx.fillStyle = MUTED_COLOR;
        ctx.fillText(formatNumber(entry.ash), BOARD_WIDTH - 28, centerY);
    });
}

export function drawFactionBoard(ctx: CanvasRenderingContext2D, factions: FactionSummary[]) {
    paintFrame(ctx, "FACTIONS", "LEVEL / MEMBERS");

    if (factions.length === 0) {
        paintEmpty(ctx, "no factions listed");
        return;
    }

    const rowHeight = (BOARD_HEIGHT - 74) / ROWS;
    const visible = factions.slice(0, ROWS);

    visible.forEach((faction, index) => {
        const y = 68 + index * rowHeight;
        paintRowBackground(ctx, index, y, rowHeight);

        const centerY = y + rowHeight / 2;
        const rankColor = index < 3 ? RANK_COLORS[index] : MUTED_COLOR;

        ctx.textBaseline = "middle";
        ctx.textAlign = "right";
        ctx.fillStyle = rankColor;
        ctx.font = "bold 28px Arial";
        ctx.fillText(String(faction.rank ?? index + 1), 62, centerY);

        ctx.textAlign = "left";
        ctx.fillStyle = index < 3 ? rankColor : TEXT_COLOR;
        ctx.font = index < 3 ? "bold 30px Arial" : "bold 26px Arial";
        ctx.fillText(shortName(faction.name, 20), 86, centerY);

        if (faction.symbol) {
            ctx.fillStyle = MUTED_COLOR;
            ctx.font = "bold 22px Arial";
            ctx.fillText(shortName(faction.symbol, 8), 520, centerY);
        }

        ctx.textAlign = "right";
        ctx.fillStyle = ACCENT_COLOR;
        ctx.font = "bold 28px Arial";
        ctx.fillText("LV " + faction.level, 800, centerY);

        ctx.fillStyle = TEXT_COLOR;
        ctx.font = "bold 24px Arial";
        ctx.fillText(String(faction.memberCount), BOARD_WIDTH - 28, centerY);
    });
}

export function drawBanner(ctx: CanvasRenderingContext2D, faction: FactionSummary | null, rank: number, color: string) {
    ctx.clearRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT);

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT - 28);

    ctx.beginPath();
    ctx.moveTo(0, BANNER_HEIGHT - 28);
    ctx.lineTo(BANNER_WIDTH / 2, BANNER_HEIGHT);
    ctx.lineTo(BANNER_WIDTH, BANNER_HEIGHT - 28);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(10,13,19,0.42)";
    ctx.fillRect(0, 0, BANNER_WIDTH, 96);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = RANK_COLORS[Math.min(rank - 1, 2)] ?? "#ffffff";
    ctx.font = "bold 62px Arial";
    ctx.fillText("#" + rank, BANNER_WIDTH / 2, 52);

    if (!faction) {
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = "bold 34px Arial";
        ctx.fillText("vacant", BANNER_WIDTH / 2, 240);
        return;
    }

    const symbol = (faction.symbol ?? faction.name).slice(0, 4).toUpperCase();
    ctx.fillStyle = "#0d1016";
    ctx.font = "bold 92px Arial";
    ctx.fillText(symbol, BANNER_WIDTH / 2, 220);

    ctx.fillStyle = "rgba(13,16,22,0.86)";
    ctx.font = "bold 30px Arial";
    ctx.fillText(shortName(faction.name, 14), BANNER_WIDTH / 2, 320);

    ctx.font = "bold 26px Arial";
    ctx.fillText("LV " + faction.level + "  ·  " + faction.memberCount, BANNER_WIDTH / 2, 372);
}

export function drawNoticeBoard(ctx: CanvasRenderingContext2D) {
    paintFrame(ctx, "FLOOR NOTICES", "MEMETOWER");

    const lines = [
        ["Portal", "travel between floors from the ring"],
        ["Safe zone", "weapons are holstered in this hall"],
        ["Events hall", "faction events open on schedule"],
        ["Crypto universe", "token columns in the basement"],
    ];

    const rowHeight = (BOARD_HEIGHT - 74) / lines.length;
    lines.forEach(([title, text], index) => {
        const y = 68 + index * rowHeight;
        paintRowBackground(ctx, index, y, rowHeight);

        const centerY = y + rowHeight / 2;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = ACCENT_COLOR;
        ctx.font = "bold 30px Arial";
        ctx.fillText(title, 32, centerY);

        ctx.fillStyle = MUTED_COLOR;
        ctx.font = "24px Arial";
        ctx.fillText(text, 300, centerY);
    });
}
