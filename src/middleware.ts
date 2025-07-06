import { NextResponse, type NextRequest } from 'next/server';
// Note: Cannot import securityMiddleware in Edge runtime due to Node.js dependencies
// Security monitoring will be handled at the API route level

// Middleware will now use the default Edge runtime.

// Apply to all routes for comprehensive monitoring
export const config = {
  matcher: [
    // Apply to all routes except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Basic security checks that can run in Edge runtime
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'Unknown';

  // Block known malicious patterns
  if (isBlockedRequest(request, ipAddress, userAgent)) {
    return new NextResponse('Access Denied', { status: 403 });
  }

  // Skip admin auth for login page and API routes that don't require auth
  if (pathname.startsWith('/admin/login') ||
      pathname.startsWith('/api/admin/auth') ||
      pathname.startsWith('/api/validate-api-key')) {
    return NextResponse.next();
  }

  // Skip admin auth for non-admin routes
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
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

// Helper functions for Edge runtime compatibility
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  return '127.0.0.1';
}

function isBlockedRequest(request: NextRequest, ipAddress: string, userAgent: string): boolean {
  const url = request.url;

  // Block obvious SQL injection attempts
  const sqlPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(url)) {
      console.warn(`Blocked SQL injection attempt from ${ipAddress}: ${url}`);
      return true;
    }
  }

  // Block obvious XSS attempts
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
  ];

  for (const pattern of xssPatterns) {
    if (pattern.test(url)) {
      console.warn(`Blocked XSS attempt from ${ipAddress}: ${url}`);
      return true;
    }
  }

  // Block suspicious user agents
  const maliciousAgents = [
    /sqlmap/i,
    /nikto/i,
    /nessus/i,
    /masscan/i,
    /nmap/i,
  ];

  for (const pattern of maliciousAgents) {
    if (pattern.test(userAgent)) {
      console.warn(`Blocked malicious user agent from ${ipAddress}: ${userAgent}`);
      return true;
    }
  }

  return false;
}
