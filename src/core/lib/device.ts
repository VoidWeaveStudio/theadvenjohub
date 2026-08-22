// src/core/lib/device.ts
export type WalletBrowser = "phantom" | "solflare" | "okx" | "backpack" | "coinbase" | "trust";

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isTouch: boolean;
  isStandalone: boolean;
  walletBrowser: WalletBrowser | null;
}

const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
const TABLET_UA = /iPad|Android(?!.*Mobile)|Tablet|PlayBook|Silk/i;

const WALLET_BROWSER_UA: { name: WalletBrowser; pattern: RegExp }[] = [
  { name: "phantom", pattern: /Phantom/i },
  { name: "solflare", pattern: /Solflare/i },
  { name: "okx", pattern: /OKApp|OKEx/i },
  { name: "backpack", pattern: /Backpack/i },
  { name: "coinbase", pattern: /CoinbaseWallet|CoinbaseBrowser/i },
  { name: "trust", pattern: /Trust(Wallet)?\//i },
];

function userAgent(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || navigator.vendor || "";
}

function touchPoints(): number {
  if (typeof navigator === "undefined") return 0;
  return navigator.maxTouchPoints || 0;
}

export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || touchPoints() > 0;
}

export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  if (/iPhone|iPad|iPod/i.test(userAgent())) return true;
  return /Mac/i.test(userAgent()) && touchPoints() > 1;
}

export function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(userAgent());
}

export function isTablet(): boolean {
  if (typeof window === "undefined") return false;
  if (isIOS() && touchPoints() > 1 && /Mac/i.test(userAgent())) return true;
  return TABLET_UA.test(userAgent());
}

export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  if (MOBILE_UA.test(userAgent())) return true;
  if (isIOS()) return true;
  return isTouchDevice() && window.innerWidth < 768;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return (window.navigator as { standalone?: boolean }).standalone === true;
}

export function detectWalletBrowser(): WalletBrowser | null {
  if (typeof window === "undefined") return null;

  const ua = userAgent();
  const matched = WALLET_BROWSER_UA.find((entry) => entry.pattern.test(ua));
  if (matched) return matched.name;

  if (!isMobile()) return null;

  const w = window as Record<string, any>;
  if (w.phantom?.solana?.isPhantom || w.solana?.isPhantom) return "phantom";
  if (w.solflare?.isSolflare) return "solflare";
  if (w.okxwallet?.solana) return "okx";
  if (w.backpack?.isBackpack) return "backpack";

  return null;
}

export function readDeviceInfo(): DeviceInfo {
  return {
    isMobile: isMobile(),
    isTablet: isTablet(),
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    isTouch: isTouchDevice(),
    isStandalone: isStandalone(),
    walletBrowser: detectWalletBrowser(),
  };
}

export const SERVER_DEVICE_INFO: DeviceInfo = {
  isMobile: false,
  isTablet: false,
  isIOS: false,
  isAndroid: false,
  isTouch: false,
  isStandalone: false,
  walletBrowser: null,
};
