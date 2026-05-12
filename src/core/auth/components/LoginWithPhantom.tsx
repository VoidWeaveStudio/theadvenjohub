// src/core/auth/components/LoginWithPhantom.tsx
"use client";

import { useState, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { apiGet } from "@/core/api/client";

const getFreshCsrf = (): string | undefined => {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split(';')
    .find(c => c.trim().startsWith('csrf_token='))
    ?.split('=')[1]
    ?.trim();
};

interface LoginWithPhantomProps {
  onLogin: (wallet: string) => void;
  className?: string;
}

export function LoginWithPhantom({ onLogin, className = "" }: LoginWithPhantomProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const phantom = (window as any).phantom?.solana;
      if (!phantom?.isPhantom) {
        window.open("https://phantom.app/", "_blank");
        throw new Error("Phantom not installed");
      }

      const resp = await phantom.connect();
      const wallet = new PublicKey(resp.publicKey).toBase58();

      const { nonce } = await apiGet<{ nonce: string }>(
        `/api/auth/challenge?wallet=${wallet}`
      );

      const message = `Sign in to TANJO Game Store\nWallet: ${wallet}\nNonce: ${nonce}`;
      const signed = await phantom.signMessage(new TextEncoder().encode(message), "utf8");

      const csrf = getFreshCsrf();
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf || "",
        },
        body: JSON.stringify({
          wallet,
          message,
          signature: Buffer.from(signed.signature).toString("base64"),
          nonce,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Verification failed");
      }

      onLogin(wallet);

    } catch (err: any) {
      if (err.code === 4001 || err.message?.includes("rejected")) {
        setError("Подпись отменена");
      } else if (err.message === "Phantom not installed") {
        setError("Установите Phantom Wallet");
      } else {
        setError(err.message || "Ошибка подключения");
      }
    } finally {
      setLoading(false);
    }
  }, [loading, onLogin]);

  return (
    <div className={`space-y-2 ${className}`}>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="btn-primary px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-auto justify-center cursor-pointer"
        type="button"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Подключение...</span>
          </>
        ) : (
          <span>Подключить</span>
        )}
      </button>
      {error && <p className="text-xs sm:text-sm text-red-400" role="alert">{error}</p>}
    </div>
  );
}