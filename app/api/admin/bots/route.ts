// app/api/admin/bots/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";

const TIMEOUT_MS = 60_000;

interface BotConfig {
    id: string;
    label: string;
    base: string;
    token: string;
}

function configuredBots(): BotConfig[] {
    const registry: { id: string; label: string; base?: string; token?: string }[] = [
        {
            id: "memetic",
            label: "MEMETIC",
            base: process.env.MEMETIC_API_URL,
            token: process.env.MEMETIC_ADMIN_TOKEN,
        },
    ];

    return registry
        .filter((entry): entry is Required<typeof entry> => Boolean(entry.base && entry.token))
        .map((entry) => ({
            id: entry.id,
            label: entry.label,
            base: entry.base.replace(/\/+$/, ""),
            token: entry.token,
        }));
}

async function call<T>(bot: BotConfig, path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${bot.base}${path}`, {
        ...init,
        headers: {
            "x-admin-token": bot.token,
            "content-type": "application/json",
            ...(init?.headers ?? {}),
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error(res.status === 403 ? "bad_admin_token" : `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
}

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    const bots = configuredBots();

    const results = await Promise.all(
        bots.map(async (bot) => {
            try {
                const [stats, reports] = await Promise.all([
                    call<Record<string, unknown>>(bot, "/api/admin/stats"),
                    call<{ reports: unknown[] }>(bot, "/api/admin/reports"),
                ]);
                return {
                    id: bot.id,
                    label: bot.label,
                    ok: true,
                    error: null,
                    stats,
                    reports: reports.reports ?? [],
                };
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.name === "TimeoutError"
                            ? "timed_out"
                            : error.message
                        : "unreachable";
                return { id: bot.id, label: bot.label, ok: false, error: message, stats: null, reports: [] };
            }
        })
    );

    return NextResponse.json({ bots: results, configured: bots.length });
}

export async function POST(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    const body = await req.json().catch(() => null);
    const botId = typeof body?.bot === "string" ? body.bot : "";
    const coinId = typeof body?.coinId === "string" ? body.coinId : "";
    const hidden = body?.hidden !== false;

    const bot = configuredBots().find((entry) => entry.id === botId);
    if (!bot) return NextResponse.json({ error: "unknown_bot" }, { status: 400 });
    if (!coinId) return NextResponse.json({ error: "missing_coin" }, { status: 400 });

    const denied = await verifyAdminAction(
        req,
        body,
        hidden ? "bot_coin_hide" : "bot_coin_show",
        coinId
    );
    if (denied) return denied;

    try {
        await call(bot, `/api/admin/coins/${encodeURIComponent(coinId)}/hide`, {
            method: "POST",
            body: JSON.stringify({ hidden }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "unreachable";
        return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json({ ok: true, hidden });
}
