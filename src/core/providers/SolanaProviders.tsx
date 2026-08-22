// src/core/providers/SolanaProviders.tsx
"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  MathWalletAdapter,
  TokenPocketWalletAdapter,
  SolongWalletAdapter,
  Coin98WalletAdapter,
  SafePalWalletAdapter,
  BitpieWalletAdapter,
  BitgetWalletAdapter,
  CloverWalletAdapter,
  CoinhubWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import type { Adapter } from "@solana/wallet-adapter-base";
import { useMemo, useCallback } from "react";
import { AuthProvider } from "@/core/auth/AuthProvider";
import { getRpcEndpoint } from "@/core/lib/solanaClient";
import { readPendingSignIn } from "@/core/auth/lib/pendingSignIn";
import "@solana/wallet-adapter-react-ui/styles.css";

const MOBILE_WALLET_ADAPTER_NAME = "Mobile Wallet Adapter";

export function SolanaProviders({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => getRpcEndpoint(), []);

  const wallets = useMemo(() => [
    new MathWalletAdapter(),
    new TokenPocketWalletAdapter(),
    new SolongWalletAdapter(),
    new Coin98WalletAdapter(),
    new SafePalWalletAdapter(),
    new BitpieWalletAdapter(),
    new BitgetWalletAdapter(),
    new CloverWalletAdapter(),
    new CoinhubWalletAdapter(),
  ], []);

  const autoConnect = useCallback(async (adapter: Adapter) => {
    if (adapter.name !== MOBILE_WALLET_ADAPTER_NAME) return true;
    return readPendingSignIn() !== null;
  }, []);

  const onError = useCallback((error: Error) => {
    if (process.env.NODE_ENV !== "production") {
      if (error.name !== "WalletNotSelectedError" && error.name !== "WalletNotReadyError") {
        console.error("Wallet adapter error:", error.name, error.message);
      }
    }
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <WalletProvider
        wallets={wallets}
        autoConnect={autoConnect}
        onError={onError}
      >
        <WalletModalProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}