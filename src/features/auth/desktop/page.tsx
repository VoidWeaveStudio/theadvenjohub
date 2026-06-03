//src\features\auth\desktop\page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";

export default function DesktopAuthPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "connecting" | "signing" | "success" | "error">("idle");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auto") === "1" && status === "idle") {
      handleLogin();
    }
  }, [status]);

  const handleLogin = useCallback(async () => {
    if (status === "connecting" || status === "signing" || status === "success") {
      return;
    }

    try {
      setError("");
      setStatus("connecting");

      const phantom = (window as any).phantom?.solana;
      if (!phantom?.isPhantom) {
        throw new Error("Phantom extension not found. Please install from https://phantom.app");
      }

      await phantom.connect();
      const wallet = new PublicKey(phantom.publicKey).toBase58();
      setStatus("signing");

      const nonceRes = await fetch(`/api/auth/challenge?wallet=${encodeURIComponent(wallet)}`, {
        credentials: "include"
      });
      const { nonce } = await nonceRes.json();

      const message = `Sign in to TANJO Desktop\nWallet: ${wallet}\nNonce: ${nonce}`;
      const signed = await phantom.signMessage(new TextEncoder().encode(message), "utf8");
      const sigBase64 = btoa(String.fromCharCode(...signed.signature));

      const csrf = document.cookie.match(/csrf_token=([^;]+)/)?.[1];
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf || ""
        },
        body: JSON.stringify({ wallet, message, signature: sigBase64, nonce })
      });

      const result = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(result.error || "Verification failed");

      setStatus("success");
      const token = result.accessToken;
      if (!token) throw new Error("Server did not return access token");

      const deepLink = `tanjo://auth/callback?token=${encodeURIComponent(token)}&wallet=${encodeURIComponent(wallet)}`;
      window.location.href = deepLink;

      setTimeout(() => {
        setStatus((currentStatus) => {
          if (currentStatus === "success") {
            setError("If the app didn't open, please launch TANJO Client manually.");
          }
          return currentStatus;
        });
      }, 4000);

    } catch (err: any) {
      setError(err.message || "Failed to authorize");
      setStatus("error");
    }
  }, [status]);

  const handleRetry = useCallback(() => {
    setStatus("idle");
    setError("");
    setTimeout(() => handleLogin(), 300);
  }, [handleLogin]);

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
            {status === "connecting" ? "Opening Phantom..." : "Sign the message in Phantom..."}
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
          <p className="text-text-secondary text-sm">Confirm your login with Phantom</p>
        </div>

        {error && (
          <div className="bg-error/10 border border-error rounded-lg p-3 mb-4">
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={status !== "idle"}
          className="btn-primary w-full justify-center gap-2 mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" />
          </svg>
          Connect Phantom
        </button>

        {status === "error" && (
          <button
            onClick={handleRetry}
            className="btn-secondary w-full"
            type="button"
          >
            Try Again
          </button>
        )}

        <p className="text-text-muted text-xs mt-6">
          After confirmation, you will be automatically redirected to the TANJO app
        </p>
      </div>
    </div>
  );
}