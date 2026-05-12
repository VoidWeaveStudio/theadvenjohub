// src/core/auth/components/LoginWithPhantom.tsx
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useState, useCallback, useEffect } from "react";
import { apiGet, apiPost } from "@/core/api/client";

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
  const { signMessage } = useWallet(); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);

  const connectToPhantom = useCallback(async (): Promise<PublicKey> => {
    if (typeof window === "undefined") {
      throw new Error("Window is not defined");
    }

    const phantom = (window as any).phantom?.solana;
    
    if (!phantom) {
      window.open("https://phantom.app/", "_blank");
      throw new Error("Phantom не установлен. Открываем сайт для установки...");
    }

    try {
      const response = await phantom.connect();
      const pubKey = new PublicKey(response.publicKey);
      
      console.log("✅ Connected to Phantom:", pubKey.toBase58());
      return pubKey;
      
    } catch (err: any) {
      if (err.code === 4001 || err.message?.includes("rejected")) {
        throw new Error("Подключение отменено");
      }
      throw err;
    }
  }, []);

  const signMessageWithPhantom = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    const phantom = (window as any).phantom?.solana;
    
    if (!phantom) {
      throw new Error("Phantom не доступен");
    }

    try {
      const signed = await phantom.signMessage(message, "utf8");
      return signed.signature;
    } catch (err: any) {
      if (err.code === 4001 || err.message?.includes("rejected")) {
        throw new Error("Подпись отменена");
      }
      throw err;
    }
  }, []);

  const handleSign = useCallback(async (pubKey: PublicKey) => {
    try {
      const { nonce } = await apiGet<{ nonce: string }>(
        `/api/auth/challenge?wallet=${pubKey.toBase58()}`
      );

      const message = `Sign in to TANJO Game Store\nWallet: ${pubKey.toBase58()}\nNonce: ${nonce}`;
      const encoded = new TextEncoder().encode(message);
      
      const signed = await signMessageWithPhantom(encoded);
      const signatureBase64 = Buffer.from(signed).toString("base64");

      const csrf = getFreshCsrf();
      
      await apiPost("/api/auth/verify", {
        wallet: pubKey.toBase58(),
        message,
        signature: signatureBase64,
        nonce,
      }, {
        headers: csrf ? { 'x-csrf-token': csrf } : undefined,
      });

      await new Promise(res => setTimeout(res, 50));

      onLogin();
      
    } catch (err: any) {
      if (err.message?.includes("отменено") || err.code === 4001) {
        setError("Подпись отменена");
        return;
      }
      
      if (process.env.NODE_ENV === "development") {
        console.error("Sign error:", err);
      }
      
      setError("Ошибка при входе. Попробуйте снова.");
      throw err;
    }
  }, [signMessageWithPhantom, onLogin]);

  const handleConnectAndSign = useCallback(async () => {
    if (loading) return;

    console.log("🔗 Connecting to Phantom...");
    setLoading(true);
    setError(null);

    try {
      const pubKey = await connectToPhantom();
      setPublicKey(pubKey);
      
      console.log("✍️ Signing message...");
      await handleSign(pubKey);
      
    } catch (err: any) {
      console.error("❌ Connect error:", err);
      
      if (err.message?.includes("не установлен")) {
        setError("Phantom не установлен");
      } else if (err.message?.includes("отменено")) {
        setError("Подключение отменено");
      } else {
        setError("Не удалось подключиться");
      }
    } finally {
      setLoading(false);
    }
  }, [connectToPhantom, handleSign, loading]);

  const getButtonText = () => {
    if (loading) return "Подключение...";
    return publicKey ? "Войти" : "Подключить";
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <button
        onClick={handleConnectAndSign}
        disabled={loading}
        className="btn-primary px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-auto justify-center cursor-pointer"
        type="button"
      >
        {loading && (
          <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {getButtonText()}
      </button>
      
      {error && (
        <p className="text-xs sm:text-sm text-red-400" role="alert">{error}</p>
      )}
    </div>
  );
}