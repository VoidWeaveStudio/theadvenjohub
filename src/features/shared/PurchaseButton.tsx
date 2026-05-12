// src/features/shared/PurchaseButton.tsx
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { 
  Connection, 
  PublicKey, 
  TransactionMessage, 
  VersionedTransaction, 
} from "@solana/web3.js";
import { 
  getAssociatedTokenAddress, 
  createTransferInstruction, 
} from "@solana/spl-token";
import { useState, useCallback, useRef, useMemo } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { getCsrfToken } from "@/core/lib/clientUtils";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

let globalPurchaseLock = false;
let activeRequestId: string | null = null;
let lastPurchaseTime = 0;
const PURCHASE_COOLDOWN_MS = 5000;

interface PurchaseButtonProps {
  gameId?: string;
  lotId?: string;
  price: number;
  onSuccess?: (result: { id: string; type: "game" | "item" }) => void;
}

type LoadingState = boolean | "confirming";

export function PurchaseButton({ gameId, lotId, price, onSuccess }: PurchaseButtonProps) {
  const { publicKey, sendTransaction } = useWallet();
  const { t } = useLanguage();
  const [loading, setLoading] = useState<LoadingState>(false);
  const [error, setError] = useState<string | null>(null);
  
  const requestIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const purchaseConfig = useMemo(() => ({
    gameId, lotId, price, onSuccess
  }), [gameId, lotId, price, onSuccess]);

  const handlePurchase = useCallback(async (e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    
    const currentRequestId = requestIdRef.current;
    const now = Date.now();
    
    if (globalPurchaseLock || activeRequestId !== null || (now - lastPurchaseTime < PURCHASE_COOLDOWN_MS)) {
      return;
    }
    
    if (isProcessingRef.current) {
      return;
    }

    const { gameId, lotId, price, onSuccess } = purchaseConfig;

    if (!publicKey || !sendTransaction) {
      setError(t("errors.connectWallet"));
      return;
    }
    if (!gameId && !lotId) {
      setError("Missing gameId or lotId");
      return;
    }
    if (price <= 0) {
      setError("Invalid price");
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
    setLoading(true);
    setError(null);

    let signature: string | null = null;

    try {
      const configRes = await fetch("/api/marketplace/config", { signal: abortController.signal });
      if (!configRes.ok) throw new Error("Failed to load config");
      const config = await configRes.json();

      const connection = new Connection(config.publicRpc, "confirmed");
      const mintPubkey = new PublicKey(config.tokenMint);
      const treasuryPubkey = new PublicKey(config.treasuryWallet);

      const userATA = await getAssociatedTokenAddress(
        mintPubkey, 
        publicKey, 
        undefined, 
        TOKEN_2022_PROGRAM_ID
      );
      const treasuryATA = await getAssociatedTokenAddress(
        mintPubkey, 
        treasuryPubkey, 
        undefined, 
        TOKEN_2022_PROGRAM_ID
      );

      const transferIx = createTransferInstruction(
        userATA, 
        treasuryATA, 
        publicKey, 
        BigInt(price), 
        [], 
        TOKEN_2022_PROGRAM_ID
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [transferIx],
      }).compileToV0Message();

      const tx = new VersionedTransaction(messageV0);

      const simulation = await connection.simulateTransaction(tx);
      if (simulation.value.err) {
        throw new Error("Transaction simulation failed");
      }

      if (abortController.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      
      signature = await sendTransaction(tx, connection, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });

      setLoading("confirming");

      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      try {
        await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }).catch(() => { /* ignore */ });
      } catch {
      }

      const csrfToken = getCsrfToken();

      if (abortController.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const res = await fetch("/api/purchase/verify", {
        method: "POST",
        credentials: "include",
        signal: abortController.signal,
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `${publicKey.toString()}:${signature}`,
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({ signature, gameId, lotId, price }),
      });

      if (res.status === 401) {
        try {
          const refreshRes = await fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
          
          if (refreshRes.ok) {
            const retryRes = await fetch("/api/purchase/verify", {
              method: "POST",
              credentials: "include",
              signal: abortController.signal,
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": `${publicKey.toString()}:${signature}`,
                ...(getCsrfToken() ? { "x-csrf-token": getCsrfToken() } : {}),
              },
              body: JSON.stringify({ signature, gameId, lotId, price }),
            });
            
            if (!retryRes.ok) {
              const errData = await retryRes.json().catch(() => ({}));
              throw new Error(errData.error || `Verification failed: ${retryRes.status}`);
            }
            
            const data = await retryRes.json();
            onSuccess?.(data);
            return;
          }
        } catch {
        }
        throw new Error("Session expired. Please refresh the page and try again.");
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Verification failed: ${res.status}`);
      }

      const data = await res.json();
      onSuccess?.(data);
      
    } catch (err: any) {
      if (err.name === "AbortError" || err.message === "Aborted") {
        return;
      }
      
      if (err.message?.includes("User rejected") || err.message?.includes("cancelled")) {
        setError(t("errors.userRejected"));
      } else if (signature && (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError"))) {
        setError("Transaction sent, verification pending. Check your purchases.");
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
  }, [publicKey, sendTransaction, purchaseConfig, t]);

  const getButtonText = () => {
    if (loading === "confirming") {
      return (
        <span className="flex items-center gap-2">
          <span className="animate-pulse">⛓️</span>
          {t("actions.confirming")}
        </span>
      );
    }
    if (loading) {
      return (
        <span className="flex items-center gap-2">
          <span className="animate-spin">⟳</span>
          {t("actions.processing")}
        </span>
      );
    }
    return `${t("actions.buy")} ${(price / 1_000_000).toFixed(2)} TNJ`;
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handlePurchase}
        disabled={!!loading || !publicKey}
        className="btn-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        style={{ pointerEvents: loading ? 'none' : 'auto' }}
      >
        {getButtonText()}
      </button>
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
    </div>
  );
}