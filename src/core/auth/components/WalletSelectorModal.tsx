// src/core/auth/components/WalletSelectorModal.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { Wallet as WalletIcon, ExternalLink, Smartphone } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { Modal } from "@/core/ui/Modal";
import { useDevice } from "@/core/lib/useDevice";
import { MOBILE_WALLET_LINKS, getSafeBrowseTarget, getStoreUrl } from "@/core/wallets/mobileDeeplinks";

interface WalletSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (walletName: string) => void;
}

interface RecommendedWallet {
  name: string;
  url: string;
  hintKey: string;
}

const WALLET_PROBE_MS = 700;

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
};

const RECOMMENDED_WALLETS: RecommendedWallet[] = [
  { name: "Phantom", url: "https://phantom.app/download", hintKey: "auth.walletHint.phantom" },
  { name: "Solflare", url: "https://solflare.com/download", hintKey: "auth.walletHint.solflare" },
  { name: "Backpack", url: "https://backpack.app/download", hintKey: "auth.walletHint.backpack" },
  { name: "OKX Wallet", url: "https://www.okx.com/web3", hintKey: "auth.walletHint.okx" },
];

export function WalletSelectorModal({ isOpen, onClose, onSelect }: WalletSelectorModalProps) {
  const { wallets } = useWallet();
  const { t } = useLanguage();
  const device = useDevice();
  const [isSelecting, setIsSelecting] = useState(false);
  const [isProbing, setIsProbing] = useState(true);
  const [browseTarget, setBrowseTarget] = useState<string | null>(null);

  useEffect(() => {
    setBrowseTarget(getSafeBrowseTarget());
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    setIsSelecting(false);
    setIsProbing(true);
    const timer = setTimeout(() => setIsProbing(false), WALLET_PROBE_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const availableWallets = useMemo(() => {
    const unique = new Map<string, (typeof wallets)[number]>();

    (wallets ?? []).forEach((wallet) => {
      const isAvailable =
        wallet.readyState === WalletReadyState.Installed ||
        wallet.readyState === WalletReadyState.Loadable;

      if (!isAvailable) return;

      const name = wallet.adapter.name;
      const existing = unique.get(name);
      if (!existing || (existing.readyState !== WalletReadyState.Installed && wallet.readyState === WalletReadyState.Installed)) {
        unique.set(name, wallet);
      }
    });

    return Array.from(unique.values()).sort((a, b) => a.adapter.name.localeCompare(b.adapter.name));
  }, [wallets]);

  const showMobileHandoff = Boolean(
    device.ready && device.isMobile && !device.walletBrowser && browseTarget
  );

  const handleSelect = (walletName: string) => {
    if (isSelecting) return;
    setIsSelecting(true);
    onSelect(walletName);
  };

  const renderBody = () => {
    if (availableWallets.length === 0 && isProbing) {
      return (
        <div className="text-center py-10 text-text-secondary">
          <p className="animate-spin text-4xl mb-3 inline-block">⟳</p>
          <p className="text-sm">{t("auth.loadingWallets")}</p>
        </div>
      );
    }

    if (availableWallets.length === 0 && showMobileHandoff) {
      return (
        <div className="space-y-4">
          <div className="text-center pt-2 pb-1">
            <Smartphone className="w-10 h-10 mx-auto mb-3 text-text-muted" />
            <p className="font-medium text-foreground">{t("auth.mobileContinueTitle")}</p>
            <p className="text-sm text-text-secondary mt-1">{t("auth.mobileContinueHint")}</p>
          </div>

          <div className="space-y-2">
            {MOBILE_WALLET_LINKS.map((link) => (
              <a
                key={link.id}
                href={link.buildBrowseUrl(browseTarget!)}
                className="w-full flex items-center gap-4 p-3 min-h-[56px] rounded-lg border border-border hover:border-primary/50 active:bg-surface/70 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center flex-shrink-0 border border-border/50 text-lg font-semibold text-text-secondary group-hover:text-primary transition-colors">
                  {link.label.charAt(0)}
                </div>

                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {link.label}
                  </div>
                  <div className="text-xs text-text-secondary truncate">
                    {t(link.hintKey)}
                  </div>
                </div>

                <span className="text-xs text-primary flex-shrink-0">{t("auth.openInApp")}</span>
              </a>
            ))}
          </div>

          <div className="pt-2 border-t border-border/60 space-y-2">
            <p className="text-xs text-text-muted text-center">{t("auth.mobileInstallHint")}</p>
            <div className="flex gap-2">
              {MOBILE_WALLET_LINKS.map((link) => (
                <a
                  key={link.id}
                  href={getStoreUrl(link, device.isIOS)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-border text-xs text-text-secondary hover:text-primary hover:border-primary/50 transition-colors"
                >
                  <span className="truncate">{link.label}</span>
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (availableWallets.length === 0) {
      return (
        <div className="space-y-4">
          <div className="text-center pt-2 pb-1">
            <WalletIcon className="w-10 h-10 mx-auto mb-3 text-text-muted" />
            <p className="font-medium text-foreground">{t("auth.noWalletsTitle")}</p>
            <p className="text-sm text-text-secondary mt-1">{t("auth.noWalletsHint")}</p>
          </div>

          <div className="space-y-2">
            {RECOMMENDED_WALLETS.map((wallet) => (
              <a
                key={wallet.name}
                href={wallet.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-4 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-surface/50 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center flex-shrink-0 border border-border/50 text-lg font-semibold text-text-secondary group-hover:text-primary transition-colors">
                  {wallet.name.charAt(0)}
                </div>

                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {wallet.name}
                  </div>
                  <div className="text-xs text-text-secondary truncate">
                    {t(wallet.hintKey)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-text-muted group-hover:text-primary transition-colors flex-shrink-0">
                  <span>{t("auth.install")}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </a>
            ))}
          </div>

          <p className="text-xs text-text-muted text-center pt-1">
            {t("auth.afterInstallHint")}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {availableWallets.map((wallet) => {
          const walletName = wallet.adapter.name;
          const label = WALLET_LABELS[walletName] || walletName;

          return (
            <button
              key={walletName}
              onClick={() => handleSelect(walletName)}
              disabled={isSelecting}
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
                  {t("auth.detected")}
                </div>
              </div>

              <div className="text-xs text-text-muted flex-shrink-0">
                {isSelecting ? t("auth.connecting") : <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">→</span>}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("auth.selectWallet")} size="md">
      <div className="max-h-[60vh] overflow-y-auto pr-2">
        {renderBody()}
      </div>
    </Modal>
  );
}
