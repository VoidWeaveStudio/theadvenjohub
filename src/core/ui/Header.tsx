"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { LanguageSwitcher } from "@/core/i18n/LanguageSwitcher";
import { ThemeSwitcher } from "@/core/ui/ThemeSwitcher";
import { apiGet } from "@/core/api/client";
import { performLogout } from "@/core/auth/lib/logout";
import { LoginWithPhantom } from "@/core/auth/components/LoginWithPhantom";

export function Header() {
  const pathname = usePathname();
  if (pathname?.startsWith('/game')) return null;

  const router = useRouter();
  const { disconnect } = useWallet();
  const { t } = useLanguage();

  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [isAuth, setIsAuth] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!userWallet) return;
    let cancelled = false;

    const checkAuth = async () => {
      try {
        await apiGet("/api/auth/me");
        if (!cancelled) setIsAuth(true);
      } catch {
        if (!cancelled) setIsAuth(false);
      }
    };

    checkAuth();
    return () => { cancelled = true; };
  }, [userWallet]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      await performLogout(disconnect, router);
      setUserWallet(null);
      setIsAuth(false);
      setMobileMenuOpen(false);
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
    <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur-xl border-b border-border min-h-16">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2 min-h-16 h-auto flex items-center justify-between gap-x-3">

        <Link href="/" className="flex items-center gap-2 flex-shrink-0 z-50" onClick={() => setMobileMenuOpen(false)}>
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-surface">
            <img src="/logo.png" alt={t("header.appName")} className="w-full h-full object-contain opacity-85 brightness-90" />
          </div>
          <span className="text-lg font-semibold text-foreground tracking-tight whitespace-nowrap">{t("header.appName")}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 justify-center flex-1 min-w-0 px-1">
          {links.map((link) => (
            <Link 
              key={link.href} 
              href={link.href} 
              className={`px-2 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                pathname === link.href 
                  ? "bg-surface text-foreground" 
                  : "text-text-secondary hover:text-foreground hover:bg-surface/50"
              }`}
            >
              {t(link.label)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden md:flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />

            <a 
              href="/stub/AdvenjoHub-latest.exe" 
              download 
              className="btn-secondary px-3 sm:px-4 py-1.5 text-sm font-medium whitespace-nowrap"
            >
              {t("header.downloadApp")}
            </a>

            {isAuth && userWallet ? (
              <Link 
                href="/profile" 
                className="btn-primary px-3 sm:px-4 py-1.5 text-sm font-medium whitespace-nowrap"
              >
                {truncateAddress(userWallet)}
              </Link>
            ) : (
              <LoginWithPhantom 
                onLogin={(wallet) => { 
                  setUserWallet(wallet); 
                  setIsAuth(true); 
                }} 
              />
            )}
          </div>

          <button 
            className="md:hidden p-2 text-foreground hover:bg-surface rounded-lg flex-shrink-0 z-50 relative" 
            aria-label={t("header.openMenu")}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-16 left-0 right-0 z-40 bg-[#161618] overflow-y-auto">
            <div className="px-4 py-6 space-y-3">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-4 py-4 rounded-xl text-lg font-semibold transition-colors ${
                    pathname === link.href
                      ? "bg-primary text-white"
                      : "text-foreground bg-zinc-800 hover:bg-zinc-700"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t(link.label)}
                </Link>
              ))}

              <a
                href="/stub/AdvenjoHub-latest.exe"
                download
                className="block w-full text-center px-4 py-4 rounded-xl border border-zinc-700 text-foreground font-semibold hover:bg-zinc-800 transition-colors bg-zinc-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("header.downloadApp")}
              </a>

              {isAuth && userWallet ? (
                <Link
                  href="/profile"
                  className="block w-full text-center px-4 py-4 rounded-xl btn-primary font-semibold text-white"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {truncateAddress(userWallet)}
                </Link>
              ) : (
                <div className="pt-2">
                  <LoginWithPhantom 
                    onLogin={(wallet) => { 
                      setUserWallet(wallet); 
                      setIsAuth(true); 
                      setMobileMenuOpen(false);
                    }} 
                    className="w-full justify-center"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}