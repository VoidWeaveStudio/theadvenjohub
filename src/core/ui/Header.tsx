//src\core\ui\Header.tsx
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

  useEffect(() => setMounted(true), []);

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
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2 min-h-16 h-auto flex flex-wrap lg:flex-nowrap items-center justify-between gap-y-2 gap-x-3">

        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-surface">
            <img src="/logo.png" alt={t("header.appName")} className="w-full h-full object-contain opacity-85 brightness-90" />
          </div>
          <span className="text-lg font-semibold text-foreground tracking-tight whitespace-nowrap">{t("header.appName")}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 flex-wrap justify-center flex-1 min-w-0 px-1">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={`px-2 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${pathname === link.href ? "bg-surface text-foreground" : "text-text-secondary hover:text-foreground hover:bg-surface/50"}`}>
              {t(link.label)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 flex-shrink-0">
          <ThemeSwitcher />
          <LanguageSwitcher />

          <a href="/stub/AdvenjoHub-latest.exe" download className="btn-secondary hidden sm:inline-flex px-3 sm:px-4 py-1.5 text-sm font-medium whitespace-nowrap">
            {t("header.downloadApp")}
          </a>

          {isAuth && userWallet ? (
            <Link href="/profile" className="btn-primary ...">
              {truncateAddress(userWallet)}
            </Link>
          ) : (
            <LoginWithPhantom onLogin={(wallet) => { setUserWallet(wallet); setIsAuth(true); }} />
          )}

          <button className="md:hidden p-2 text-foreground hover:bg-surface rounded-lg flex-shrink-0" aria-label={t("header.openMenu")}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}