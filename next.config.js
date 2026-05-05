const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.solana.com https://*.helius.dev",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' https: blob: data:",
  "connect-src 'self' https://*.solana.com https://api.mainnet-beta.solana.com wss://*.solana.com https://mainnet.helius-rpc.com https://*.helius-rpc.com https://*.helius.dev wss://*.helius-rpc.com https://*.jup.ag",
  "frame-src 'self' https://*.solana.com https://pump.fun https://*.solflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  reactStrictMode: true,
  excludeDefaultMomentLocales: true,
  env: {
    CSRF_SECRET: process.env.CSRF_SECRET,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.tanjo.store" },
      { protocol: "https", hostname: "arweave.net" },
      { protocol: "https", hostname: "shdw-drive.genesysgo.net" },
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "gateway.pinata.cloud" },
      ...(process.env.NODE_ENV === 'development' 
        ? [{ protocol: "https", hostname: "**" }] 
        : []),
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspDirectives,
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=30, stale-while-revalidate=60",
          },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/sprites/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  turbopack: {
    resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json", ".mjs"],
  },
};

export default nextConfig;