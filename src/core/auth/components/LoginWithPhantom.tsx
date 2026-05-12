// src/core/auth/components/LoginWithPhantom.tsx
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState, useCallback } from "react";
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
  const { publicKey, signMessage, wallet, connected } = useWallet();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const handleSign = useCallback(async () => {
    if (!publicKey || !signMessage || loading) return;
    
    if (wallet?.readyState !== WalletReadyState.Installed && 
        wallet?.readyState !== WalletReadyState.Loadable) {
      document.querySelector<HTMLButtonElement>('.wallet-adapter-button-trigger')?.click();
      return;
    }

    setLoading(true);
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

      await new Promise(res => setTimeout(res, 100));

      onLogin();
      
    } catch (err: any) {
      const isUserRejection = err.code === 4001 || 
                              err.message?.includes("rejected") || 
                              err.message?.includes("cancelled");
      if (isUserRejection) return;

      setLoading(false);
      throw err;
      
    } finally {
      if (!loading) setLoading(false);
    }
  }, [publicKey, signMessage, wallet, loading, onLogin, t]);

  if (!connected) {
    return <WalletMultiButton />;
  }

  return (
    <button
      onClick={handleSign}
      disabled={loading}
      className="px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label={loading ? t("auth.signing") : t("auth.signIn")}
    >
      {loading ? t("auth.signing") : t("auth.signIn")}
    </button>
  );
}