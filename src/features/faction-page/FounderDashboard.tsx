// src/features/faction-page/FounderDashboard.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Lock, Ticket, TrendingUp, Users, Wallet } from "lucide-react";
import { useAuth } from "@/core/auth/AuthProvider";
import { LoginButton } from "@/core/auth/components/LoginButton";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { accentHue } from "@/core/lib/accentHue";
import { PurchaseButton } from "@/features/shared/PurchaseButton";
import { useShopQuote } from "@/features/game/ui/hooks/useShopQuote";

interface FunnelDay {
  day: string;
  views: number;
  connects: number;
  eligible: number;
  claims: number;
}

interface ReferredPlayer {
  wallet: string;
  nickname: string | null;
  claimedAt: string;
  stillMember: boolean;
  lastPlayedAt: string | null;
  playtimeSeconds: number;
}

interface DashboardData {
  faction: { id: string; number: number; name: string; symbol: string | null; slug: string };
  promo: { code: string | null; seats: number; seatsUsed: number; seatsLeft: number; minUsdCents: number };
  funnel: {
    windowDays: number;
    totals: { views: number; connects: number; eligible: number; claims: number };
    lifetime: { claims: number; stillMembers: number; activeLastWeek: number };
    daily: FunnelDay[];
    referred: ReferredPlayer[];
  };
}

const SEAT_PACK = 50;

function shortWallet(wallet: string): string {
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

function playtime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function conversion(from: number, to: number): string | null {
  if (from <= 0) return null;
  return `${Math.round((to / from) * 100)}%`;
}

export function FounderDashboard({ slug }: { slug: string }) {
  const { t, language } = useLanguage();
  const { isAuthorized } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "denied" | "missing" | "error">("idle");

  const seatQuote = useShopQuote("faction_promo_seats", Boolean(data?.promo.code));

  const load = useCallback(async () => {
    if (!isAuthorized) return;
    setState("loading");
    try {
      const res = await fetch(`/api/faction/${encodeURIComponent(slug)}/dashboard`, { credentials: "include" });
      if (res.status === 403) return setState("denied");
      if (res.status === 404) return setState("missing");
      if (!res.ok) return setState("error");
      setData(await res.json());
      setState("idle");
    } catch {
      setState("error");
    }
  }, [isAuthorized, slug]);

  useEffect(() => {
    load();
  }, [load]);

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(language, { month: "short", day: "numeric" }),
    [language]
  );

  const hue = accentHue(data?.faction.slug ?? slug);
  const peak = data ? Math.max(1, ...data.funnel.daily.map((row) => Math.max(row.views, row.connects, row.claims))) : 1;

  if (!isAuthorized) {
    return (
      <Shell hue={hue} slug={slug} title={t("faction.dash.title")}>
        <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.02)] p-8 text-center">
          <Lock className="mx-auto mb-3 h-6 w-6 text-text-muted" />
          <p className="mb-5 text-sm text-text-secondary">{t("faction.dash.connect")}</p>
          <div className="flex justify-center">
            <LoginButton />
          </div>
        </div>
      </Shell>
    );
  }

  if (state === "loading" && !data) {
    return (
      <Shell hue={hue} slug={slug} title={t("faction.dash.title")}>
        <p className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("faction.dash.loading")}
        </p>
      </Shell>
    );
  }

  if (state === "denied" || state === "missing" || state === "error" || !data) {
    return (
      <Shell hue={hue} slug={slug} title={t("faction.dash.title")}>
        <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.02)] p-8 text-center">
          <Lock className="mx-auto mb-3 h-6 w-6 text-text-muted" />
          <p className="text-sm text-text-secondary">
            {state === "missing" ? t("faction.dash.missing") : t("faction.dash.denied")}
          </p>
          <p className="mt-2 text-xs text-text-muted">{t("faction.dash.deniedHint")}</p>
        </div>
      </Shell>
    );
  }

  const { funnel, promo, faction } = data;
  const steps = [
    { key: "views", label: t("faction.dash.step.views"), value: funnel.totals.views, icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { key: "connects", label: t("faction.dash.step.connects"), value: funnel.totals.connects, icon: <Wallet className="h-3.5 w-3.5" /> },
    { key: "eligible", label: t("faction.dash.step.eligible"), value: funnel.totals.eligible, icon: <Users className="h-3.5 w-3.5" /> },
    { key: "claims", label: t("faction.dash.step.claims"), value: funnel.totals.claims, icon: <Ticket className="h-3.5 w-3.5" /> },
  ];

  return (
    <Shell hue={hue} slug={faction.slug} title={faction.name} subtitle={faction.symbol ? `$${faction.symbol}` : null}>
      <section>
        <h2 className="mb-1 font-[family-name:var(--font-oxanium)] text-lg font-bold">{t("faction.dash.funnelTitle")}</h2>
        <p className="mb-4 text-xs text-text-muted">{t("faction.dash.window", { days: funnel.windowDays })}</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {steps.map((step, index) => {
            const rate = index === 0 ? null : conversion(steps[index - 1].value, step.value);
            return (
              <div key={step.key} className="rounded-xl border border-border bg-[rgba(255,255,255,0.02)] p-4">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-text-muted">
                  <span style={{ color: "var(--accent)" }}>{step.icon}</span>
                  {step.label}
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums">{step.value}</div>
                {rate && <div className="mt-0.5 text-[11px] text-text-muted tabular-nums">{rate}</div>}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-oxanium)] text-lg font-bold">{t("faction.dash.lifetime")}</h2>
        <div className="grid grid-cols-3 gap-3">
          <Tile label={t("faction.dash.lifetimeClaims")} value={funnel.lifetime.claims} />
          <Tile label={t("faction.dash.stillMembers")} value={funnel.lifetime.stillMembers} />
          <Tile label={t("faction.dash.activeWeek")} value={funnel.lifetime.activeLastWeek} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-oxanium)] text-lg font-bold">{t("faction.dash.dailyTitle")}</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-[rgba(255,255,255,0.02)] p-4">
          <div className="flex min-w-max items-end gap-1.5" style={{ height: 120 }}>
            {funnel.daily.map((row) => (
              <div key={row.day} className="flex w-4 flex-col items-center gap-1" title={`${row.day} · ${row.views} / ${row.connects} / ${row.claims}`}>
                <div className="flex w-full flex-1 flex-col justify-end gap-[2px]">
                  <div className="w-full rounded-sm bg-[rgba(255,255,255,0.12)]" style={{ height: `${(row.views / peak) * 70}px` }} />
                  <div className="w-full rounded-sm" style={{ height: `${(row.claims / peak) * 70}px`, background: "var(--accent)" }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-[rgba(255,255,255,0.25)]" />
              {t("faction.dash.step.views")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: "var(--accent)" }} />
              {t("faction.dash.step.claims")}
            </span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-oxanium)] text-lg font-bold">{t("faction.dash.seatsTitle")}</h2>
        <div className="rounded-xl border border-border bg-[rgba(255,255,255,0.02)] p-4">
          {promo.code ? (
            <>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-xs text-text-secondary">{t("faction.dash.seatsLeft")}</span>
                <span className="text-sm font-bold tabular-nums">{promo.seatsLeft} / {promo.seats}</span>
              </div>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${promo.seats > 0 ? Math.min(100, Math.round((promo.seatsUsed / promo.seats) * 100)) : 0}%`,
                    background: "var(--accent)",
                  }}
                />
              </div>
              {seatQuote?.payableTnj ? (
                <PurchaseButton
                  factionId={faction.id}
                  factionUpgrade="promo-seats"
                  quoteItemId="faction_promo_seats"
                  price={seatQuote.payableTnj}
                  onSuccess={load}
                />
              ) : (
                <p className="py-2 text-center text-xs text-text-muted">{t("g.pay.preparing")}</p>
              )}
              <p className="mt-2 text-[11px] text-text-muted">{t("faction.dash.buySeats", { count: SEAT_PACK })}</p>
            </>
          ) : (
            <p className="text-sm text-text-secondary">{t("faction.dash.noCode")}</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-oxanium)] text-lg font-bold">{t("faction.dash.referredTitle")}</h2>
        {funnel.referred.length === 0 ? (
          <p className="rounded-xl border border-border bg-[rgba(255,255,255,0.02)] p-6 text-center text-sm text-text-muted">
            {t("faction.dash.referredEmpty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-[rgba(255,255,255,0.02)]">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-widest text-text-muted">
                  <th className="px-4 py-2.5 font-semibold">{t("faction.dash.colPlayer")}</th>
                  <th className="px-4 py-2.5 font-semibold">{t("faction.dash.colClaimed")}</th>
                  <th className="px-4 py-2.5 font-semibold">{t("faction.dash.colStatus")}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{t("faction.dash.colPlaytime")}</th>
                </tr>
              </thead>
              <tbody>
                {funnel.referred.map((player) => (
                  <tr key={player.wallet} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-2.5">{player.nickname || shortWallet(player.wallet)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-text-secondary">
                      {dateFormat.format(new Date(player.claimedAt))}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={
                          player.stillMember
                            ? { background: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" }
                            : { background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }
                        }
                      >
                        {player.stillMember ? t("faction.dash.statusIn") : t("faction.dash.statusOut")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
                      {player.playtimeSeconds > 0 ? playtime(player.playtimeSeconds) : t("faction.dash.never")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-center text-[11px] text-text-muted">{t("faction.dash.hint")}</p>
    </Shell>
  );
}

function Shell({
  hue,
  slug,
  title,
  subtitle,
  children,
}: {
  hue: number;
  slug: string;
  title: string;
  subtitle?: string | null;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <main className="min-h-dvh" style={{ ["--accent" as string]: `hsl(${hue} 88% 62%)` }}>
      <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 sm:py-14">
        <div>
          <a
            href={`/f/${slug}`}
            className="mb-4 inline-flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-text-secondary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("faction.dash.backToPage")}
          </a>
          <h1 className="font-[family-name:var(--font-oxanium)] text-2xl font-extrabold sm:text-3xl">{title}</h1>
          {subtitle && (
            <p className="mt-1 font-mono text-sm tracking-widest" style={{ color: "var(--accent)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>
    </main>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-[rgba(255,255,255,0.02)] p-4">
      <div className="text-[10px] uppercase tracking-widest text-text-muted">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
