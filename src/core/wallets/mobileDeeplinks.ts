// src/core/wallets/mobileDeeplinks.ts
import type { WalletBrowser } from "@/core/lib/device";

export interface MobileWalletLink {
  id: WalletBrowser;
  label: string;
  hintKey: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
  buildBrowseUrl: (target: string) => string;
}

export const MOBILE_WALLET_LINKS: MobileWalletLink[] = [
  {
    id: "phantom",
    label: "Phantom",
    hintKey: "auth.walletHint.phantom",
    iosStoreUrl: "https://apps.apple.com/app/phantom-crypto-wallet/id1598432977",
    androidStoreUrl: "https://play.google.com/store/apps/details?id=app.phantom",
    buildBrowseUrl: (target) =>
      `https://phantom.app/ul/browse/${encodeURIComponent(target)}?ref=${encodeURIComponent(originOf(target))}`,
  },
  {
    id: "solflare",
    label: "Solflare",
    hintKey: "auth.walletHint.solflare",
    iosStoreUrl: "https://apps.apple.com/app/solflare/id1580902717",
    androidStoreUrl: "https://play.google.com/store/apps/details?id=com.solflare.mobile",
    buildBrowseUrl: (target) =>
      `https://solflare.com/ul/v1/browse/${encodeURIComponent(target)}?ref=${encodeURIComponent(originOf(target))}`,
  },
];

function originOf(target: string): string {
  try {
    return new URL(target).origin;
  } catch {
    return "";
  }
}

export function getSafeBrowseTarget(): string | null {
  if (typeof window === "undefined") return null;

  const { origin, pathname, protocol } = window.location;
  if (protocol !== "https:") return null;

  return `${origin}${pathname}`;
}

export function getStoreUrl(link: MobileWalletLink, isIOS: boolean): string {
  return isIOS ? link.iosStoreUrl : link.androidStoreUrl;
}
