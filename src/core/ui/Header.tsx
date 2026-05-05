//src\core\ui\Header.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletName } from "@solana/wallet-adapter-base";
import { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { LanguageSwitcher } from "@/core/i18n/LanguageSwitcher";
import { apiGet, apiPost } from "@/core/api/client";
import { performLogout } from "@/core/auth/lib/logout";

function isAdminWallet(wallet: string | null): boolean {
  if (!wallet || !process.env.NEXT_PUBLIC_ADMIN_WALLET) return false;
  return wallet.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN_WALLET.toLowerCase();
}

export function Header() {
  const pathname = usePathname();

  if (pathname?.startsWith('/game')) return null;

  const router = useRouter();
  const { publicKey, connect, disconnect, wallets, select, signMessage } = useWallet();
  const { t } = useLanguage();

  const [isAuth, setIsAuth] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("header.connect");
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const walletAddress = publicKey?.toBase58() || null;
  const isCurrentUserAdmin = isAdminWallet(walletAddress);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await apiGet("/api/auth/me");
        setIsAuth(!!publicKey);
      } catch {
        setIsAuth(false);
      }
    };
    if (publicKey !== undefined) checkAuth();
  }, [publicKey]);

  useEffect(() => {
    if (!mounted) return;
    const checkAndRefresh = async () => {
      const hasToken = document.cookie.split(';').some(c => c.trim().startsWith('token='));
      const hasRefresh = document.cookie.split(';').some(c => c.trim().startsWith('refresh_token='));
      if (!hasToken && hasRefresh && publicKey) {
        try {
          await apiPost("/api/auth/refresh");
        } catch {
          handleLogout();
        }
      }
      setIsAuth(document.cookie.split(';').some(c => c.trim().startsWith('token=')) && !!publicKey);
    };
    checkAndRefresh();
  }, [mounted, publicKey]);

  const handleConnect = useCallback(async (walletName: WalletName) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setStatusText("header.connecting");
    setShowWalletSelector(false);

    try {
      select(walletName);
      await connect();

      await new Promise(resolve => setTimeout(resolve, 300));

      if (!publicKey) throw new Error("Wallet not connected");
      if (!signMessage) throw new Error("Wallet does not support message signing");

      await performSignIn();

    } catch (error: any) {
      console.error("Connect error:", error);
      const isUserRejection = error.code === 4001 ||
        error.message?.includes("rejected") ||
        error.message?.includes("User rejected");

      if (!isUserRejection) {
        const message = error.message?.startsWith("api.error.")
          ? t(error.message)
          : t("header.connectFailed");
        alert(message);
      }
    } finally {
      setIsProcessing(false);
      setStatusText("header.connect");
    }
  }, [isProcessing, publicKey, signMessage, select, connect, t]);

  const performSignIn = useCallback(async () => {
    if (!publicKey || !signMessage) {
      throw new Error("Wallet not ready");
    }

    setStatusText("header.signing");

    try {
      const { nonce } = await apiGet<{ nonce: string }>(
        `/api/auth/challenge?wallet=${publicKey.toBase58()}`
      );

      const message = `Sign in to TANJO Game Store\nWallet: ${publicKey.toBase58()}\nNonce: ${nonce}`;
      const encoded = new TextEncoder().encode(message);

      const signed = await Promise.race([
        signMessage(encoded),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Signature timeout")), 30000)
        ),
      ]);

      const signatureBase64 = Buffer.from(signed).toString("base64");

      await apiPost("/api/auth/verify", {
        wallet: publicKey.toBase58(),
        message,
        signature: signatureBase64,
        nonce,
      }, undefined, t);

      setIsAuth(true);
      setStatusText("header.connected");

    } catch (error: any) {
      console.error("Sign in error:", error);

      const isUserRejection = error.code === 4001 ||
        error.message?.includes("rejected") ||
        error.message?.includes("User rejected");

      if (isUserRejection) {
        throw new Error("Signature cancelled by user");
      }
      if (error.message?.includes("timeout")) {
        throw new Error("Wallet did not respond. Please unlock and try again.");
      }

      throw error;
    }
  }, [publicKey, signMessage, t]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      await performLogout(disconnect, router);
      setIsAuth(false);
    }
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  const links = [
    { href: "/", label: "nav.store" },
    { href: "/marketplace", label: "nav.marketplace" },
    { href: "/forum", label: "nav.forum" },
    { href: "/about", label: "nav.about" },
    { href: "/support", label: "nav.support" },
  ];

  if (!mounted) return null;

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#0c0c0f]/95 backdrop-blur-xl border-b border-border min-h-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="text-lg font-semibold text-foreground tracking-tight">TANJO Game Store</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 sm:px-4 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${pathname === link.href
                    ? "bg-surface text-foreground"
                    : "text-text-secondary hover:text-foreground hover:bg-surface/50"
                  }`}
              >
                {t(link.label)}
              </Link>
            ))}

            {isCurrentUserAdmin && (
              <Link
                href="/admin"
                className="px-3 py-2 sm:px-4 text-sm font-medium rounded-md transition-colors text-primary hover:text-primary/80 hover:bg-surface/50 flex items-center gap-1"
              >
                🛠 Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />

            <a href="/stub/AdvenjoHub-latest.exe" download className="btn-secondary hidden sm:flex px-4 py-2 text-sm font-medium">
              {t("header.downloadApp")}
            </a>

            {isAuth && publicKey ? (
              <Link
                href="/profile"
                className="btn-primary px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium flex items-center gap-2"
              >
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="hidden sm:inline">{truncateAddress(publicKey.toBase58())}</span>
                <span className="sm:hidden">{truncateAddress(publicKey.toBase58())}</span>
              </Link>
            ) : (
              <button
                onClick={() => setShowWalletSelector(true)}
                disabled={isProcessing}
                className="btn-primary px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[100px] sm:min-w-[140px] justify-center"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">{t(statusText)}</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">{t("header.connect")}</span>
                    <span className="sm:hidden">🔗</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => setShowMobileMenu(true)}
              className="md:hidden p-2 text-foreground hover:bg-surface rounded-lg"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {showWalletSelector && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-elevated border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">{t("header.selectWallet")}</h3>
              <button onClick={() => setShowWalletSelector(false)} className="text-text-muted hover:text-foreground text-xl">✕</button>
            </div>
            <div className="space-y-2">
              {wallets.map((wallet) => (
                <button
                  key={wallet.adapter.name}
                  onClick={() => handleConnect(wallet.adapter.name as WalletName)}
                  disabled={isProcessing}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface hover:bg-surface/80 border border-border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <img src={wallet.adapter.icon} alt={wallet.adapter.name} className="w-8 h-8 rounded-full bg-white p-0.5" />
                  <span className="font-medium text-foreground">{wallet.adapter.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showMobileMenu && (
        <div className="fixed inset-0 bg-background/98 backdrop-blur-xl z-[100] md:hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="text-lg font-semibold">Menu</span>
            <button onClick={() => setShowMobileMenu(false)} className="p-2 text-text-muted hover:text-foreground">✕</button>
          </div>
          <nav className="flex flex-col gap-2 p-4 mt-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setShowMobileMenu(false)}
                className={`block py-3 px-4 rounded-lg transition-colors ${pathname === link.href
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-foreground hover:bg-surface"
                  }`}
              >
                {t(link.label)}
              </Link>
            ))}

            {isCurrentUserAdmin && (
              <Link
                href="/admin"
                onClick={() => setShowMobileMenu(false)}
                className="block py-3 px-4 rounded-lg text-primary hover:bg-surface/50 flex items-center gap-2"
              >
                🛠 Admin Panel
              </Link>
            )}

            <a
              href="/stub/AdvenjoHub-latest.exe"
              download
              onClick={() => setShowMobileMenu(false)}
              className="block py-3 px-4 rounded-lg bg-surface text-foreground hover:bg-surface/80 text-center mt-4"
            >
              {t("header.downloadApp")}
            </a>
          </nav>
        </div>
      )}
    </>
  );
}