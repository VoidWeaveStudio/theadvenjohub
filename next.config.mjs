import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== 'production';

const baseCsp = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' https: blob: data:",
  "connect-src 'self' blob: data: https://theadvenjo.online https://*.theadvenjo.online https://*.solana.com https://api.mainnet-beta.solana.com wss://*.solana.com https://mainnet.helius-rpc.com https://*.helius-rpc.com https://*.helius.dev wss://*.helius-rpc.com https://*.jup.ag http://localhost:3000 http://localhost:3001 ws://localhost:3001 wss://localhost:3001 https://*.onrender.com wss://*.onrender.com",
  "frame-src 'self' https://*.solana.com https://pump.fun https://*.solflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.solana.com https://*.helius.dev https://*.jup.ag http://localhost:3000"
  : "script-src 'self' 'unsafe-inline' https://*.solana.com https://*.helius.dev https://*.jup.ag";

const cspDirectives = [...baseCsp, scriptSrc].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  compress: true, 
  poweredByHeader: false,
  excludeDefaultMomentLocales: true,
  
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  
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
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
    dangerouslyAllowSVG: false,
  },

  webpack: (config, { isServer }) => {
    config.resolve.alias['@'] = path.join(__dirname, 'src');
    
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
      };
    }
    return config;
  },

  turbopack: {
    resolveAlias: {
      '@': path.join(__dirname, 'src'),
    },
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
            value: isDev ? "max-age=0" : "max-age=31536000; includeSubDomains; preload",
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
            value: "camera=(self), microphone=(self), geolocation=()",
          },
        ],
      },
      {
        source: "/games/:gameId/sprites/:path*",
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
        source: "/games/:gameId/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/api/client/download",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
      {
        source: "/stub/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600",
          },
          {
            key: "Content-Disposition",
            value: "attachment",
          },
        ],
      },
    ];
  },
};

export default nextConfig;