// src/features/shared/PurchaseButton.tsx
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { useAuth } from "@/core/auth/AuthProvider";
import { LoginButton } from "@/core/auth/components/LoginButton";
import { PayTnjError, payTnj, type PayStage } from "@/core/blockchain/payTnj";
import { clearPendingPayment, readPendingPayment, savePendingPayment } from "@/core/blockchain/pendingPayment";
import { sessionFetch } from "@/core/api/session";
import { fetchPayableTnj } from "@/features/game/utils/shopQuote";

interface PurchaseButtonProps {
  gameId?: string;
  lotId?: string;
  factionId?: string;
  quoteItemId?: string;
  price: number;
  isLot?: boolean;
  onSuccess?: (result: { id: string; type: "game" | "item" | "faction_upgrade"; promoCode?: string }) => void;
}

type LoadingState = false | "preparing" | "signing" | "confirming" | "verifying";

export function PurchaseButton({ gameId, lotId, factionId, quoteItemId, price, isLot = false, onSuccess }: PurchaseButtonProps) {
  const { t } = useLanguage();
  const { publicKey, connected, wallet } = useWallet();
  const { isAuthorized, walletMismatch } = useAuth();
  const [loading, setLoading] = useState<LoadingState>(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);

  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const resumedRef = useRef(false);

  const paymentKey = useMemo(() => {
    if (factionId) return `faction:${factionId}`;
    if (gameId) return `game:${gameId}`;
    if (lotId) return `lot:${lotId}`;
    return "";
  }, [factionId, gameId, lotId]);

  const purchaseConfig = useMemo(() => ({
    gameId, lotId, factionId, quoteItemId, price, isLot, onSuccess
  }), [gameId, lotId, factionId, quoteItemId, price, isLot, onSuccess]);

  const submitVerification = useCallback(async (signature: string, signal: AbortSignal) => {
    const endpoint = factionId ? "/api/faction/upgrades/promo-code/purchase" : "/api/purchase/verify";
    const body = factionId ? { signature, factionId } : { signature, gameId, lotId };

    const verifyRes = await sessionFetch(endpoint, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!verifyRes.ok) {
      const errData = await verifyRes.json().catch(() => ({}));
      throw new Error(errData.error || `Verification failed: ${verifyRes.status}`);
    }

    return verifyRes.json();
  }, [factionId, gameId, lotId]);

  const describeError = useCallback((err: unknown): string => {
    if (err instanceof PayTnjError) {
      switch (err.code) {
        case "user_rejected":
          return t("errors.userRejected");
        case "no_token_account":
          return t("purchase.err.noTokenAccount");
        case "insufficient_balance":
          return t("purchase.err.insufficient", {
            balance: (err.balanceTnj ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 }),
            required: (err.requiredTnj ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 }),
          });
        case "wallet_not_connected":
          return t("errors.connectWallet");
        case "invalid_amount":
          return t("errors.invalidPrice");
        case "config_failed":
        case "send_failed":
        default:
          return t("purchase.err.sendFailed");
      }
    }

    const message = (err as Error)?.message;
    if (message?.includes("User rejected")) return t("errors.userRejected");
    return message || t("errors.transactionFailed");
  }, [t]);

  const finishPurchase = useCallback(async (signature: string, signal: AbortSignal) => {
    setLoading("verifying");
    const data = await submitVerification(signature, signal);

    if (paymentKey) clearPendingPayment(paymentKey);
    setPendingSignature(null);
    purchaseConfig.onSuccess?.(data);
  }, [paymentKey, purchaseConfig, submitVerification]);

  useEffect(() => {
    if (!paymentKey || resumedRef.current || !isAuthorized || walletMismatch) return;

    const stored = readPendingPayment(paymentKey);
    if (!stored) return;

    resumedRef.current = true;
    setPendingSignature(stored.signature);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    isProcessingRef.current = true;

    finishPurchase(stored.signature, abortController.signal)
      .catch((err: any) => {
        if (err?.name === "AbortError") return;
        setError(`${describeError(err)} — ${t("errors.verificationPending")}`);
      })
      .finally(() => {
        isProcessingRef.current = false;
        setLoading(false);
      });
  }, [paymentKey, isAuthorized, walletMismatch, finishPurchase, describeError, t]);

  const resolveAmount = useCallback(async (signal: AbortSignal): Promise<number> => {
    const { gameId, lotId, factionId, quoteItemId, price } = purchaseConfig;

    if (quoteItemId) return fetchPayableTnj(quoteItemId);
    if (factionId) return price;

    const quoteParams = gameId ? `gameId=${encodeURIComponent(gameId)}` : `lotId=${encodeURIComponent(lotId!)}`;
    const quoteRes = await sessionFetch(`/api/purchase/quote?${quoteParams}`, { signal });

    if (!quoteRes.ok) {
      const err = await quoteRes.json().catch(() => ({}));
      throw new Error(err.error || `Quote failed: ${quoteRes.status}`);
    }

    const quote = await quoteRes.json();
    if (typeof quote.price !== "number") throw new Error("price_unavailable");

    if (quote.dynamic !== true && quote.price !== price) {
      throw new Error(
        `${t("errors.priceChanged")}: ${quote.price.toLocaleString("en-US")} TNJ`
      );
    }

    return quote.price;
  }, [purchaseConfig, t]);

  const handlePurchase = useCallback(async (e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (isProcessingRef.current) return;

    const { gameId, lotId, factionId, price } = purchaseConfig;

    if (!gameId && !lotId && !factionId) {
      setError(t("errors.missingGameOrLotId"));
      return;
    }
    if (price <= 0) {
      setError(t("errors.invalidPrice"));
      return;
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    isProcessingRef.current = true;
    setError(null);

    try {
      if (pendingSignature) {
        await finishPurchase(pendingSignature, abortController.signal);
        return;
      }

      setLoading("preparing");
      const amountTnj = await resolveAmount(abortController.signal);

      const signature = await payTnj({
        adapter: wallet?.adapter,
        payer: publicKey,
        amountTnj,
        signal: abortController.signal,
        onStage: (stage: PayStage) => setLoading(stage === "preparing" ? "preparing" : stage),
      });

      if (paymentKey) savePendingPayment({ key: paymentKey, signature, amountTnj });
      setPendingSignature(signature);

      if (abortController.signal.aborted) return;

      await finishPurchase(signature, abortController.signal);
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.message === "Aborted") return;

      const described = describeError(err);
      setError(
        pendingSignature || readPendingPayment(paymentKey)
          ? `${described} — ${t("errors.verificationPending")}`
          : described
      );
    } finally {
      isProcessingRef.current = false;
      setLoading(false);
    }
  }, [
    purchaseConfig,
    paymentKey,
    pendingSignature,
    publicKey,
    wallet,
    t,
    resolveAmount,
    finishPurchase,
    describeError,
  ]);

  if (!publicKey || !connected || !isAuthorized || walletMismatch) {
    return (
      <div className="space-y-2">
        <LoginButton className="w-full" />
        <p className="text-xs text-text-secondary text-center">
          {t("purchase.connectWalletHint")}
        </p>
      </div>
    );
  }

  const getButtonText = () => {
    if (loading === "preparing") {
      return (
        <span className="flex items-center gap-2">
          <span className="animate-spin">⟳</span>
          {t("purchase.preparing")}
        </span>
      );
    }
    if (loading === "signing") {
      return (
        <span className="flex items-center gap-2">
          <span className="animate-pulse">✍️</span>
          {t("purchase.signingTx")}
        </span>
      );
    }
    if (loading === "confirming") {
      return (
        <span className="flex items-center gap-2">
          <span className="animate-pulse">⛓️</span>
          {t("purchase.confirming")}
        </span>
      );
    }
    if (loading === "verifying") {
      return (
        <span className="flex items-center gap-2">
          <span className="animate-pulse">🧾</span>
          {t("purchase.verifying")}
        </span>
      );
    }
    if (pendingSignature) {
      return t("purchase.retryVerification");
    }

    return `${t("actions.buy")} ${price.toLocaleString("en-US")} TNJ`;
  };

  const isDisabled = loading !== false;

  return (
    <div className="space-y-2">
      <button
        onClick={handlePurchase}
        disabled={isDisabled}
        className="btn-primary px-6 py-2 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        style={{ pointerEvents: loading ? 'none' : 'auto' }}
      >
        {getButtonText()}
      </button>
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      {pendingSignature && !loading && (
        <p className="text-xs text-text-secondary break-all">
          {t("purchase.savedSignature")}: {pendingSignature}
        </p>
      )}
    </div>
  );
}
