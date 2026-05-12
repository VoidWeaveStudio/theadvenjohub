// src/core/providers/SolanaProviders.tsx
"use client";

import { WalletAdapterNetwork, WalletReadyState } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
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
    return [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ];
  }, [isClient]);

  const onError = useCallback((error: Error) => {
    if (error.name === "WalletNotSelectedError" || error.name === "WalletNotReadyError") {
      return;
    }
    console.error("Wallet adapter error:", error.name, error.message);
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
        <WalletModalProvider>
          {isClient ? children : null}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}