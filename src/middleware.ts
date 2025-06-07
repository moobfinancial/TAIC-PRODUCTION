import { NextResponse, type NextRequest } from 'next/server';

// Middleware will now use the default Edge runtime.

// Run on all routes under /admin except /admin/login
export const config = {
  matcher: [
    '/admin',
    '/admin/((?!login|api).*)', // Match all /admin routes except /admin/login and /admin/api/...
    '/api/admin/:path*', // API routes
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for login page and API routes that don't require auth
  if (pathname.startsWith('/admin/login') || 
      pathname.startsWith('/api/admin/auth') ||
      pathname.startsWith('/api/validate-api-key')) {
    return NextResponse.next();
  }

  // Check for API key in headers or cookies
  let apiKey = request.headers.get('x-admin-api-key');
  
  // If no API key in headers, check cookies
  if (!apiKey) {
    const cookie = request.cookies.get('admin-api-key');
    if (cookie) {
      apiKey = cookie.value;
    }
  }

  // If no API key found, redirect to login
  if (!apiKey) {
    if (pathname.startsWith('/api/admin')) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 401 }
      );
    }
    
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate the API key using the API endpoint
  const validationUrl = new URL('/api/validate-api-key', request.url);
  
  try {
    const validationResponse = await fetch(validationUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey }),
    });

    const result = await validationResponse.json();
    
    // If API key is invalid, redirect to login
    if (!result.valid) {
      if (pathname.startsWith('/api/admin')) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // If we get here, the API key is valid
    const nextResponse = NextResponse.next();
    
    // Add user info to response headers for API routes
    if (pathname.startsWith('/api/admin')) {
      if (result.userId) nextResponse.headers.set('x-user-id', result.userId);
      if (result.username) nextResponse.headers.set('x-username', result.username);
    }

    return nextResponse;
  } catch (error) {
    console.error('Error in middleware:', error);
    
    if (pathname.startsWith('/api/admin')) {
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
    
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('error', 'server_error');
    return NextResponse.redirect(loginUrl);
  }
}
