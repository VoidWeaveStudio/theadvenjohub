//src\core\providers\SolanaProviders.tsx
"use client";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo, useCallback, useRef } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";

export function SolanaProviders({ children }: { children: React.ReactNode }) {
  const network = WalletAdapterNetwork.Mainnet;

  const endpoint = useMemo(() => {
    return process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl(network);
  }, []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  const onError = useCallback((error: Error) => {
    console.error("Wallet adapter error:", error.name, error.message);
  }, []);

  const isInitialized = useRef(false);
  if (!isInitialized.current) {
    isInitialized.current = true;
  }

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <WalletProvider
        wallets={wallets}
        autoConnect={true}
        onError={onError}
        key="solana-wallet-provider"
      >
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}