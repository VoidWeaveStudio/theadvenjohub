// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const url = request.nextUrl.clone();
  const isDev = process.env.NODE_ENV !== 'production';
  
  if (url.pathname.startsWith('/auth/desktop')) {
    return NextResponse.next();
  }
  
  const allowedOrigins = [
    'http://localhost:1420',
    'http://localhost:3000',
    'http://localhost:3001',
    'https://theadvenjo.online',
    'tauri://localhost',           
    'https://tauri.localhost',     
    'http://tauri.localhost',      
  ];
  
  if (isDev) {
    allowedOrigins.push(
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
      console.log(`[CORS] Blocked preflight from origin: ${origin}`);
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
  } else {
    console.log(`[CORS] Blocked request from origin: ${origin}`);
  }
  
  return response;
}

export const config = {
  matcher: '/api/:path*',
};