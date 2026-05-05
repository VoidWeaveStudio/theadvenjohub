//app\layout.tsx
import "@/core/init";
import type { Metadata } from "next";
import "@/core/styles/globals.css";
import { Inter } from "next/font/google";
import { Header } from "@/core/ui/Header";
import { SolanaProviders } from "@/core/providers/SolanaProviders";
import { LanguageProvider } from "@/core/i18n/LanguageContext";
import Head from "@/core/ui/Head";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "arial"],
});

export const metadata: Metadata = {
  title: "TANJO Game Store | Indie Games Platform",
  description: "TANJO Game Store - Discover and play indie games",
  icons: {
    icon: [
      { url: "/favicons/favicon.svg", type: "image/svg+xml" },
      { url: "/favicons/favicon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/favicons/apple-touch-icon.png",
  },
  manifest: "/favicons/site.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <Head />
      </head>
      <body className={`${inter.className} text-foreground font-sans antialiased`}>
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