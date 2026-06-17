// src/core/providers/SolanaProviders.tsx
"use client";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { 
  PhantomWalletAdapter,
  SolflareWalletAdapter,
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
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo, useCallback } from "react";
import { AuthProvider } from "@/core/auth/AuthProvider";
import "@solana/wallet-adapter-react-ui/styles.css";

export function SolanaProviders({ children }: { children: React.ReactNode }) {
  const network = WalletAdapterNetwork.Mainnet;

  const endpoint = useMemo(() => {
    return process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl(network);
  }, [network]);

  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
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
        autoConnect={false}
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