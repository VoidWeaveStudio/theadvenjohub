// src/features/faction-page/PromoOffer.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowRight, BarChart3, Check, Copy, Crown, Gamepad2, Loader2, ShoppingCart, Ticket } from "lucide-react";
import { useAuth } from "@/core/auth/AuthProvider";
import { LoginButton } from "@/core/auth/components/LoginButton";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface Eligibility {
  hasLicense: boolean;
  isMember: boolean;
  holding: { balance: number; valueUsdCents: number; minTokens: number } | null;
  holdingError: string | null;
  meetsHold: boolean;
  minUsdCents: number;
  seatsLeft: number;
  seats: number;
  canManage: boolean;
}

interface PromoOfferProps {
  slug: string;
  gameId: string;
  gameSlug: string;
  symbol: string | null;
  buyUrl: string | null;
  code: string | null;
  seats: number;
  seatsLeft: number;
  minUsdCents: number;
}

function formatUsd(cents: number): string {
  const value = cents / 100;
  return value >= 1 ? `$${value.toFixed(value % 1 === 0 ? 0 : 2)}` : `$${value.toFixed(2)}`;
}

function formatAmount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return value.toFixed(2);
  return value.toPrecision(3);
}

function readCsrf(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function PromoOffer(props: PromoOfferProps) {
  const { slug, gameId, gameSlug, symbol, buyUrl, code, seats, seatsLeft, minUsdCents } = props;
  const { t } = useLanguage();
  const { isAuthorized } = useAuth();

  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [checking, setChecking] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const ticker = symbol ? `$${symbol}` : t("faction.offer.theToken");
  const liveSeatsLeft = eligibility?.seatsLeft ?? seatsLeft;
  const seatsTaken = Math.min(Math.max(seats - liveSeatsLeft, 0), seats);
  const seatPercent = seats > 0 ? Math.round((seatsTaken / seats) * 100) : 100;

  const loadEligibility = useCallback(async () => {
    if (!isAuthorized) return;
    setChecking(true);
    try {
      const res = await fetch(`/api/faction/${encodeURIComponent(slug)}/eligibility`, { credentials: "include" });
      if (res.ok) setEligibility(await res.json());
    } catch {
    } finally {
      setChecking(false);
    }
  }, [isAuthorized, slug]);

  useEffect(() => {
    loadEligibility();
  }, [loadEligibility]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyCode = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [code]);

  const redeem = useCallback(async () => {
    if (!code || redeeming) return;
    setRedeeming(true);
    setError(null);
    try {
      const csrf = readCsrf();
      const res = await fetch("/api/promo-code/redeem", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}) },
        body: JSON.stringify({ code, gameId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `redeem_failed_${res.status}`);
      setDone(true);
      await loadEligibility();
    } catch (err: any) {
      const key = String(err?.message ?? "");
      const known: Record<string, string> = {
        insufficient_token_balance: t("faction.offer.errorHold", { ticker }),
        balance_check_failed: t("faction.offer.errorBalance"),
        price_unavailable: t("faction.offer.errorPrice"),
        no_seats_left: t("faction.offer.errorNoSeats"),
        invalid_code: t("faction.offer.errorCode"),
        too_many_attempts: t("errors.tooManyAttempts"),
      };
      setError(known[key] ?? t("faction.offer.errorGeneric"));
    } finally {
      setRedeeming(false);
    }
  }, [code, gameId, loadEligibility, redeeming, t, ticker]);

  const ownerStrip = eligibility?.canManage ? (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-dashed border-border px-4 py-2.5 text-xs">
      <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: "var(--accent)" }}>
        <Crown className="w-3.5 h-3.5" />
        {t("faction.owner.badge")}
      </span>
      {code ? (
        <span className="text-text-secondary tabular-nums">
          {t("faction.owner.seats", { left: liveSeatsLeft, total: eligibility.seats })}
        </span>
      ) : (
        <span className="text-text-muted">{t("faction.owner.noCodeHint")}</span>
      )}
      <a
        href={`/f/${encodeURIComponent(slug)}/dashboard`}
        className="ml-auto inline-flex items-center gap-1 font-semibold underline decoration-dotted underline-offset-2 hover:no-underline"
        style={{ color: "var(--accent)" }}
      >
        <BarChart3 className="w-3.5 h-3.5" />
        {t("faction.owner.dashboard")}
      </a>
    </div>
  ) : null;

  if (!code) {
    return (
      <div>
        {ownerStrip}
        <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.02)] p-6 sm:p-8">
          <h2 className="font-[family-name:var(--font-oxanium)] text-xl font-bold mb-2">
            {t("faction.offer.noCodeTitle")}
          </h2>
          <p className="text-sm text-text-secondary mb-5">{t("faction.offer.noCodeBody")}</p>
          <a href={`/games/${gameSlug}`} className="btn-primary h-11 px-5 inline-flex items-center gap-2 text-sm rounded-lg">
            <Gamepad2 className="w-4 h-4" />
            {t("faction.offer.openGame")}
          </a>
        </div>
      </div>
    );
  }

  const soldOut = liveSeatsLeft <= 0 && !eligibility?.hasLicense;

  return (
    <div>
      {ownerStrip}
      <div
      className="relative overflow-hidden rounded-2xl border p-6 sm:p-8"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)",
        background:
          "linear-gradient(160deg, color-mix(in srgb, var(--accent) 12%, transparent), rgba(255,255,255,0.02) 55%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full blur-3xl opacity-40"
        style={{ background: "var(--accent)" }}
      />

      <div className="relative">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--accent)" }}>
          <Ticket className="w-3.5 h-3.5" />
          {t("faction.offer.badge")}
        </div>

        <h2 className="font-[family-name:var(--font-oxanium)] text-2xl sm:text-3xl font-bold leading-tight">
          {t("faction.offer.title", { ticker })}
        </h2>
        <p className="mt-2 text-sm text-text-secondary max-w-xl">
          {t("faction.offer.subtitle", { ticker, amount: formatUsd(minUsdCents) })}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-text-muted mb-1.5">
              {t("faction.offer.codeLabel")}
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="group w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-[rgba(0,0,0,0.25)] px-4 py-3 text-left transition-colors hover:border-[color-mix(in_srgb,var(--accent)_50%,transparent)]"
            >
              <span className="font-mono text-xl sm:text-2xl font-bold tracking-[0.25em]">{code}</span>
              {copied ? (
                <Check className="w-4 h-4 shrink-0 text-[var(--success)]" />
              ) : (
                <Copy className="w-4 h-4 shrink-0 text-text-muted group-hover:text-text-primary transition-colors" />
              )}
            </button>
          </div>

          <div className="sm:w-52">
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="text-[11px] uppercase tracking-widest text-text-muted">
                {t("faction.offer.seatsLabel")}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {liveSeatsLeft} / {seats}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${seatPercent}%`, background: "var(--accent)" }}
              />
            </div>
          </div>
        </div>

        <div className="mt-6">
          {done ? (
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] p-4">
              <p className="text-sm font-semibold mb-3">{t("faction.offer.successTitle")}</p>
              <a href={`/games/${gameSlug}`} className="btn-primary h-11 px-5 inline-flex items-center gap-2 text-sm rounded-lg">
                <Gamepad2 className="w-4 h-4" />
                {t("faction.offer.playNow")}
              </a>
            </div>
          ) : !isAuthorized ? (
            <div className="space-y-3">
              <ol className="grid gap-2 sm:grid-cols-3 text-sm">
                <Step index={1} text={t("faction.offer.step1", { ticker })} />
                <Step index={2} text={t("faction.offer.step2")} />
                <Step index={3} text={t("faction.offer.step3")} />
              </ol>
              <div className="flex flex-wrap gap-2">
                {buyUrl && (
                  <a
                    href={buyUrl}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="btn-secondary h-11 px-5 inline-flex items-center gap-2 text-sm rounded-lg"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {t("faction.offer.buyToken", { ticker })}
                  </a>
                )}
                <LoginButton />
              </div>
            </div>
          ) : checking && !eligibility ? (
            <p className="inline-flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("faction.offer.checking")}
            </p>
          ) : eligibility?.isMember && eligibility.hasLicense ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">{t("faction.offer.alreadyMember")}</p>
              <a href={`/games/${gameSlug}`} className="btn-primary h-11 px-5 inline-flex items-center gap-2 text-sm rounded-lg">
                <Gamepad2 className="w-4 h-4" />
                {t("faction.offer.playNow")}
              </a>
            </div>
          ) : soldOut ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">{t("faction.offer.soldOut")}</p>
              <a href={`/games/${gameSlug}`} className="btn-secondary h-11 px-5 inline-flex items-center gap-2 text-sm rounded-lg">
                {t("faction.offer.buyGame")}
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          ) : eligibility && !eligibility.meetsHold ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                {eligibility.holdingError
                  ? t("faction.offer.errorBalance")
                  : t("faction.offer.needMore", {
                      ticker,
                      have: formatUsd(eligibility.holding?.valueUsdCents ?? 0),
                      need: formatUsd(eligibility.minUsdCents),
                    })}
              </p>
              {eligibility.holding && eligibility.holding.minTokens > 0 && (
                <p className="text-xs text-text-muted">
                  {t("faction.offer.needTokens", {
                    amount: formatAmount(eligibility.holding.minTokens),
                    ticker,
                  })}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {buyUrl && (
                  <a
                    href={buyUrl}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="btn-primary h-11 px-5 inline-flex items-center gap-2 text-sm rounded-lg"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {t("faction.offer.buyToken", { ticker })}
                  </a>
                )}
                <button type="button" onClick={loadEligibility} className="btn-secondary h-11 px-5 text-sm rounded-lg">
                  {t("faction.offer.recheck")}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={redeem}
                disabled={redeeming}
                className="btn-primary h-12 px-6 inline-flex items-center gap-2 text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
                {eligibility?.hasLicense ? t("faction.offer.joinFaction") : t("faction.offer.claim")}
              </button>
              <p className="text-xs text-text-muted">{t("faction.offer.claimHint", { ticker })}</p>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 inline-flex items-start gap-2 text-xs text-[var(--error)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] border border-[color-mix(in_srgb,var(--error)_25%,transparent)] rounded-lg px-3 py-2" role="alert">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {error}
          </p>
        )}
        </div>
      </div>
    </div>
  );
}

function Step({ index, text }: { index: number; text: string }) {
  return (
    <li className="flex items-start gap-2 rounded-lg border border-border bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
        style={{ background: "color-mix(in srgb, var(--accent) 25%, transparent)", color: "var(--accent)" }}
      >
        {index}
      </span>
      <span className="text-text-secondary leading-snug">{text}</span>
    </li>
  );
}
