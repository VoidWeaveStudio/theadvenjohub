// app/factions/page.tsx
import type { Metadata } from "next";
import { BadgeCheck, Ticket } from "lucide-react";
import { accentHue, listPublicFactions } from "@/core/lib/factionPublic";
import { absoluteUrl, SITE_URL } from "@/core/lib/siteUrl";
import { serverTranslator } from "@/core/i18n/server";
import { LANGUAGES } from "@/core/i18n";

export const revalidate = 120;

function compactUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
} 

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverTranslator();
  const canonical = absoluteUrl("/factions");

  return {
    metadataBase: new URL(SITE_URL),
    title: t("factions.meta.title"),
    description: t("factions.meta.description"),
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(LANGUAGES.map((code) => [code, `${canonical}?lang=${code}`])),
        "x-default": canonical,
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
      title: t("factions.meta.title"),
      description: t("factions.meta.description"),
      siteName: "TANJO World",
    },
  };
}

export default async function FactionsIndexPage() {
  const { t } = await serverTranslator();

  let factions: Awaited<ReturnType<typeof listPublicFactions>> = [];
  try {
    factions = await listPublicFactions();
  } catch (error) {
    console.error("[factions] listing failed:", error);
  }

  return (
    <main className="min-h-dvh">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
        <h1 className="font-[family-name:var(--font-oxanium)] text-3xl sm:text-4xl font-extrabold">
          {t("factions.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">{t("factions.subtitle")}</p>

        {factions.length === 0 ? (
          <p className="mt-10 text-sm text-text-muted">{t("factions.empty")}</p>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {factions.map((faction) => {
              const hue = accentHue(faction.slug);
              return (
                <a
                  key={faction.slug}
                  href={`/f/${faction.slug}`}
                  className="clickable-card flex items-center gap-4 rounded-xl border border-border p-4"
                  style={{ ["--accent" as string]: `hsl(${hue} 88% 62%)` }}
                >
                  <div
                    className="h-12 w-12 shrink-0 overflow-hidden rounded-full border bg-[var(--surface)]"
                    style={{ borderColor: "color-mix(in srgb, var(--accent) 60%, transparent)" }}
                  >
                    {faction.image ? (
                      <img src={faction.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-text-muted">
                        {(faction.symbol || faction.name).slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{faction.name}</span>
                      {faction.verified && <BadgeCheck className="w-3.5 h-3.5 shrink-0 text-[var(--success)]" />}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
                      {faction.symbol && <span className="font-mono">${faction.symbol}</span>}
                      <span>{t("factions.row.level", { level: faction.level })}</span>
                      <span>{t("factions.row.members", { count: faction.memberCount })}</span>
                      <span>{compactUsd(faction.marketCap)}</span>
                    </div>
                  </div>

                  {faction.hasPromo && faction.seatsLeft > 0 && (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{
                        background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                        color: "var(--accent)",
                      }}
                    >
                      <Ticket className="w-3 h-3" />
                      {faction.seatsLeft}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
