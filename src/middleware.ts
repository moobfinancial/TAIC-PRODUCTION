export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';


// Database connection logic (getDbPool, Pool import, sha256) has been removed from middleware.
// Authentication will be handled in individual API routes.

export function middleware(request: NextRequest) { // Made non-async
  // Check if the request path starts with /api/admin/
  if (request.nextUrl.pathname.startsWith('/api/admin/')) {
    console.log('[Middleware] Path matches /api/admin/. Checking for X-Admin-API-Key header for route:', request.nextUrl.pathname);

    const apiKeyHeader = request.headers.get('X-Admin-API-Key');

    if (!apiKeyHeader) {
      console.log('[Middleware] X-Admin-API-Key header missing. Denying access.');
      return new NextResponse(
        JSON.stringify({ success: false, message: 'Admin API Key is required in X-Admin-API-Key header.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    // If header is present, allow request to proceed.
    // Actual validation of the key's value will happen in the API route itself.
    console.log('[Middleware] X-Admin-API-Key header present. Allowing request to proceed to API route for full validation.');
  }

  // Allow ALL requests (including admin ones that passed the basic header check, or non-admin routes)
  // to proceed to their respective handlers or the next middleware in the chain.
  return NextResponse.next();
}

// Specify which paths the middleware should run on
export const config = {
  matcher: '/api/admin/:path*', // Apply middleware to all routes under /api/admin/
};
