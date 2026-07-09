// app/layout.tsx
import "@/core/init";
import type { Metadata, Viewport } from "next"; 
import "@/core/styles/globals.css";
import { Inter, Oxanium } from "next/font/google";
import { Header } from "@/core/ui/Header";
import { SolanaProviders } from "@/core/providers/SolanaProviders";
import { LanguageProvider } from "@/core/i18n/LanguageContext";
import Head from "@/core/ui/Head";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "arial"],
  variable: "--font-inter",
});

const oxanium = Oxanium({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "arial"],
  variable: "--font-oxanium",
});

export const metadata: Metadata = {
  title: "TANJO Game Store | Indie Games Platform",
  description: "TANJO Game Store - Discover and play indie games",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#161618",
  colorScheme: "dark light", 
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
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
        <Head />
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