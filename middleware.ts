import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define public paths that do not require authentication
const PUBLIC_PATHS = ['/','/login', '/api/auth/login'];
// Define the default path for authenticated users
const AUTHENTICATED_DEFAULT_PATH = '/dashboard'; // Change this to your desired authenticated route

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authToken = request.cookies.get('auth-token')?.value;

  // Check if the current path is a public path
  const isPublicPath = PUBLIC_PATHS.some(path => pathname.startsWith(path));

  if (authToken) {
    // If user is authenticated and tries to access login/register, redirect to dashboard
    if (pathname === '/login') {
      return NextResponse.redirect(new URL(AUTHENTICATED_DEFAULT_PATH, request.url));
    }
  } else {
    // If user is not authenticated and tries to access a protected path
    if (!isPublicPath) {
      // Allow access to static files and Next.js specific paths even if not authenticated
      // This regex matches common static file extensions and Next.js internal paths
      if (/\.(.*)$/.test(pathname) || pathname.startsWith('/_next/')) {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Match all request paths except for API routes that shouldn't be processed by this middleware
  // and static files.
  // Adjust the matcher to your needs.
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes) - you might want to protect some API routes differently
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (images, models, etc.)
     */
    '/((?!api/auth/.*|_next/static|_next/image|favicon.ico|models/.*|images/.*|sw.js|register-sw.js|manifest.json).*)',
  ],
};