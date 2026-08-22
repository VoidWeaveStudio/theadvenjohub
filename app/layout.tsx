// app/layout.tsx
import "@/core/init";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@/core/styles/globals.css";
import { Inter, Oxanium } from "next/font/google";
import { Header } from "@/core/ui/Header";
import { SolanaProviders } from "@/core/providers/SolanaProviders";
import { LanguageProvider } from "@/core/i18n/LanguageContext";
import { getTranslation, LANGUAGES } from "@/core/i18n";
import { resolveLanguage } from "@/core/i18n/detect";
import type { Language } from "@/core/i18n/types";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "arial"],
  variable: "--font-inter",
});

const oxanium = Oxanium({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "arial"],
  variable: "--font-oxanium",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://theadvenjo.online";

async function requestLanguage(): Promise<{ language: Language; pathname: string }> {
  const headerList = await headers();
  return {
    language: resolveLanguage({
      override: headerList.get("x-language"),
      cookie: headerList.get("cookie"),
      acceptLanguage: headerList.get("accept-language"),
    }),
    pathname: headerList.get("x-pathname") || "/",
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { language, pathname } = await requestLanguage();
  const canonical = `${SITE_URL}${pathname}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: getTranslation("meta.title", language),
    description: getTranslation("meta.description", language),
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(LANGUAGES.map((code) => [code, `${canonical}?lang=${code}`])),
        "x-default": canonical,
      },
    },
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
      ],
      apple: "/apple-touch-icon.png",
    },
    manifest: "/site.webmanifest",
  };
}

export const viewport: Viewport = {
  themeColor: "#161618",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") || undefined;
  const { language } = await requestLanguage();

  return (
    <html lang={language} suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const saved = localStorage.getItem('theme');
                  if (saved === 'light' || saved === 'dark') {
                    document.documentElement.setAttribute('data-theme', saved);
                  } else {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
                  }
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${oxanium.variable} text-foreground font-sans antialiased`}>
        <div className="site-background" aria-hidden="true" />
        <LanguageProvider>
          <SolanaProviders>
            <Header />
            <main className="relative z-10 min-h-screen pb-12 sm:pb-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
                {children}
              </div>
            </main>
          </SolanaProviders>
        </LanguageProvider>
      </body>
    </html>
  );
}