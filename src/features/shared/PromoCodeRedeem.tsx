// src/features/shared/PromoCodeRedeem.tsx
"use client";

import { useState, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/core/auth/AuthProvider";
import { LoginButton } from "@/core/auth/components/LoginButton";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface PromoCodeRedeemProps {
  gameId: string;
  onSuccess?: () => void;
}

export function PromoCodeRedeem({ gameId, onSuccess }: PromoCodeRedeemProps) {
  const { t } = useLanguage();
  const { isAuthorized } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFreshCsrf = (): string | undefined => {
    if (typeof document === "undefined") return undefined;
    const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  };

  const handleRedeem = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading) return;

    setLoading(true);
    setError(null);
    try {
      const csrfToken = getFreshCsrf();
      const res = await fetch("/api/promo-code/redeem", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({ code: code.trim(), gameId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `redeem_failed_${res.status}`);
      }

      setCode("");
      onSuccess?.();
    } catch (err: any) {
      if (err.message === "invalid_code") {
        setError(t("promoCode.invalidCode") || "Invalid or unknown promo code.");
      } else if (err.message === "insufficient_token_balance") {
        setError(t("promoCode.insufficientBalance") || "You don't hold this faction's token.");
      } else if (err.message === "balance_check_failed") {
        setError(t("promoCode.balanceCheckFailed") || "Couldn't verify your token balance, try again.");
      } else if (err.message === "too_many_attempts") {
        setError(t("errors.tooManyAttempts") || "Too many attempts, try again later.");
      } else {
        setError(err.message || t("promoCode.redeemFailed") || "Failed to redeem code.");
      }
    } finally {
      setLoading(false);
    }
  }, [code, gameId, loading, onSuccess, t]);

  if (!isAuthorized) {
    return (
      <div className="space-y-2">
        <LoginButton className="w-full" />
        <p className="text-xs text-text-secondary text-center">
          {t("promoCode.loginHint") || "Log in to redeem a promo code"}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleRedeem} className="space-y-2">
      <div className="h-11 flex items-center gap-2 pl-3 pr-1.5 rounded-lg border border-border bg-[rgba(255,255,255,0.03)] focus-within:border-primary/50 transition-colors">
        <Sparkles className="w-4 h-4 text-primary shrink-0" />
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={20}
          placeholder={t("promoCode.placeholder") || "Have a promo code?"}
          className="min-w-0 flex-1 h-full bg-transparent text-sm outline-none placeholder:text-text-muted"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="btn-secondary h-8 px-3.5 py-0 inline-flex items-center justify-center text-xs shrink-0 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <span className="animate-spin inline-block">⟳</span> : (t("promoCode.redeem") || "Redeem")}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
