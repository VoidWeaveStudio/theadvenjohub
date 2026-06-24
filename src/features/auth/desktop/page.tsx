//src\features\auth\desktop\page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { WalletSelectorModal } from "@/core/auth/components/WalletSelectorModal";
import { useLanguage } from "@/core/i18n/LanguageContext";

export default function DesktopAuthPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { connect, publicKey, wallet, connected, select, connecting, disconnect } = useWallet();
  
  const [status, setStatus] = useState<"idle" | "selecting" | "connecting" | "signing" | "success" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [selectedWalletName, setSelectedWalletName] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auto") === "1" && status === "idle") {
      const savedWallet = localStorage.getItem("selectedWallet");
      if (savedWallet) {
        handleWalletSelect(savedWallet);
      } else {
        setShowWalletSelector(true);
        setStatus("selecting");
      }
    }
  }, [status]);

  useEffect(() => {
    if (connected && publicKey && selectedWalletName && status === "connecting") {
      handleSignMessage();
    }
  }, [connected, publicKey, selectedWalletName, status]);

  const handleWalletSelect = useCallback(async (walletName: string) => {
    setError("");
    setSelectedWalletName(walletName);
    setShowWalletSelector(false);
    setStatus("connecting");

    try {
      select(walletName as any);
      
      await connect();
    } catch (err: any) {
      console.error("[TANJO Desktop Wallet Error]", err);
      
      if (err.name === "WalletNotReadyError") {
        setError(`${walletName} is not installed. Please install it first.`);
      } else {
        setError(err.message || "Failed to connect wallet");
      }
      
      setStatus("error");
      setSelectedWalletName(null);
    }
  }, [select, connect]);

  const handleSignMessage = useCallback(async () => {
    if (!publicKey || !wallet?.adapter || !selectedWalletName) {
      return;
    }

    try {
      setStatus("signing");
      const walletAddress = publicKey.toBase58();

      const nonceRes = await fetch(`/api/auth/challenge?wallet=${encodeURIComponent(walletAddress)}`, {
        credentials: "include"
      });

      if (!nonceRes.ok) {
        throw new Error("Failed to get challenge from server");
      }

      const { nonce, csrfToken } = await nonceRes.json();

      const message = `Sign in to TANJO Desktop\nWallet: ${walletAddress}\nNonce: ${nonce}`;
      const messageBytes = new TextEncoder().encode(message);

      const signMessageFn = (wallet.adapter as any).signMessage;
      if (typeof signMessageFn !== "function") {
        throw new Error("This wallet doesn't support message signing");
      }

      const signed = await signMessageFn.call(wallet.adapter, messageBytes);
      const signatureBytes = signed.signature || signed;
      const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

      const csrf = csrfToken || document.cookie.match(/csrf_token=([^;]+)/)?.[1] || "";

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf
        },
        body: JSON.stringify({
          wallet: walletAddress,
          message,
          signature: signatureBase64,
          nonce
        })
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err.error || "Verification failed");
      }

      const result = await verifyRes.json();
      const token = result.accessToken;
      
      if (!token) {
        throw new Error("Server did not return access token");
      }

      localStorage.setItem("selectedWallet", selectedWalletName);

      setStatus("success");

      const deepLink = `tanjo://auth/callback?token=${encodeURIComponent(token)}&wallet=${encodeURIComponent(walletAddress)}`;
      
      setTimeout(() => {
        window.location.href = deepLink;
      }, 500);

      setTimeout(() => {
        setStatus((currentStatus) => {
          if (currentStatus === "success") {
            setError("If the app didn't open, please launch TANJO Client manually.");
          }
          return currentStatus;
        });
      }, 4000);

    } catch (err: any) {
      console.error("[TANJO Desktop Auth Error]", err);
      
      if (err.code === 4001 || err.message?.includes("rejected") || err.message?.includes("User rejected")) {
        setError(t("auth.signatureCancelled") || "Signature cancelled");
      } else if (err.message?.includes("not supported")) {
        setError("This wallet doesn't support message signing");
      } else if (err.message?.includes("CSRF") || err.message?.includes("403")) {
        setError(t("auth.sessionExpired") || "Session expired");
      } else {
        setError(err.message || "Failed to authorize");
      }
      
      setStatus("error");
    }
  }, [publicKey, wallet, selectedWalletName, t]);

  const handleRetry = useCallback(() => {
    setStatus("idle");
    setError("");
    setSelectedWalletName(null);
    
    disconnect().catch(() => {});
    
    setTimeout(() => {
      const savedWallet = localStorage.getItem("selectedWallet");
      if (savedWallet) {
        handleWalletSelect(savedWallet);
      } else {
        setShowWalletSelector(true);
        setStatus("selecting");
      }
    }, 300);
  }, [disconnect, handleWalletSelect]);

  const handleChangeWallet = useCallback(() => {
    setStatus("idle");
    setError("");
    setSelectedWalletName(null);
    disconnect().catch(() => {});
    setShowWalletSelector(true);
    setStatus("selecting");
  }, [disconnect]);

  if (status === "connecting" || status === "signing") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="card border-border max-w-md w-full p-6 sm:p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-2xl mb-4">
            <svg className="w-6 h-6 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">TANJO Desktop</h1>
          <p className="text-text-secondary text-sm">
            {status === "connecting" 
              ? `Connecting to ${selectedWalletName}...` 
              : `Sign the message in ${selectedWalletName}...`
            }
          </p>
          <p className="text-text-muted text-xs mt-2">
            If the window didn't appear, check your extension
          </p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="card border-border max-w-md w-full p-6 sm:p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-success/10 rounded-2xl mb-4">
            <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">TANJO Desktop</h1>
          <p className="text-success font-medium mb-1">Success! Redirecting...</p>
          <p className="text-text-muted text-xs">
            If the app didn't open, launch TANJO Client manually
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="card border-border max-w-md w-full p-6 sm:p-8 text-center animate-in">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-2xl mb-4">
            <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">TANJO Desktop</h1>
          <p className="text-text-secondary text-sm">Select your wallet to continue</p>
        </div>

        {error && (
          <div className="bg-error/10 border border-error rounded-lg p-3 mb-4">
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={() => {
            setShowWalletSelector(true);
            setStatus("selecting");
          }}
          disabled={status !== "idle"}
          className="btn-primary w-full justify-center gap-2 mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" />
          </svg>
          Select Wallet
        </button>

        {status === "error" && (
          <div className="space-y-2">
            <button
              onClick={handleRetry}
              className="btn-secondary w-full"
              type="button"
            >
              Try Again
            </button>
            <button
              onClick={handleChangeWallet}
              className="btn-ghost w-full text-sm"
              type="button"
            >
              Change Wallet
            </button>
          </div>
        )}

        <p className="text-text-muted text-xs mt-6">
          After confirmation, you will be automatically redirected to the TANJO app
        </p>

        <WalletSelectorModal
          isOpen={showWalletSelector}
          onClose={() => {
            setShowWalletSelector(false);
            if (status === "selecting") setStatus("idle");
          }}
          onSelect={handleWalletSelect}
        />
      </div>
    </div>
  );
}