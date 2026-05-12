// src/core/auth/components/LoginWithPhantom.tsx
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useCallback, useEffect } from "react";
import { apiGet, apiPost } from "@/core/api/client";
import { useLanguage } from "@/core/i18n/LanguageContext";

// ✅ Читаем CSRF напрямую из document.cookie
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

  // ✅ Сбрасываем ошибку при изменении состояния
  useEffect(() => {
    if (connected) {
      setError(null);
    }
  }, [connected]);

  // ✅ Подпись и верификация
  const handleSign = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError("Кошелёк не готов к подписи");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Получаем nonce + сервер устанавливает CSRF куку
      const { nonce } = await apiGet<{ nonce: string }>(
        `/api/auth/challenge?wallet=${publicKey.toBase58()}`
      );

      // 2. Формируем сообщение
      const message = `Sign in to TANJO Game Store\nWallet: ${publicKey.toBase58()}\nNonce: ${nonce}`;
      const encoded = new TextEncoder().encode(message);
      
      // 3. Подписываем (откроется окно Phantom)
      const signed = await signMessage(encoded);

      // 4. Читаем актуальный CSRF ПЕРЕД запросом
      const csrf = getFreshCsrf();
      
      // 5. Отправляем на верификацию
      await apiPost("/api/auth/verify", {
        wallet: publicKey.toBase58(),
        message,
        signature: Buffer.from(signed).toString("base64"),
        nonce,
      }, {
        headers: csrf ? { 'x-csrf-token': csrf } : undefined,
      });

      // 6. Микро-задержка для применения новых куки
      await new Promise(res => setTimeout(res, 50));

      onLogin();
      
    } catch (err: any) {
      const isUserRejection = err.code === 4001 || 
                              err.message?.includes("rejected") || 
                              err.message?.includes("cancelled") ||
                              err.message?.includes("User rejected");
                              
      if (isUserRejection) {
        setError("Подпись отменена");
        return;
      }
      
      if (err.message?.includes("timeout")) {
        setError("Кошелёк не ответил. Попробуйте снова.");
        return;
      }
      
      // ✅ Логируем ошибку для отладки
      if (process.env.NODE_ENV === "development") {
        console.error("Sign error:", err);
      }
      
      setError("Ошибка при входе. Попробуйте снова.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [publicKey, signMessage, onLogin]);

  // ✅ Подключение + подпись
  const handleConnectAndSign = useCallback(async () => {
    // ✅ Проверка: кнопка активна?
    if (loading) {
      console.log("Already loading, ignoring click");
      return;
    }

    // Если уже подключены — сразу подписываем
    if (connected && publicKey && signMessage) {
      console.log("Already connected, signing...");
      await handleSign();
      return;
    }

    console.log("Connecting to Phantom...");
    setLoading(true);
    setError(null);

    try {
      // ✅ Проверка: есть ли Phantom
      if (typeof window === "undefined" || !(window as any).phantom?.solana) {
        throw new Error("Phantom wallet not found. Please install Phantom extension.");
      }

      // ✅ Прямое подключение к Phantom
      await connect();

      console.log("Connected, waiting for publicKey...");
      
      // Ждём, пока подключится и появится publicKey
      let retries = 0;
      while (!publicKey && retries < 10) {
        await new Promise(res => setTimeout(res, 200));
        retries++;
      }

      if (!publicKey) {
        throw new Error("Wallet connected but publicKey not available");
      }

      console.log("Public key received, signing...");
      
      // Теперь подписываем
      await handleSign();
      
    } catch (err: any) {
      console.error("Connect error:", err);
      
      if (err.message?.includes("User rejected") || err.code === 4001) {
        setError("Подключение отменено");
      } else if (err.message?.includes("Phantom") || err.message?.includes("not found")) {
        setError("Phantom не установлен. Установите расширение.");
      } else if (err.message?.includes("not connected")) {
        setError("Кошелёк не подключился. Попробуйте снова.");
      } else {
        setError("Не удалось подключиться. Попробуйте снова.");
      }
      setLoading(false);
    }
  }, [connected, publicKey, signMessage, connect, handleSign, loading]);

  // ✅ Тексты кнопок с fallback
  const getButtonText = () => {
    if (loading) {
      return connected ? "Подпись..." : "Подключение...";
    }
    return connected ? "Войти" : "Подключить";
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <button
        onClick={handleConnectAndSign}
        disabled={loading}
        className="btn-primary px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-auto justify-center cursor-pointer"
        aria-label={getButtonText()}
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
        <p className="text-xs sm:text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}