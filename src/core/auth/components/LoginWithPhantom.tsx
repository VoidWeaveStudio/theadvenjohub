// src/core/auth/components/LoginWithPhantom.tsx
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useCallback, useEffect } from "react";
import { apiGet, apiPost } from "@/core/api/client";
import { useLanguage } from "@/core/i18n/LanguageContext";

const getFreshCsrf = (): string | undefined => {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split(';')
    .find(c => c.trim().startsWith('csrf_token='))
    ?.split('=')[1]
    ?.trim();
};

interface LoginWithPhantomProps {
  onLogin: () => void;
  className?: string;
}

export function LoginWithPhantom({ onLogin, className = "" }: LoginWithPhantomProps) {
  const { publicKey, signMessage, connected, connect } = useWallet();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connected) {
      setError(null);
    }
  }, [connected]);

  const handleSign = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError(t("errors.walletNotReady"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { nonce } = await apiGet<{ nonce: string }>(
        `/api/auth/challenge?wallet=${publicKey.toBase58()}`
      );

      const message = `Sign in to TANJO Game Store\nWallet: ${publicKey.toBase58()}\nNonce: ${nonce}`;
      const encoded = new TextEncoder().encode(message);
      
      const signed = await signMessage(encoded);

      const csrf = getFreshCsrf();
      
      await apiPost("/api/auth/verify", {
        wallet: publicKey.toBase58(),
        message,
        signature: Buffer.from(signed).toString("base64"),
        nonce,
      }, {
        headers: csrf ? { 'x-csrf-token': csrf } : undefined,
      });

      await new Promise(res => setTimeout(res, 50));

      onLogin();
      
    } catch (err: any) {
      const isUserRejection = err.code === 4001 || 
                              err.message?.includes("rejected") || 
                              err.message?.includes("cancelled") ||
                              err.message?.includes("User rejected");
                              
      if (isUserRejection) {
        setError(t("errors.userRejected"));
        return;
      }
      
      if (err.message?.includes("timeout")) {
        setError(t("errors.walletTimeout"));
        return;
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [publicKey, signMessage, onLogin, t]);

  const handleConnectAndSign = useCallback(async () => {
    if (connected && publicKey && signMessage) {
      await handleSign();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await connect();

      await new Promise(res => setTimeout(res, 300));

      await handleSign();
      
    } catch (err: any) {
      if (err.message?.includes("User rejected") || err.code === 4001) {
        setError(t("errors.userRejected"));
      } else if (err.message?.includes("Phantom") || err.message?.includes("not installed")) {
        setError(t("errors.phantomNotInstalled"));
      } else {
        setError(t("errors.connectionFailed"));
      }
      setLoading(false);
    }
  }, [connected, publicKey, signMessage, connect, handleSign, t]);

  const buttonText = connected 
    ? (loading ? t("auth.signing") : t("auth.signIn"))
    : (loading ? t("auth.connecting") : t("auth.connectWallet"));

  return (
    <div className={`space-y-2 ${className}`}>
      <button
        onClick={handleConnectAndSign}
        disabled={loading}
        className="btn-primary px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-auto justify-center"
        aria-label={buttonText}
      >
        {loading && (
          <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {buttonText}
      </button>
      
      {error && (
        <p className="text-xs sm:text-sm text-red-400" role="alert">{error}</p>
      )}
    </div>
  );
}