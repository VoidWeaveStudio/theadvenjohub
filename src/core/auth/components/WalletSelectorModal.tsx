// src/core/auth/components/WalletSelectorModal.tsx
"use client"; 

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { Modal } from "@/core/ui/Modal";

interface WalletSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (walletName: string) => void;
}

const WALLET_LABELS: Record<string, string> = {
  "Phantom": "Phantom",
  "Solflare": "Solflare",
  "OKX Wallet": "OKX Wallet",
  "MathWallet": "MathWallet",
  "TokenPocket": "TokenPocket",
  "Solong": "Solong",
  "Coin98": "Coin98",
  "SafePal": "SafePal",
  "Bitpie": "Bitpie",
  "Bitget": "Bitget Wallet",
  "Clover": "Clover",
  "Coinhub": "Coinhub",
  "MagicEden": "Magic Eden",
};

export function WalletSelectorModal({ isOpen, onClose, onSelect }: WalletSelectorModalProps) {
  const { wallets } = useWallet();
  const { t } = useLanguage();
  const [walletsList, setWalletsList] = useState<any[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    if (!isOpen || !wallets) return;

    const uniqueWallets = new Map<string, any>();
    
    wallets.forEach(wallet => {
      const name = wallet.adapter.name;
      const isInstalled = wallet.readyState === WalletReadyState.Installed || 
                          wallet.readyState === WalletReadyState.Loadable;
      
      if (!uniqueWallets.has(name) || 
          (isInstalled && uniqueWallets.get(name)?.readyState !== WalletReadyState.Installed)) {
        uniqueWallets.set(name, wallet);
      }
    });

    const list = Array.from(uniqueWallets.values());

    list.sort((a, b) => {
      const aInstalled = a.readyState === WalletReadyState.Installed || 
                         a.readyState === WalletReadyState.Loadable;
      const bInstalled = b.readyState === WalletReadyState.Installed || 
                         b.readyState === WalletReadyState.Loadable;
      
      if (aInstalled && !bInstalled) return -1;
      if (!aInstalled && bInstalled) return 1;
      return a.adapter.name.localeCompare(b.adapter.name);
    });

    setWalletsList(list);
  }, [isOpen, wallets]);

  const handleSelect = (walletName: string) => {
    if (isSelecting) return;
    setIsSelecting(true);
    onSelect(walletName);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("auth.selectWallet") || "Select Wallet"} size="md">
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
        {(!wallets || wallets.length === 0) ? (
          <div className="text-center py-8 text-text-secondary">
            <p className="animate-spin text-4xl mb-3 inline-block">⟳</p>
            <p className="text-sm">{t("auth.loadingWallets") || "Loading wallets..."}</p>
          </div>
        ) : walletsList.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            <p className="text-4xl mb-3">👛</p>
            <p className="text-sm">{t("auth.noWalletsFound") || "No wallets found. Please install Phantom or Solflare."}</p>
          </div>
        ) : (
          walletsList.map((wallet) => {
            const isAvailable = 
              wallet.readyState === WalletReadyState.Installed || 
              wallet.readyState === WalletReadyState.Loadable;
            
            const walletName = wallet.adapter.name;
            const label = WALLET_LABELS[walletName] || walletName;
            
            return (
              <button
                key={walletName}
                onClick={() => isAvailable && handleSelect(walletName)}
                disabled={!isAvailable || isSelecting}
                className="w-full flex items-center gap-4 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-surface/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface flex items-center justify-center flex-shrink-0 border border-border/50">
                  <img 
                    src={wallet.adapter.icon} 
                    alt={label}
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%91%9B%3C/text%3E%3C/svg%3E";
                    }}
                  />
                </div>
                
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {label}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {isAvailable 
                      ? (t("auth.detected") || "Detected") 
                      : (t("auth.notInstalled") || "Not installed")}
                  </div>
                </div>
                
                {isAvailable && !isSelecting && (
                  <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    →
                  </div>
                )}
                
                {(isSelecting || !isAvailable) && (
                  <div className="text-xs text-text-muted flex-shrink-0">
                    {isSelecting ? (t("auth.connecting") || "Connecting...") : (t("auth.install") || "Install")}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </Modal>
  );
}