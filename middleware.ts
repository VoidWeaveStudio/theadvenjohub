import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  if (
    request.nextUrl.pathname.startsWith('/sprites/') ||
    request.nextUrl.pathname.startsWith('/icons/')
  ) {
    response.headers.set(
      'Cache-Control',
      'public, max-age=31536000, immutable, must-revalidate'
    );
  }
  
  return response;
}

export const config = {
  matcher: ['/sprites/:path*', '/icons/:path*'],
};