//src\features\shared\PurchaseButton.tsx 
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useCallback, useRef, useMemo } from "react";
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { useAuth } from "@/core/auth/AuthProvider";
import { LoginButton } from "@/core/auth/components/LoginButton"; 

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

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
  const { publicKey, connected, wallet } = useWallet();
  const { login, refreshAuth, userWallet, isAuthorized } = useAuth();
  const [loading, setLoading] = useState<LoadingState>(false);
  const [error, setError] = useState<string | null>(null);

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

  const getTokenBalance = useCallback(async (
    connection: Connection,
    ata: PublicKey,
    tokenProgramId: PublicKey
  ): Promise<bigint> => {
    const accountInfo = await connection.getAccountInfo(ata, "confirmed");
    
    if (!accountInfo) {
      throw new Error("Token account not found");
    }

    const data = accountInfo.data;
    if (data.length < 72) {
      throw new Error("Invalid token account data");
    }

    const balance = BigInt(data[64]) |
      BigInt(data[65]) << 8n |
      BigInt(data[66]) << 16n |
      BigInt(data[67]) << 24n |
      BigInt(data[68]) << 32n |
      BigInt(data[69]) << 40n |
      BigInt(data[70]) << 48n |
      BigInt(data[71]) << 56n;

    return balance;
  }, []);

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

    const { gameId, lotId, price, onSuccess } = purchaseConfig;

    if (!gameId && !lotId) {
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
    setLoading("connecting");
    setError(null);

    let signature: string | null = null;

    try {
      if (!isAuthorized) {
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

      const balance = await getTokenBalance(connection, userATA, tokenProgramId);

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

      if (typeof (walletAdapter as any).signTransaction !== "function") {
        throw new Error("This wallet doesn't support transaction signing");
      }

      let signedTx: Transaction | VersionedTransaction;
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

      try {
        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed"
        );
      } catch (confirmErr: any) {
        console.warn("[TANJO] Transaction confirmation timeout, relying on backend verification:", confirmErr.message);
      }

      if (abortController.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const newCsrfToken = getFreshCsrf();

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
      console.error("[TANJO Purchase Error]", err);
      
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
    }
  }, [publicKey, connected, wallet, purchaseConfig, t, login, refreshAuth, userWallet, isAuthorized, getTokenBalance]);

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