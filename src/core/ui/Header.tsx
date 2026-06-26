// src/core/ui/Header.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { LanguageSwitcher } from "@/core/i18n/LanguageSwitcher";
import { ThemeSwitcher } from "@/core/ui/ThemeSwitcher";
import { useAuth } from "@/core/auth/AuthProvider";
import { LoginButton } from "@/core/auth/components/LoginButton";

export function Header() {
  const pathname = usePathname();

  const router = useRouter();
  const { t } = useLanguage();
  const { userWallet, isAuthorized, logout } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    router.push("/");
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
          <div className="hidden md:flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />

            <a
              href="/api/client/download"
              download="TANJO-Client-latest.exe"
              className="btn-secondary px-3 sm:px-4 py-1.5 text-sm font-medium whitespace-nowrap"
            >
              {t("header.downloadApp")}
            </a>

            {isAuthorized && userWallet ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/profile"
                  className="btn-primary px-3 sm:px-4 py-1.5 text-sm font-medium whitespace-nowrap"
                >
                  {truncateAddress(userWallet)}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-xs text-text-secondary hover:text-red-400 transition-colors px-2"
                  title={t("header.logout")}
                >
                  ✕
                </button>
              </div>
            ) : (
              <LoginButton />
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
          <div className="md:hidden fixed inset-0 top-16 left-0 right-0 z-[60] bg-zinc-900">
            <div className="absolute inset-0 bg-black/70" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative bg-zinc-900 border-b border-zinc-700 min-h-screen">
              <div className="px-4 py-6 space-y-3">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`block px-4 py-4 rounded-xl text-lg font-semibold transition-colors ${pathname === link.href
                      ? "bg-primary text-white"
                      : "text-foreground bg-zinc-800 hover:bg-zinc-700"
                      }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t(link.label)}
                  </Link>
                ))}

                <a
                  href="/api/client/download"
                  download
                  className="block w-full text-center px-4 py-4 rounded-xl border border-zinc-700 text-foreground font-semibold hover:bg-zinc-800 transition-colors bg-zinc-900"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("header.downloadApp")}
                </a>

                {isAuthorized && userWallet ? (
                  <div className="space-y-3 pt-2">
                    <Link
                      href="/profile"
                      className="block w-full text-center px-4 py-4 rounded-xl btn-primary font-semibold text-white"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {truncateAddress(userWallet)}
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="block w-full text-center px-4 py-4 rounded-xl bg-red-600/20 text-red-400 font-semibold hover:bg-red-600/30 transition-colors"
                    >
                      {t("header.logout")}
                    </button>
                  </div>
                ) : (
                  <div className="pt-2">
                    <LoginButton className="w-full justify-center" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}