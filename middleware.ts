// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isDev = process.env.NODE_ENV !== 'production';

function buildCsp(nonce: string): string {
  const directives = [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' https: blob: data:",
    "connect-src 'self' blob: data: https://theadvenjo.online https://*.theadvenjo.online https://*.solana.com https://api.mainnet-beta.solana.com wss://*.solana.com https://mainnet.helius-rpc.com https://*.helius-rpc.com https://*.helius.dev wss://*.helius-rpc.com https://*.jup.ag http://localhost:3000 http://localhost:3001 ws://localhost:3001 wss://localhost:3001 https://*.onrender.com wss://*.onrender.com",
    "frame-src 'self' https://*.solana.com https://pump.fun https://*.solflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    isDev
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
  ];

  return directives.join('; ');
}

function handleApiRequest(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin') || '';

  const allowedOrigins = [
    'https://theadvenjo.online',
    'tauri://localhost',
    'https://tauri.localhost',
    'http://tauri.localhost',
  ];

  if (isDev) {
    allowedOrigins.push(
      'http://localhost:1420',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:1420',
      'http://localhost:5173',
    );
  }

  const isTauriOrigin = origin.startsWith('tauri://') ||
    origin.endsWith('.tauri.localhost') ||
    origin === 'https://tauri.localhost' ||
    origin === 'http://tauri.localhost';

  const isAllowed = allowedOrigins.includes(origin) || isTauriOrigin;

  if (request.method === 'OPTIONS') {
    if (!isAllowed) {
      return new NextResponse(null, { status: 403 });
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-csrf-token, x-device-id, x-client-version',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
      },
    });
  }

  const response = NextResponse.next();

  if (isAllowed) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-csrf-token, x-device-id, x-client-version');
    response.headers.set('Vary', 'Origin');
  }

  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    return handleApiRequest(request);
  }

  if (pathname.startsWith('/auth/desktop')) {
    return NextResponse.next();
  }

  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|models|sounds|games|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|glb|gltf|bin|mp3|ogg|wav|webm|mp4|json|txt|xml|webmanifest)$).*)',
  ],
};
