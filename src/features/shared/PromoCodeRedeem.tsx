// src/features/shared/PromoCodeRedeem.tsx
"use client";

import { useState, useCallback } from "react";
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
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={20}
          placeholder={t("promoCode.placeholder") || "Have a promo code?"}
          className="flex-1 bg-[rgba(255,255,255,0.04)] px-3 py-2 rounded-lg text-sm border border-border outline-none focus:border-primary/50"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !code.trim()} className="btn-secondary px-4 py-2 text-sm disabled:opacity-50">
          {loading ? "..." : (t("promoCode.redeem") || "Redeem")}
        </button>
      </div>
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
    </form>
  );
}
