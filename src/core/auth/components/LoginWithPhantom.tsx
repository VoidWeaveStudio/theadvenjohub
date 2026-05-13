"use client";

import { useState, useCallback, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { isMobile } from "@/core/lib/device";

const getCsrfFromCookie = (): string | undefined => {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : undefined;
};

interface LoginWithPhantomProps {
  onLogin: (wallet: string) => void;
  className?: string;
}

export function LoginWithPhantom({ onLogin, className = "" }: LoginWithPhantomProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const urlParams = new URLSearchParams(window.location.search);
    const phantomData = urlParams.get("phantom_data");
    const publicKey = urlParams.get("publicKey");

    if (phantomData || publicKey) {
      const checkAuthAfterRedirect = async () => {
        try {
          const data = await fetch("/api/auth/me", { 
            credentials: "include",
            cache: "no-store"
          }).then(r => r.json());
          if (data.authenticated && data.user?.wallet) {
            onLogin(data.user.wallet);
          }
        } catch (err) {
          console.error("Failed to auth after Phantom redirect:", err);
          setError(t("auth.connectionError"));
        } finally {
          setLoading(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      };
      checkAuthAfterRedirect();
    }
  }, [onLogin, t]);

  useEffect(() => {
    if (!isMobile()) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && loading) {
        setLoading(false);
        try {
          const data = await fetch("/api/auth/me", { 
            credentials: "include",
            cache: "no-store"
          }).then(r => r.json());
          if (data.authenticated && data.user?.wallet) {
            onLogin(data.user.wallet);
          }
        } catch {
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loading, onLogin, t]);

  const handleMobileConnect = useCallback(async () => {
    const currentUrl = encodeURIComponent(window.location.href);
    const dappUrl = encodeURIComponent(window.location.origin);
    const phantomUrl = `https://phantom.app/ul/v1/connect?dapp_url=${dappUrl}&redirect_url=${currentUrl}`;
    window.location.href = phantomUrl;
  }, []);

  const handleDesktopConnect = useCallback(async () => {
    try {
      const phantom = (window as any).phantom?.solana;
      if (!phantom?.isPhantom) {
        window.open("https://phantom.app/", "_blank");
        throw new Error("Phantom not installed");
      }

      const resp = await phantom.connect();
      const wallet = new PublicKey(resp.publicKey).toBase58();

      const challengeRes = await fetch(`/api/auth/challenge?wallet=${encodeURIComponent(wallet)}`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (!challengeRes.ok) {
        const err = await challengeRes.json().catch(() => ({}));
        throw new Error(err.error || `Challenge failed: ${challengeRes.status}`);
      }

      const { nonce, csrfToken } = await challengeRes.json();

      const message = `Sign in to TANJO Game Store\nWallet: ${wallet}\nNonce: ${nonce}`;
      const signed = await phantom.signMessage(new TextEncoder().encode(message), "utf8");
      const signatureBase64 = Buffer.from(signed.signature).toString("base64");

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          wallet,
          message,
          signature: signatureBase64,
          nonce,
        }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err.error || `Verify failed: ${verifyRes.status}`);
      }

      onLogin(wallet);

    } catch (err: any) {
      if (err.code === 4001 || err.message?.includes("rejected")) {
        setError(t("auth.signatureCancelled"));
      } else if (err.message === "Phantom not installed") {
        setError(t("auth.phantomNotInstalled"));
      } else if (err.message?.includes("CSRF") || err.message?.includes("403")) {
        setError(t("auth.sessionExpired"));
      } else {
        setError(t("auth.connectionError"));
      }
      setLoading(false);
    }
  }, [onLogin, t]);

  const handleConnect = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      if (isMobile()) {
        await handleMobileConnect();
      } else {
        await handleDesktopConnect();
      }
    } catch (err: any) {
    }
    if (!isMobile()) {
      setLoading(false);
    }
  }, [loading, handleMobileConnect, handleDesktopConnect]);

  return (
    <div className={`space-y-1 ${className}`}>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="btn-primary px-4 py-2 text-sm font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-full justify-center"
        type="button"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{isMobile() ? t("auth.openingPhantom") : t("auth.connecting")}</span>
          </>
        ) : (
          <span>{t("auth.connect")}</span>
        )}
      </button>
      
      {error && <p className="text-xs text-red-400 text-center" role="alert">{error}</p>}
    </div>
  );
}