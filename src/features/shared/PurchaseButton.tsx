// src/features/shared/PurchaseButton.tsx
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useCallback, useRef, useMemo } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
} from "@solana/spl-token";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { useAuth } from "@/core/auth/AuthProvider";
import { LoginButton } from "@/core/auth/components/LoginButton";
import { buildSignInMessage } from "@/core/auth/lib/signMessage";
import { createRpcConnection, confirmSignature, readTokenAccountBalance } from "@/core/lib/solanaClient";
import { sessionFetch } from "@/core/api/session";
import { fetchPayableTnj } from "@/features/game/utils/shopQuote";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

interface PurchaseButtonProps {
  gameId?: string;
  lotId?: string;
  factionId?: string;
  quoteItemId?: string;
  price: number;
  isLot?: boolean;
  onSuccess?: (result: { id: string; type: "game" | "item" | "faction_upgrade"; promoCode?: string }) => void;
}

type LoadingState = boolean | "connecting" | "signing" | "confirming" | "verifying";

export function PurchaseButton({ gameId, lotId, factionId, quoteItemId, price, isLot = false, onSuccess }: PurchaseButtonProps) {
  const { t } = useLanguage();
  const { publicKey, connected, wallet } = useWallet();
  const { login, refreshAuth, isAuthorized, walletMismatch } = useAuth();
  const [loading, setLoading] = useState<LoadingState>(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);

  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const handlePurchase = useCallback(async (e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }

    if (!publicKey || !connected || !wallet?.adapter) {
      setError(t("errors.connectWallet") || "Please connect your wallet first");
      return;
    }

    if (isProcessingRef.current) {
      return;
    }

    const walletAddress = publicKey.toBase58();
    const walletAdapter = wallet.adapter;
    const walletName = walletAdapter.name;

    const { gameId, lotId, factionId, quoteItemId, price, onSuccess } = purchaseConfig;

    if (!gameId && !lotId && !factionId) {
      setError(t("errors.missingGameOrLotId"));
      return;
    }
    if (price <= 0) {
      setError(t("errors.invalidPrice"));
      return;
    }

    if (typeof (walletAdapter as any).signMessage !== "function") {
      setError(t("errors.walletNotSupported") || "This wallet doesn't support message signing");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    isProcessingRef.current = true;
    setError(null);

    let signature: string | null = pendingSignature;

    try {
      setLoading("connecting");

      if (!isAuthorized || walletMismatch) {
        setLoading("signing");

        const challengeRes = await fetch(
          `/api/auth/challenge?wallet=${encodeURIComponent(walletAddress)}`,
          {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!challengeRes.ok) {
          const err = await challengeRes.json().catch(() => ({}));
          throw new Error(err.error || `Challenge failed: ${challengeRes.status}`);
        }

        const { nonce, domain, csrfToken } = await challengeRes.json();
        const authMessage = buildSignInMessage({ domain, wallet: walletAddress, nonce, platform: "web" });
        const authMessageBytes = new TextEncoder().encode(authMessage);

        const signMessageFn = (walletAdapter as any).signMessage;
        let authSignatureBase64: string;

        try {
          const signed = await signMessageFn.call(walletAdapter, authMessageBytes);
          const signatureBytes = signed.signature || signed;
          authSignatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
        } catch (signError: any) {
          if (signError.code === 4001 || signError.message?.includes("rejected")) {
            throw new Error("User rejected signature");
          }
          throw signError;
        }

        if (abortController.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const authVerifyRes = await fetch("/api/auth/verify", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({
            wallet: walletAddress,
            message: authMessage,
            signature: authSignatureBase64,
            nonce,
          }),
        });

        if (!authVerifyRes.ok) {
          const err = await authVerifyRes.json().catch(() => ({}));
          throw new Error(err.error || `Auth verification failed: ${authVerifyRes.status}`);
        }

        login(walletAddress, walletName);
        await refreshAuth();
      }

      if (signature) {
        setLoading("verifying");
        const retried = await submitVerification(signature, abortController.signal);
        setPendingSignature(null);
        onSuccess?.(retried);
        return;
      }

      setLoading("confirming");

      let amountTnj = price;

      if (quoteItemId) {
        amountTnj = await fetchPayableTnj(quoteItemId);
      } else if (!factionId) {
        const quoteParams = gameId ? `gameId=${encodeURIComponent(gameId)}` : `lotId=${encodeURIComponent(lotId!)}`;
        const quoteRes = await sessionFetch(`/api/purchase/quote?${quoteParams}`, { signal: abortController.signal });

        if (!quoteRes.ok) {
          const err = await quoteRes.json().catch(() => ({}));
          throw new Error(err.error || `Quote failed: ${quoteRes.status}`);
        }

        const quote = await quoteRes.json();

        if (typeof quote.price !== "number") {
          throw new Error("price_unavailable");
        }
        // A game priced in USDT is converted to TNJ on every quote, so it will
        // almost never match the number rendered from the cached listing. Only a
        // fixed price is worth guarding against tampering this way.
        if (quote.dynamic !== true && quote.price !== price) {
          throw new Error(
            `${t("errors.priceChanged") || "The price changed, reload the page"}: ${quote.price.toLocaleString("en-US")} TNJ`
          );
        }

        amountTnj = quote.price;
      }

      const configRes = await fetch("/api/marketplace/config", { signal: abortController.signal });
      if (!configRes.ok) throw new Error("Failed to load config");
      const config = await configRes.json();

      const connection = createRpcConnection();
      const mintPubkey = new PublicKey(config.tokenMint);
      const treasuryPubkey = new PublicKey(config.treasuryWallet);

      const decimals = parseInt(config.decimals || "6");
      const userPubkey = new PublicKey(walletAddress);
      const tokenProgramId = TOKEN_2022_PROGRAM_ID;

      const userATA = await getAssociatedTokenAddress(mintPubkey, userPubkey, false, tokenProgramId);
      const treasuryATA = await getAssociatedTokenAddress(mintPubkey, treasuryPubkey, true, tokenProgramId);

      const balance = await readTokenAccountBalance(connection, userATA);

      const amountToSend = BigInt(amountTnj) * BigInt(10 ** decimals);

      if (balance < amountToSend) {
        throw new Error(`Insufficient balance. You have ${Number(balance) / Math.pow(10, decimals)} TNJ, need ${amountTnj} TNJ`);
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

      const transferInstruction = createTransferInstruction(
        userATA,
        treasuryATA,
        userPubkey,
        amountToSend,
        [],
        tokenProgramId
      );

      const tx = new Transaction({
        feePayer: userPubkey,
        recentBlockhash: blockhash,
      }).add(transferInstruction);

      if (typeof (walletAdapter as any).signTransaction !== "function") {
        throw new Error("This wallet doesn't support transaction signing");
      }

      let signedTx: Transaction;
      try {
        signedTx = await (walletAdapter as any).signTransaction(tx);
      } catch (signError: any) {
        if (signError.code === 4001 || signError.message?.includes("rejected")) {
          throw new Error("User rejected transaction");
        }
        throw signError;
      }

      if (abortController.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      setPendingSignature(signature);

      try {
        await confirmSignature(connection, signature, lastValidBlockHeight);
      } catch (confirmErr: any) {
        console.warn("[TANJO] Transaction confirmation failed, relying on backend verification:", confirmErr.message);
      }

      if (abortController.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      setLoading("verifying");

      const data = await submitVerification(signature, abortController.signal);
      setPendingSignature(null);
      onSuccess?.(data);

    } catch (err: any) {
      console.error("[TANJO Purchase Error]", err);

      if (err.name === "AbortError" || err.message === "Aborted") {
        return;
      }

      if (err.message?.includes("User rejected") || err.code === 4001) {
        setError(t("errors.userRejected"));
      } else if (signature) {
        setError(
          `${err.message || t("errors.transactionFailed")} — ${t("errors.verificationPending") || "payment sent, retry verification"}`
        );
      } else {
        setError(err.message || t("errors.transactionFailed"));
      }
    } finally {
      isProcessingRef.current = false;
      setLoading(false);
    }
  }, [
    publicKey,
    connected,
    wallet,
    purchaseConfig,
    t,
    login,
    refreshAuth,
    isAuthorized,
    walletMismatch,
    pendingSignature,
    submitVerification,
  ]);

  if (!publicKey || !connected) {
    return (
      <div className="space-y-2">
        <LoginButton className="w-full" />
        <p className="text-xs text-text-secondary text-center">
          {t("purchase.connectWalletHint") || "Connect your wallet to purchase"}
        </p>
      </div>
    );
  }

  const getButtonText = () => {
    if (loading === "connecting") {
      return (
        <span className="flex items-center gap-2">
          <span className="animate-spin">⟳</span>
          {t("purchase.authorizing") || "Authorizing..."}
        </span>
      );
    }
    if (loading === "signing") {
      return (
        <span className="flex items-center gap-2">
          <span className="animate-pulse">✍️</span>
          {t("purchase.signingAuth") || "Sign to authorize..."}
        </span>
      );
    }
    if (loading === "confirming") {
      return (
        <span className="flex items-center gap-2">
          <span className="animate-pulse">⛓️</span>
          {t("purchase.confirming") || "Confirming..."}
        </span>
      );
    }
    if (loading === "verifying") {
      return (
        <span className="flex items-center gap-2">
          <span className="animate-pulse">🧾</span>
          {t("purchase.verifying") || "Verifying payment..."}
        </span>
      );
    }
    if (pendingSignature) {
      return t("purchase.retryVerification") || "Retry verification";
    }

    return `${t("actions.buy")} ${price.toLocaleString("en-US")} TNJ`;
  };

  const isDisabled = !!loading;

  return (
    <div className="space-y-2">
      <button
        onClick={handlePurchase}
        disabled={isDisabled}
        className="btn-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        style={{ pointerEvents: loading ? 'none' : 'auto' }}
      >
        {getButtonText()}
      </button>
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      {pendingSignature && !loading && (
        <p className="text-xs text-text-secondary break-all">
          {t("purchase.savedSignature") || "Payment signature"}: {pendingSignature}
        </p>
      )}
    </div>
  );
}
