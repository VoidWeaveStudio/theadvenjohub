//src\core\ui\Header.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletName } from "@solana/wallet-adapter-base";
import { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { LanguageSwitcher } from "@/core/i18n/LanguageSwitcher";
import { ThemeSwitcher } from "@/core/ui/ThemeSwitcher";
import { apiGet, apiPost } from "@/core/api/client";
import { performLogout } from "@/core/auth/lib/logout";

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

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    
    const checkAuth = async () => {
      if (publicKey === undefined) return;
      
      if (!publicKey) {
        if (!cancelled) setIsAuth(false);
        return;
      }
      
      try {
        await apiGet("/api/auth/me");
        if (!cancelled) setIsAuth(true);
      } catch {
        if (!cancelled) setIsAuth(false);
      }
    };
    
    checkAuth();
    
    return () => { cancelled = true; };
  }, [publicKey]); 

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
      <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur-xl border-b border-border min-h-16">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2 min-h-16 h-auto flex flex-wrap lg:flex-nowrap items-center justify-between gap-y-2 gap-x-3">
          
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-surface">
              <img 
                src="/logo.png" 
                alt="TANJO" 
                className="w-full h-full object-contain opacity-85 brightness-90"
              />
            </div>
            <span className="text-lg font-semibold text-foreground tracking-tight whitespace-nowrap">TANJO Game Store</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 flex-wrap justify-center flex-1 min-w-0 px-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${pathname === link.href
                    ? "bg-surface text-foreground"
                    : "text-text-secondary hover:text-foreground hover:bg-surface/50"
                  }`}
              >
                {t(link.label)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 flex-shrink-0">
            <ThemeSwitcher />
            
            <LanguageSwitcher />

            <a 
              href="/stub/AdvenjoHub-latest.exe" 
              download 
              className="btn-secondary hidden sm:inline-flex px-3 sm:px-4 py-1.5 text-sm font-medium whitespace-nowrap"
            >
              {t("header.downloadApp")}
            </a>

            {isAuth && publicKey ? (
              <Link
                href="/profile"
                className="btn-primary px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap flex items-center gap-2 w-auto justify-center"
              >
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
                <span className="hidden sm:inline">{truncateAddress(publicKey.toBase58())}</span>
                <span className="sm:hidden">{truncateAddress(publicKey.toBase58())}</span>
              </Link>
            ) : (
              <button
                onClick={() => setShowWalletSelector(true)}
                disabled={isProcessing}
                className="btn-primary px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-auto justify-center"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">{t(statusText)}</span>
                    <span className="sm:hidden">⏳</span>
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
              className="md:hidden p-2 text-foreground hover:bg-surface rounded-lg flex-shrink-0"
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
                className={`block py-3 px-4 rounded-lg transition-colors whitespace-nowrap ${pathname === link.href
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-foreground hover:bg-surface"
                  }`}
              >
                {t(link.label)}
              </Link>
            ))}

            <a
              href="/stub/AdvenjoHub-latest.exe"
              download
              onClick={() => setShowMobileMenu(false)}
              className="block py-3 px-4 rounded-lg bg-surface text-foreground hover:bg-surface/80 text-center mt-4 whitespace-nowrap"
            >
              {t("header.downloadApp")}
            </a>
          </nav>
        </div>
      )}
    </>
  );
}