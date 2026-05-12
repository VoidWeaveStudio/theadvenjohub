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

export function LoginWithPhantom({ onLogin }: { onLogin: () => void }) {
  const { publicKey, signMessage, wallet, connected, connect } = useWallet();
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
      throw err;
    }
  }, [publicKey, signMessage, onLogin, t]);

  const handleConnectAndSign = useCallback(async () => {
    if (connected && publicKey && signMessage) {
      await handleSign();
      return;
    }

    if (!wallet) {
      setError(t("errors.walletNotFound"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await connect();

      if (!publicKey) {
        await new Promise(res => setTimeout(res, 300));
      }

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
  }, [connected, publicKey, signMessage, wallet, connect, handleSign, t]);

  const buttonText = connected 
    ? (loading ? t("auth.signing") : t("auth.signIn"))
    : (loading ? t("auth.connecting") : t("auth.connectWallet"));

  return (
    <div className="space-y-2">
      <button
        onClick={handleConnectAndSign}
        disabled={loading}
        className="px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        aria-label={buttonText}
      >
        {loading && <span className="animate-spin">⟳</span>}
        {buttonText}
      </button>
      
      {error && (
        <p className="text-sm text-red-400" role="alert">{error}</p>
      )}
    </div>
  );
}