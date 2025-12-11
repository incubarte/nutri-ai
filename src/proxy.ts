
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Check if the read-only mode is enabled via environment variable
  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true') {
    const { pathname } = request.nextUrl;

    // Define the list of protected admin/editing paths, now including the root
    const protectedPaths = [
      '/',
      '/controls',
      '/config',
      '/setup',
      '/admin',
      '/replays',
    ];

    // Redirect if it's the root path exactly or if it starts with other protected paths
    if (pathname === '/' || protectedPaths.some(path => path !== '/' && pathname.startsWith(path))) {
      const url = request.nextUrl.clone();
      url.pathname = '/tournaments'; // Redirect to a safe, read-only page
      return NextResponse.redirect(url);
    }
  }

  // Allow the request to proceed if not in read-only mode or not a protected path
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    '/',
    '/controls/:path*',
    '/config/:path*',
    '/setup/:path*',
    '/admin/:path*',
    '/replays/:path*',
  ],
};
