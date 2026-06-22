// src/features/shared/PurchaseButton.tsx
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useCallback, useRef, useMemo } from "react";
import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
} from "@solana/spl-token";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { useAuth } from "@/core/auth/AuthProvider";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

let globalPurchaseLock = false;
let activeRequestId: string | null = null;
let lastPurchaseTime = 0;
const PURCHASE_COOLDOWN_MS = 5000;

interface PurchaseButtonProps {
  gameId?: string;
  lotId?: string;
  price: number;
  isLot?: boolean;
  onSuccess?: (result: { id: string; type: "game" | "item" }) => void;
}

type LoadingState = boolean | "connecting" | "signing" | "confirming";

export function PurchaseButton({ gameId, lotId, price, isLot = false, onSuccess }: PurchaseButtonProps) {
  const { t } = useLanguage();
  const { publicKey } = useWallet();
  const { login, refreshAuth, userWallet, isAuthorized } = useAuth();
  const [loading, setLoading] = useState<LoadingState>(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const purchaseConfig = useMemo(() => ({
    gameId, lotId, price, isLot, onSuccess
  }), [gameId, lotId, price, isLot, onSuccess]);

  const getFreshCsrf = (): string | undefined => {
    if (typeof document === "undefined") return undefined;
    const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  };

  const handlePurchase = useCallback(async (e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }

    if (!publicKey && !userWallet) {
      setError(t("errors.connectWallet") || "Please connect your wallet first");
      return;
    }

    const walletAddress = publicKey?.toBase58() || userWallet;

    if (!walletAddress) {
      setError(t("errors.connectWallet") || "Wallet address not available");
      return;
    }

    const currentRequestId = requestIdRef.current;
    const now = Date.now();

    if (globalPurchaseLock || activeRequestId !== null || (now - lastPurchaseTime < PURCHASE_COOLDOWN_MS)) {
      return;
    }

    if (isProcessingRef.current) {
      return;
    }

    const { gameId, lotId, price, onSuccess } = purchaseConfig;

    if (!gameId && !lotId) {
      setError(t("errors.missingGameOrLotId"));
      return;
    }
    if (price <= 0) {
      setError(t("errors.invalidPrice"));
      return;
    }

    const phantom = (window as any).phantom?.solana;
    if (!phantom) {
      setError(t("errors.phantomNotFound"));
      return;
    }

    globalPurchaseLock = true;
    activeRequestId = currentRequestId;
    lastPurchaseTime = now;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    isProcessingRef.current = true;
    setLoading("connecting");
    setError(null);

    let signature: string | null = null;

    try {
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

      const { nonce, csrfToken } = await challengeRes.json();
      const authMessage = `Sign in to TANJO Game Store\nWallet: ${walletAddress}\nNonce: ${nonce}`;
      const authMessageBytes = new TextEncoder().encode(authMessage);

      const authSigned = await phantom.signMessage(authMessageBytes, "utf8");
      const authSignatureBase64 = btoa(String.fromCharCode(...authSigned.signature));

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

      login(walletAddress, "Phantom");
      await refreshAuth();

      setLoading("confirming");

      const configRes = await fetch("/api/marketplace/config", { signal: abortController.signal });
      if (!configRes.ok) throw new Error("Failed to load config");
      const config = await configRes.json();

      const connection = new Connection(config.publicRpc, "confirmed");
      const mintPubkey = new PublicKey(config.tokenMint);
      const treasuryPubkey = new PublicKey(config.treasuryWallet);

      const decimals = parseInt(config.decimals || "6");
      const userPubkey = new PublicKey(walletAddress);
      const tokenProgramId = TOKEN_2022_PROGRAM_ID;

      const userATA = await getAssociatedTokenAddress(mintPubkey, userPubkey, false, tokenProgramId);
      const treasuryATA = await getAssociatedTokenAddress(mintPubkey, treasuryPubkey, true, tokenProgramId);

      const [userAccountInfo, treasuryAccountInfo] = await Promise.all([
        connection.getAccountInfo(userATA, "confirmed"),
        connection.getAccountInfo(treasuryATA, "confirmed"),
      ]);

      if (!userAccountInfo) throw new Error("Your token account not found. Make sure you have TNJ tokens.");
      if (!treasuryAccountInfo) throw new Error("Treasury account not found.");

      const accountData = userAccountInfo.data;
      const balance = BigInt(accountData[64]) |
        BigInt(accountData[65]) << 8n |
        BigInt(accountData[66]) << 16n |
        BigInt(accountData[67]) << 24n |
        BigInt(accountData[68]) << 32n |
        BigInt(accountData[69]) << 40n |
        BigInt(accountData[70]) << 48n |
        BigInt(accountData[71]) << 56n;

      const amountToSend = BigInt(price) * BigInt(10 ** decimals);

      if (balance < amountToSend) {
        throw new Error(`Insufficient balance. You have ${Number(balance) / Math.pow(10, decimals)} TNJ, need ${price} TNJ`);
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

      const signedTx = await phantom.signTransaction(tx);

      if (abortController.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      const newCsrfToken = getFreshCsrf();

      if (abortController.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const verifyRes = await fetch("/api/purchase/verify", {
        method: "POST",
        credentials: "include",
        signal: abortController.signal,
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `${walletAddress}:${signature}`,
          ...(newCsrfToken ? { "x-csrf-token": newCsrfToken } : {}),
        },
        body: JSON.stringify({ signature, gameId, lotId, price }),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        throw new Error(errData.error || `Verification failed: ${verifyRes.status}`);
      }

      const data = await verifyRes.json();
      onSuccess?.(data);

    } catch (err: any) {
      if (err.name === "AbortError" || err.message === "Aborted") {
        return;
      }

      if (err.message?.includes("User rejected") || err.code === 4001) {
        setError(t("errors.userRejected"));
      } else if (signature && (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError"))) {
        setError(t("errors.verificationPending"));
      } else {
        setError(err.message || t("errors.transactionFailed"));
      }
    } finally {
      isProcessingRef.current = false;
      setLoading(false);

      if (activeRequestId === currentRequestId) {
        activeRequestId = null;
      }

      setTimeout(() => {
        if (activeRequestId === null) {
          globalPurchaseLock = false;
        }
      }, 2000);
    }
  }, [publicKey, userWallet, purchaseConfig, t, login, refreshAuth]);

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
    </div>
  );
}