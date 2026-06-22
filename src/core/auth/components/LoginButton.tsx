//src\core\auth\components\LoginButton.tsx
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { WalletSelectorModal } from "./WalletSelectorModal";
import { useAuth } from "../AuthProvider";

type LoadingState = boolean | "connecting" | "signing";

export function LoginButton({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const { connect, publicKey, wallet, connected, select, connecting } = useWallet();
  const { login, isAuthorized } = useAuth();

  const [loading, setLoading] = useState<LoadingState>(false);
  const [error, setError] = useState<string | null>(null);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [signTrigger, setSignTrigger] = useState(0);

  const pendingWalletName = useRef<string | null>(null);
  const isProcessingRef = useRef(false);
  const pendingConnectRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || isAuthorized) return;

    const savedWallet = localStorage.getItem("selectedWallet");
    if (!savedWallet) return;

    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.authenticated && data.user?.wallet) {
          login(data.user.wallet, savedWallet);
        }
      })
      .catch(() => { });
  }, [isAuthorized, login]);

  useEffect(() => {
    if (pendingConnectRef.current && wallet && !connected && !connecting) {
      pendingConnectRef.current = false;
      
      connect()
        .then(() => {
          setSignTrigger(prev => prev + 1);
        })
        .catch((err: any) => {
          console.error("[TANJO Wallet Connection Error]", err);
          setLoading(false);
          pendingWalletName.current = null;
        });
    }
  }, [wallet, connected, connecting, connect]);

  useEffect(() => {
    if (!connected || !publicKey || !pendingWalletName.current || isProcessingRef.current) return;

    isProcessingRef.current = true;

    const doSignAndVerify = async () => {
      const walletName = pendingWalletName.current;
      if (!walletName) {
        isProcessingRef.current = false;
        return;
      }

      try {
        const walletAddress = publicKey.toBase58();
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
        const message = `Sign in to TANJO Game Store\nWallet: ${walletAddress}\nNonce: ${nonce}`;
        const messageBytes = new TextEncoder().encode(message);

        if (!wallet?.adapter) {
          throw new Error("Wallet adapter not found");
        }

        const signMessageFn = (wallet.adapter as any).signMessage;

        if (typeof signMessageFn !== "function") {
          throw new Error("SIGN_METHOD_NOT_SUPPORTED");
        }

        let signatureBase64: string;
        try {
          const signed = await signMessageFn.call(wallet.adapter, messageBytes);
          const signatureBytes = signed.signature || signed;
          signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
        } catch (signError: any) {
          if (signError.message?.includes("not supported") || signError.message?.includes("not a function")) {
            throw new Error("SIGN_METHOD_NOT_SUPPORTED");
          }
          throw signError;
        }

        const verifyRes = await fetch("/api/auth/verify", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({
            wallet: walletAddress,
            message,
            signature: signatureBase64,
            nonce,
          }),
        });

        if (!verifyRes.ok) {
          const err = await verifyRes.json().catch(() => ({}));
          throw new Error(err.error || `Verify failed: ${verifyRes.status}`);
        }

        login(walletAddress, walletName);
        localStorage.setItem("selectedWallet", walletName);

        setLoading(false);
        pendingWalletName.current = null;

      } catch (err: any) {
        console.error("[TANJO Auth Error]", err);
        
        if (err.message === "SIGN_METHOD_NOT_SUPPORTED") {
          setError(t("auth.walletNotSupported") || "This wallet doesn't support message signing.");
        } else if (err.code === 4001 || err.message?.includes("rejected") || err.message?.includes("User rejected")) {
          setError(t("auth.signatureCancelled"));
        } else if (err.message?.includes("does not support")) {
          setError(t("auth.walletNotSupported") || err.message);
        } else if (err.message?.includes("CSRF") || err.message?.includes("403")) {
          setError(t("auth.sessionExpired"));
        } else {
          setError(err.message || t("auth.connectionError"));
        }

        setLoading(false);
        pendingWalletName.current = null;
      } finally {
        isProcessingRef.current = false;
      }
    };

    doSignAndVerify();
  }, [connected, publicKey, wallet, t, login, signTrigger]);

  const handleWalletSelect = useCallback(async (walletName: string) => {
    if (loading) return;

    pendingWalletName.current = walletName;
    setError(null);
    setLoading("connecting");
    setShowWalletSelector(false);
    pendingConnectRef.current = true;

    try {
      select(walletName as any);
    } catch (err: any) {
      console.error("[TANJO Wallet Selection Error]", err);
      pendingConnectRef.current = false;
      
      if (err.name === "WalletNotReadyError") {
        setError(`${walletName} is not installed. Please install it first.`);
      } else {
        setError(err.message || t("auth.connectionError"));
      }

      setLoading(false);
      pendingWalletName.current = null;
    }
  }, [loading, select, t]);

  const handleConnect = useCallback(() => {
    if (loading || isAuthorized) return;

    const savedWallet = localStorage.getItem("selectedWallet");
    if (savedWallet) {
      handleWalletSelect(savedWallet);
    } else {
      setShowWalletSelector(true);
    }
  }, [loading, isAuthorized, handleWalletSelect]);

  const getButtonText = () => {
    if (loading === "connecting") {
      return (
        <span className="flex items-center gap-2">
          <span className="animate-spin">⟳</span>
          {t("auth.connecting")}
        </span>
      );
    }
    if (loading === "signing") {
      return (
        <span className="flex items-center gap-2">
          <span className="animate-pulse">✍️</span>
          {t("auth.signing")}
        </span>
      );
    }
    return t("auth.connect");
  };

  return (
    <>
      <button
        onClick={handleConnect}
        disabled={!!loading || isAuthorized}
        className={`btn-primary px-4 py-2 text-sm font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-full justify-center ${className}`}
        type="button"
      >
        {getButtonText()}
      </button>

      {error && (
        <p className="text-xs text-red-400 text-center mt-2" role="alert">
          {error}
        </p>
      )}

      <WalletSelectorModal
        isOpen={showWalletSelector}
        onClose={() => setShowWalletSelector(false)}
        onSelect={handleWalletSelect}
      />
    </>
  );
}