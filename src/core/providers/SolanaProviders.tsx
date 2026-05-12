// src/core/providers/SolanaProviders.tsx
"use client";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo, useCallback, useEffect, useState } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";

export function SolanaProviders({ children }: { children: React.ReactNode }) {
  const network = WalletAdapterNetwork.Mainnet;
  const [isClient, setIsClient] = useState(false);

  const endpoint = useMemo(() => {
    return process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl(network);
  }, [network]);

  const wallets = useMemo(() => {
    if (!isClient) return [];
    return [new PhantomWalletAdapter()];
  }, [isClient]);

  const onError = useCallback((error: Error) => {
    if (process.env.NODE_ENV !== "production") {
      if (error.name !== "WalletNotSelectedError" && error.name !== "WalletNotReadyError") {
        console.error("Wallet adapter error:", error.name, error.message);
      }
    }
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <WalletProvider
        wallets={wallets}
        autoConnect={false} 
        onError={onError}
        key="solana-wallet-provider"
      >
        {isClient ? children : null}
      </WalletProvider>
    </ConnectionProvider>
  );
}