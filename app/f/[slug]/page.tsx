// app/f/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BadgeCheck, Crown, Flame, Gamepad2, Layers, ShieldAlert, ShieldCheck, Sparkles, Users } from "lucide-react";
import { accentHue, getPublicFactionCached, type PublicFaction } from "@/core/lib/factionPublic";
import { factionPageUrl, SITE_URL } from "@/core/lib/siteUrl";
import { serverTranslator } from "@/core/i18n/server";
import { LANGUAGES } from "@/core/i18n";
import type { Language, Translate } from "@/core/i18n/types";
import { PromoOffer } from "@/features/faction-page/PromoOffer";
import { ShareRow } from "@/features/faction-page/ShareRow";
import { ViewBeacon } from "@/features/faction-page/ViewBeacon";

export const revalidate = 60;

const MAX_META_DESCRIPTION = 200;

function compactUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function priceLabel(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1) return `$${value.toFixed(3)}`;
  return `$${value.toPrecision(3)}`;
}

function percentLabel(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function shortWallet(wallet: string): string {
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

function formatDate(value: Date, language: Language): string {
  try {
    return new Intl.DateTimeFormat(language, { year: "numeric", month: "short", day: "numeric" }).format(value);
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

function buyUrlFor(faction: PublicFaction): string | null {
  if (!faction.tokenCa) return null;
  return `https://jup.ag/swap/SOL-${faction.tokenCa}`;
}

function metaDescription(faction: PublicFaction, t: Translate): string {
  const base = t("faction.meta.description", {
    name: faction.name,
    ticker: faction.symbol ? `$${faction.symbol}` : faction.name,
    members: faction.memberCount,
    level: faction.level,
  });
  return base.replace(/\s+/g, " ").trim().slice(0, MAX_META_DESCRIPTION);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const faction = await getPublicFactionCached(slug);
  if (!faction) return { title: "Faction not found", robots: { index: false, follow: false } };

  const { t } = await serverTranslator();
  const canonical = factionPageUrl(faction.slug);
  const title = faction.symbol ? `${faction.name} ($${faction.symbol})` : faction.name;
  const description = metaDescription(faction, t);

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(LANGUAGES.map((code) => [code, `${canonical}?lang=${code}`])),
        "x-default": canonical,
      },
    },
    robots: faction.indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: "TANJO World",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function FactionPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const faction = await getPublicFactionCached(slug);
  if (!faction) notFound();

  if (faction.slug !== slug) redirect(`/f/${faction.slug}`);

  const { language, t } = await serverTranslator();
  const ticker = faction.symbol ? `$${faction.symbol}` : faction.name;
  const hue = accentHue(faction.slug);
  const change = percentLabel(faction.market.change24h);
  const pageUrl = factionPageUrl(faction.slug);
  const shareText = faction.promo.code
    ? t("faction.share.textPromo", { name: faction.name, ticker })
    : t("faction.share.text", { name: faction.name, ticker });

  const xpPercent = faction.xpForNextLevel > 0
    ? Math.min(100, Math.round((faction.levelProgressAsh / faction.xpForNextLevel) * 100))
    : 0;

  return (
    <main
      className="min-h-dvh"
      style={{ ["--accent" as string]: `hsl(${hue} 88% 62%)` }}
    >
      <ViewBeacon slug={faction.slug} />

      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          {faction.image && (
            <img
              src={faction.image}
              alt=""
              className="h-full w-full object-cover scale-110 blur-2xl opacity-30"
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 60%), linear-gradient(180deg, color-mix(in srgb, var(--background) 55%, transparent), var(--background) 92%)",
            }}
          />
        </div>

        <div className="relative mx-auto w-full max-w-5xl px-4 pt-10 pb-8 sm:pt-16 sm:pb-12">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-5">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full blur-2xl opacity-60"
                style={{ background: "var(--accent)" }}
              />
              <div
                className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-full overflow-hidden border-2 bg-[var(--surface)]"
                style={{ borderColor: "color-mix(in srgb, var(--accent) 65%, transparent)" }}
              >
                {faction.image ? (
                  <img src={faction.image} alt={faction.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-text-muted">
                    {(faction.symbol || faction.name).slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
              <Chip icon={<Layers className="w-3 h-3" />} label={t("faction.hero.number", { number: faction.number })} accent />
              {faction.verified ? (
                <Chip icon={<BadgeCheck className="w-3 h-3" />} label={t("faction.hero.verified")} />
              ) : (
                <Chip icon={<ShieldAlert className="w-3 h-3" />} label={t("faction.hero.unverified")} muted />
              )}
              {faction.hasGate && <Chip icon={<ShieldCheck className="w-3 h-3" />} label={t("faction.hero.gate")} />}
              {faction.rank !== null && <Chip icon={<Crown className="w-3 h-3" />} label={t("faction.hero.rank", { rank: faction.rank })} />}
            </div>

            <h1 className="font-[family-name:var(--font-oxanium)] text-3xl sm:text-5xl font-extrabold leading-tight">
              {faction.name}
            </h1>
            {faction.symbol && (
              <p className="mt-1 font-mono text-lg sm:text-xl tracking-widest" style={{ color: "var(--accent)" }}>
                ${faction.symbol}
              </p>
            )}
            {faction.description && (
              <p className="mt-4 max-w-2xl text-sm sm:text-base text-text-secondary">{faction.description}</p>
            )}

            <div className="mt-6 w-full overflow-x-auto">
              <div className="mx-auto flex w-max min-w-full justify-center gap-2 sm:gap-3">
                <Metric label={t("faction.market.mc")} value={compactUsd(faction.market.marketCapUsd)} />
                <Metric label={t("faction.market.price")} value={priceLabel(faction.market.priceUsd)} />
                <Metric
                  label={t("faction.market.change24h")}
                  value={change ?? "—"}
                  tone={faction.market.change24h === null ? undefined : faction.market.change24h >= 0 ? "up" : "down"}
                />
                <Metric label={t("faction.market.liquidity")} value={compactUsd(faction.market.liquidityUsd)} />
                <Metric label={t("faction.stats.members")} value={String(faction.memberCount)} />
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center gap-3">
              <ShareRow url={pageUrl} shareText={shareText} />
              {faction.market.dexUrl && (
                <a
                  href={faction.market.dexUrl}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  {t("faction.hero.chart")}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl px-4 pb-16 space-y-10">
        <PromoOffer
          slug={faction.slug}
          gameId={faction.game.id}
          gameSlug={faction.game.slug}
          symbol={faction.symbol}
          buyUrl={buyUrlFor(faction)}
          code={faction.promo.code}
          seats={faction.promo.seats}
          seatsLeft={faction.promo.seatsLeft}
          minUsdCents={faction.promo.minUsdCents}
        />

        <section>
          <SectionTitle icon={<Sparkles className="w-4 h-4" />} text={t("faction.stats.title")} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={t("faction.stats.level")} value={String(faction.level)} sub={`${xpPercent}%`} progress={xpPercent} />
            <StatCard label={t("faction.stats.members")} value={String(faction.memberCount)} />
            <StatCard label={t("faction.stats.rank")} value={faction.rank !== null ? `#${faction.rank}` : "—"} />
            <StatCard label={t("faction.stats.founded")} value={formatDate(faction.createdAt, language)} />
          </div>
        </section>

        {faction.members.length > 0 && (
          <section>
            <SectionTitle icon={<Users className="w-4 h-4" />} text={t("faction.members.title")} />
            <div className="grid gap-2 sm:grid-cols-2">
              {faction.members.map((member) => (
                <div
                  key={member.wallet}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-[rgba(255,255,255,0.02)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">
                        {member.nickname || shortWallet(member.wallet)}
                      </span>
                      {member.isFounder && <Crown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />}
                      {member.isVerifiedCreator && <BadgeCheck className="w-3.5 h-3.5 shrink-0 text-[var(--success)]" />}
                    </div>
                    <p className="truncate text-xs text-text-muted">
                      {member.roleTitle || (member.role === "founder" ? t("faction.role.founder") : t("faction.role.member"))}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-text-secondary">
                    {member.contributionPoints}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {faction.activity.length > 0 && (
          <section>
            <SectionTitle icon={<Flame className="w-4 h-4" />} text={t("faction.activity.title")} />
            <ul className="divide-y divide-[var(--border)] rounded-xl border border-border bg-[rgba(255,255,255,0.02)]">
              {faction.activity.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0 truncate text-sm">
                    {t("faction.activity.row", { nickname: entry.nickname || t("faction.activity.someone") })}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-text-muted">
                    +{entry.rewardAsh} · {formatDate(entry.completedAt, language)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-[rgba(255,255,255,0.02)] p-6 sm:p-8">
          <h2 className="font-[family-name:var(--font-oxanium)] text-xl font-bold mb-2">
            {t("faction.about.title")}
          </h2>
          <p className="text-sm text-text-secondary max-w-2xl mb-5">{t("faction.about.body")}</p>
          <div className="flex flex-wrap gap-2">
            <a href={`/games/${faction.game.slug}`} className="btn-primary h-11 px-5 inline-flex items-center gap-2 text-sm rounded-lg">
              <Gamepad2 className="w-4 h-4" />
              {t("faction.about.openGame")}
            </a>
            <a href="/factions" className="btn-secondary h-11 px-5 inline-flex items-center gap-2 text-sm rounded-lg">
              {t("faction.about.allFactions")}
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-dashed border-border p-6 sm:p-8 text-center">
          <h2 className="font-[family-name:var(--font-oxanium)] text-lg sm:text-xl font-bold mb-2">
            {t("faction.cta.title")}
          </h2>
          <p className="text-sm text-text-secondary max-w-xl mx-auto mb-5">{t("faction.cta.body")}</p>
          <a href={`/games/${faction.game.slug}`} className="btn-secondary h-11 px-5 inline-flex items-center gap-2 text-sm rounded-lg">
            {t("faction.cta.action")}
          </a>
        </section>

        <p className="text-center text-[11px] leading-relaxed text-text-muted">
          {t("faction.disclaimer")}
        </p>
      </div>
    </main>
  );
}

function Chip({
  icon,
  label,
  accent = false,
  muted = false,
}: {
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
  muted?: boolean;
}) {
  const style = accent
    ? {
        borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)",
        background: "color-mix(in srgb, var(--accent) 12%, transparent)",
        color: "var(--accent)",
      }
    : muted
      ? { borderColor: "var(--border)", background: "transparent", color: "var(--text-muted)" }
      : { borderColor: "var(--border)", background: "rgba(255,255,255,0.03)" };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={style}
    >
      {icon}
      {label}
    </span>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  const color = tone === "up" ? "var(--success)" : tone === "down" ? "var(--error)" : undefined;
  return (
    <div className="min-w-[92px] rounded-xl border border-border bg-[rgba(255,255,255,0.02)] px-3 py-2.5 text-center">
      <div className="text-[10px] uppercase tracking-widest text-text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-[family-name:var(--font-oxanium)] text-lg font-bold">
      <span style={{ color: "var(--accent)" }}>{icon}</span>
      {text}
    </h2>
  );
}

function StatCard({ label, value, sub, progress }: { label: string; value: string; sub?: string; progress?: number }) {
  return (
    <div className="rounded-xl border border-border bg-[rgba(255,255,255,0.02)] p-4">
      <div className="text-[10px] uppercase tracking-widest text-text-muted">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
      {typeof progress === "number" && (
        <>
          <div className="mt-2 h-1.5 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "var(--accent)" }} />
          </div>
          {sub && <div className="mt-1 text-[11px] text-text-muted tabular-nums">{sub}</div>}
        </>
      )}
    </div>
  );
}
